import { SafetyReport, Finding, TokenMetadata, ConfidenceLevel } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { TOKEN_THRESHOLDS, CHAIN_NAMES, CHAIN_ID_MAP, GOPLUS_CONFIG, GOV_RESOURCE_LINKS } from '@/config/rules';
import { fetchTokenSecurity } from '@/lib/apis/goplus';
import { fetchContractVerification } from '@/lib/apis/sourcify';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url?: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    name: string;
    symbol: string;
  };
  priceUsd?: string;
  priceChange: {
    h24: number;
  };
  liquidity: {
    usd: number;
  };
  fdv: number;
  volume: {
    h24: number;
  };
  pairCreatedAt: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

export async function scanToken(address: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: TokenMetadata = {};
  let hasDexData = false;
  let hasVolume = false;
  let hasPriceChange = false;
  let hasExtremePump = false;
  let hasVeryLowLiquidity = false;
  let hasLowLiquidity = false;
  let hasHighVolatility = false;
  let hasModerateVolatility = false;
  let hasHoneypot = false;
  let hasGoPlusData = false;

  // Basic address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    findings.push({ message: 'Invalid contract address format', severity: 'high' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKEN_THRESHOLDS.fetchTimeoutMs);

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`DexScreener API returned ${response.status}`);
    }

    const raw = await response.json();

    // Defensive validation — DexScreener API format may change
    const data: DexScreenerResponse = {
      pairs: Array.isArray(raw?.pairs) ? raw.pairs : null,
    };

    if (!data.pairs || data.pairs.length === 0) {
      findings.push({
        message: 'DexScreener returned no liquidity pairs — token may be unlisted or a scam',
        severity: 'danger',
      });
      recommendations.push('Do not interact with this token unless verified on a block explorer');
      recommendations.push('Verify the contract address on a block explorer');
      recommendations.push('Do not send funds to unverified contracts');
    } else {
      hasDexData = true;

      // Use the most liquid pair (single-pass selection)
      const pair = data.pairs.reduce((best, cur) =>
        (cur.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? cur : best
      );

      // Validate that the pair has the minimum expected fields
      if (!pair.baseToken || !pair.chainId) {
        findings.push({
          message: 'Token data is incomplete — API returned unexpected format.',
          severity: 'medium',
          scoreOverride: 20,
        });
      }

      // Populate metadata
      metadata.name = pair.baseToken?.name;
      metadata.symbol = pair.baseToken?.symbol;
      metadata.chain = CHAIN_NAMES[pair.chainId] || pair.chainId;
      metadata.chainId = pair.chainId;
      metadata.dex = pair.dexId;
      metadata.liquidityUsd = pair.liquidity?.usd;
      metadata.fdv = pair.fdv;
      metadata.volume24h = pair.volume?.h24;
      metadata.priceUsd = pair.priceUsd;
      metadata.priceChange24h = pair.priceChange?.h24;
      metadata.pairAddress = pair.pairAddress;
      metadata.dexscreenerUrl = pair.url;
      metadata.pairCreatedAt = pair.pairCreatedAt;

      // -----------------------------------------------------------------------
      // Pair age — calculate once, use for display and scoring
      // -----------------------------------------------------------------------
      let ageDays = -1;
      if (pair.pairCreatedAt) {
        const ageMs = Date.now() - pair.pairCreatedAt;
        ageDays = ageMs / (1000 * 60 * 60 * 24);
        const displayDays = Math.floor(ageDays);
        metadata.pairAge = displayDays < 1 ? 'Less than 1 day' : `${displayDays} days`;
      }

      // Pair age checks (< 1 day = danger, < 3 days = warning)
      if (ageDays >= 0) {
        if (ageDays < TOKEN_THRESHOLDS.pairAgeDangerousDays) {
          findings.push({
            message: `Token pair is extremely new (${metadata.pairAge} old)`,
            severity: 'danger',
            scoreOverride: 25,
          });
          recommendations.push('Extremely new tokens are very likely to be scams or rug pulls');
        } else if (ageDays < TOKEN_THRESHOLDS.pairAgeSuspiciousDays) {
          findings.push({
            message: `Token pair is very new (${metadata.pairAge} old)`,
            severity: 'medium',
            scoreOverride: 15,
          });
          recommendations.push('New tokens are significantly more likely to be scams or rug pulls');
        }
      }

      // -----------------------------------------------------------------------
      // Liquidity checks (< 5k = danger +50, < 50k = warning +25, >= 50k = info)
      // -----------------------------------------------------------------------
      const liquidity = pair.liquidity?.usd || 0;
      if (liquidity < TOKEN_THRESHOLDS.liquidityDangerous) {
        hasVeryLowLiquidity = true;
        findings.push({
          message: `Dangerously low liquidity: $${liquidity.toLocaleString()}`,
          severity: 'danger',
          scoreOverride: 50,
        });
        recommendations.push('Tokens with very low liquidity can be easily manipulated or are likely scams');
      } else if (liquidity < TOKEN_THRESHOLDS.liquiditySuspicious) {
        hasLowLiquidity = true;
        findings.push({
          message: `Low liquidity: $${liquidity.toLocaleString()}`,
          severity: 'medium',
          scoreOverride: 25,
        });
        recommendations.push('Low liquidity makes it difficult to sell without large price impact');
      } else {
        findings.push({
          message: `Liquidity is healthy: $${liquidity.toLocaleString()}`,
          severity: 'info',
          scoreOverride: 0,
        });
      }

      // -----------------------------------------------------------------------
      // Volume checks (< 1k = warning +15, < 10k = warning +10, >= 10k = info)
      // -----------------------------------------------------------------------
      const volume = pair.volume?.h24;
      if (volume !== undefined) {
        hasVolume = true;
        if (volume < TOKEN_THRESHOLDS.volumeVeryLow) {
          findings.push({
            message: `Very low 24h volume: $${volume.toLocaleString()}`,
            severity: 'medium',
            scoreOverride: 15,
          });
        } else if (volume < TOKEN_THRESHOLDS.volumeLow) {
          findings.push({
            message: `Low 24h trading volume: $${volume.toLocaleString()}`,
            severity: 'medium',
            scoreOverride: 10,
          });
        } else {
          findings.push({
            message: `24h trading volume is healthy: $${volume.toLocaleString()}`,
            severity: 'info',
            scoreOverride: 0,
          });
        }
      }

      // -----------------------------------------------------------------------
      // Price change checks — extreme pump + volatility micro-risk tiers
      // -----------------------------------------------------------------------
      const priceChange = pair.priceChange?.h24;
      if (priceChange !== undefined) {
        hasPriceChange = true;
        const absChange = Math.abs(priceChange);

        // Extreme pump (>200%) — danger, default severity (+60)
        if (priceChange > TOKEN_THRESHOLDS.priceChangeDangerous) {
          hasExtremePump = true;
          findings.push({
            message: `Extreme 24h price pump: +${priceChange.toFixed(1)}%`,
            severity: 'danger',
          });
          recommendations.push('Extreme price pumps are often followed by dumps — be very cautious');
        }

        // Volatility micro-risk tiers (abs-based, skip for extreme pump)
        if (!hasExtremePump) {
          if (absChange >= TOKEN_THRESHOLDS.volatilityHigh) {
            hasHighVolatility = true;
            findings.push({
              message: `Token shows high 24h volatility (±${absChange.toFixed(0)}%) — increased risk.`,
              severity: 'medium',
              scoreOverride: 10,
            });
            if (priceChange < TOKEN_THRESHOLDS.priceDropThreshold) {
              recommendations.push('Large price drops may indicate a rug pull or whale dumping');
            }
          } else if (absChange >= TOKEN_THRESHOLDS.volatilityModerate) {
            hasModerateVolatility = true;
            findings.push({
              message: `Token shows moderate 24h volatility (±${absChange.toFixed(0)}%) — increased risk.`,
              severity: 'info',
              scoreOverride: 5,
            });
          }
        }
      }

      // -----------------------------------------------------------------------
      // FDV vs Liquidity (FDV > 10M AND liquidity < 50k = warning +20)
      // -----------------------------------------------------------------------
      const fdv = pair.fdv || 0;
      if (fdv > TOKEN_THRESHOLDS.fdvHighThreshold && liquidity < TOKEN_THRESHOLDS.liquiditySuspicious) {
        findings.push({
          message: `FDV ($${fdv.toLocaleString()}) is very high relative to liquidity ($${liquidity.toLocaleString()}) — high rug pull risk`,
          severity: 'medium',
          scoreOverride: 20,
        });
        recommendations.push('A very high FDV with low liquidity means the token could crash easily');
      }

      // FDV very low check
      if (fdv < TOKEN_THRESHOLDS.fdvVeryLow && fdv > 0) {
        findings.push({
          message: `Very low fully diluted valuation: $${fdv.toLocaleString()}`,
          severity: 'low',
        });
      }

      // -------------------------------------------------------------------
      // GoPlus Token Security + Sourcify — requires chain ID from DexScreener
      // -------------------------------------------------------------------
      const goPlusChainId = CHAIN_ID_MAP[pair.chainId];
      if (goPlusChainId) {
        const [securityResult, verifyResult] = await Promise.allSettled([
          fetchTokenSecurity(address, goPlusChainId),
          fetchContractVerification(address, goPlusChainId),
        ]);

        // Process GoPlus token security
        if (securityResult.status === 'fulfilled' && securityResult.value.data) {
          const sec = securityResult.value.data;
          metadata.goPlusChecked = true;
          hasGoPlusData = true;

          metadata.isHoneypot = sec.is_honeypot === '1';
          metadata.isOpenSource = sec.is_open_source === '1';
          metadata.isMintable = sec.is_mintable === '1';
          metadata.hasHiddenOwner = sec.hidden_owner === '1';
          metadata.isProxy = sec.is_proxy === '1';
          metadata.canSelfDestruct = sec.selfdestruct === '1';
          metadata.isBlacklisted = sec.is_blacklisted === '1';
          metadata.transferPausable = sec.transfer_pausable === '1';
          metadata.slippageModifiable = sec.slippage_modifiable === '1';
          metadata.ownerAddress = sec.owner_address;
          if (sec.holder_count) metadata.holderCount = parseInt(sec.holder_count, 10);
          if (sec.buy_tax) metadata.buyTax = parseFloat(sec.buy_tax) * 100;
          if (sec.sell_tax) metadata.sellTax = parseFloat(sec.sell_tax) * 100;

          const isHoneypot = sec.is_honeypot === '1';

          if (isHoneypot) {
            hasHoneypot = true;
            findings.push({
              message: 'Token flagged as HONEYPOT by GoPlus — cannot sell',
              severity: 'danger',
              scoreOverride: 60,
            });
            recommendations.push('HONEYPOT: This token cannot be sold once purchased — do not buy');
          }

          // Tax findings — skip if honeypot (can't sell anyway)
          if (!isHoneypot) {
            const buyTaxPct = sec.buy_tax ? parseFloat(sec.buy_tax) * 100 : 0;
            const sellTaxPct = sec.sell_tax ? parseFloat(sec.sell_tax) * 100 : 0;

            if (sellTaxPct > GOPLUS_CONFIG.taxDangerous) {
              findings.push({
                message: `High sell tax: ${sellTaxPct.toFixed(1)}%`,
                severity: 'danger',
                scoreOverride: 50,
              });
            } else if (sellTaxPct > GOPLUS_CONFIG.taxSuspicious) {
              findings.push({
                message: `Elevated sell tax: ${sellTaxPct.toFixed(1)}%`,
                severity: 'medium',
                scoreOverride: 20,
              });
            }

            if (buyTaxPct > GOPLUS_CONFIG.taxDangerous) {
              findings.push({
                message: `High buy tax: ${buyTaxPct.toFixed(1)}%`,
                severity: 'danger',
                scoreOverride: 50,
              });
            } else if (buyTaxPct > GOPLUS_CONFIG.taxSuspicious) {
              findings.push({
                message: `Elevated buy tax: ${buyTaxPct.toFixed(1)}%`,
                severity: 'medium',
                scoreOverride: 20,
              });
            }
          }

          if (sec.is_open_source === '0') {
            findings.push({
              message: 'Contract source code is NOT verified/open source',
              severity: 'high',
            });
          }

          if (sec.is_mintable === '1') {
            findings.push({
              message: 'Token supply can be minted (increased) by owner',
              severity: 'medium',
            });
          }

          if (sec.hidden_owner === '1') {
            findings.push({
              message: 'Contract has a hidden owner',
              severity: 'high',
            });
          }

          if (sec.slippage_modifiable === '1') {
            findings.push({
              message: 'Token slippage can be modified by owner',
              severity: 'high',
            });
          }

          if (sec.transfer_pausable === '1') {
            findings.push({
              message: 'Token transfers can be paused by owner',
              severity: 'medium',
            });
          }

          if (sec.is_proxy === '1') {
            findings.push({
              message: 'Contract is a proxy — logic can be changed',
              severity: 'medium',
              scoreOverride: 15,
            });
          }

          if (sec.selfdestruct === '1') {
            findings.push({
              message: 'Contract contains selfdestruct — can be destroyed',
              severity: 'danger',
              scoreOverride: 50,
            });
          }

          if (sec.is_blacklisted === '1') {
            findings.push({
              message: 'Token uses a blacklist — your address could be blocked',
              severity: 'medium',
            });
          }

          // All clear
          const goPlusFlags = [
            sec.is_honeypot, sec.is_open_source === '0' ? '1' : '0',
            sec.is_mintable, sec.hidden_owner, sec.slippage_modifiable,
            sec.transfer_pausable, sec.is_proxy, sec.selfdestruct, sec.is_blacklisted,
          ];
          const hasAnyFlag = goPlusFlags.some(f => f === '1');
          const hasTaxIssue = (sec.buy_tax && parseFloat(sec.buy_tax) * 100 > GOPLUS_CONFIG.taxSuspicious)
            || (sec.sell_tax && parseFloat(sec.sell_tax) * 100 > GOPLUS_CONFIG.taxSuspicious);
          if (!hasAnyFlag && !hasTaxIssue) {
            findings.push({
              message: 'GoPlus security audit passed — no red flags detected',
              severity: 'info',
              scoreOverride: 0,
            });
          }
        }

        // Process Sourcify verification
        if (verifyResult.status === 'fulfilled' && verifyResult.value.isVerified !== null) {
          metadata.sourcifyVerified = verifyResult.value.isVerified;
          if (verifyResult.value.isVerified) {
            findings.push({
              message: 'Contract source code verified on Sourcify',
              severity: 'info',
              scoreOverride: 0,
            });
          } else {
            findings.push({
              message: 'Contract NOT verified on Sourcify',
              severity: 'low',
            });
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('abort')) {
      findings.push({
        message: 'DexScreener API request timed out — unable to verify token safety',
        severity: 'medium',
        scoreOverride: 35,
      });
    } else {
      findings.push({
        message: 'Could not fetch token data — external API unavailable',
        severity: 'medium',
        scoreOverride: 35,
      });
    }
    recommendations.push('Manually verify this token on DexScreener or a block explorer');
  }

  // Add general recommendations
  recommendations.push('Check if the contract is verified on the block explorer');
  recommendations.push('Look for locked liquidity before investing');
  recommendations.push('Never invest more than you can afford to lose');

  const { score, level, breakdown } = calculateRisk(findings);

  // Add government resource links for risky tokens
  if (level !== 'SAFE') {
    const topLinks = GOV_RESOURCE_LINKS.slice(0, 5).map(l => `${l.name} (${l.region}): ${l.url}`).join(' | ');
    recommendations.push(`Check government scam databases: ${topLinks}`);
  }

  // ---------------------------------------------------------------------------
  // Baseline risk floor — no token scan should return 0
  // ---------------------------------------------------------------------------
  const isVolatile = hasHighVolatility || hasModerateVolatility || hasExtremePump;
  let riskScore = score;

  if (level === 'SAFE') {
    riskScore = Math.max(5, riskScore);
  }
  if (isVolatile) {
    riskScore = Math.max(10, riskScore);
  }
  if (riskScore > score) {
    breakdown.push({
      label: isVolatile
        ? 'Baseline risk floor (price volatility detected)'
        : 'Baseline risk floor (no token is truly zero-risk)',
      scoreImpact: riskScore - score,
    });
  }

  // ---------------------------------------------------------------------------
  // Confidence — HIGH when full market data, MEDIUM when partial, LOW otherwise
  // ---------------------------------------------------------------------------
  const hasDanger = findings.some(f => f.severity === 'danger');
  let confidence: ConfidenceLevel;
  if (!hasDexData) {
    confidence = 'LOW';
  } else if (metadata.liquidityUsd !== undefined && hasVolume && hasPriceChange) {
    confidence = 'HIGH';
  } else if (metadata.liquidityUsd !== undefined) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  let confidenceReason: string;
  if (!hasDexData && hasDanger) {
    confidenceReason = 'No liquidity pairs found — cannot verify token legitimacy.';
  } else if (!hasDexData) {
    confidenceReason = 'Limited data available — could not retrieve live market information.';
  } else if (confidence === 'HIGH') {
    confidenceReason = `Live market data from DexScreener with ${findings.length} signals analyzed.`;
  } else {
    confidenceReason = `Partial market data available — some metrics could not be verified.`;
  }

  // Append GoPlus/Sourcify confidence notes
  if (hasGoPlusData) {
    confidenceReason += ' GoPlus security audit performed.';
  }
  if (metadata.sourcifyVerified !== undefined) {
    confidenceReason += ' Contract verification checked on Sourcify.';
  }

  // ---------------------------------------------------------------------------
  // Summary — signal-specific, matching risk level
  // ---------------------------------------------------------------------------
  let summary: string;
  const tokenLabel = metadata.name ? `${metadata.name} (${metadata.symbol})` : 'This token';

  if (hasHoneypot) {
    summary = `${tokenLabel} is a HONEYPOT — you will not be able to sell.`;
  } else if (!hasDexData && hasDanger) {
    summary = 'Token not listed on any DEX — extremely risky.';
  } else if (hasExtremePump) {
    summary = `${tokenLabel} shows extreme price volatility — possible manipulation.`;
  } else if (hasVeryLowLiquidity) {
    summary = `${tokenLabel} has dangerously low liquidity — likely a scam.`;
  } else if (level === 'DANGEROUS') {
    summary = `High-risk signals detected — avoid interacting.`;
  } else if (hasLowLiquidity) {
    summary = `${tokenLabel} has low liquidity and could be risky.`;
  } else if (level === 'SUSPICIOUS') {
    summary = 'Some suspicious patterns detected — review carefully.';
  } else if (isVolatile && metadata.name) {
    summary = `${tokenLabel} has strong liquidity, but price volatility is elevated.`;
  } else if (isVolatile) {
    summary = 'No major risk signals, but price volatility adds some risk.';
  } else {
    summary = metadata.name
      ? `${tokenLabel} has strong liquidity and healthy trading volume.`
      : 'No suspicious risk signals detected.';
  }

  // Next step
  let nextStep: string;
  if (level === 'DANGEROUS') {
    nextStep = 'Do not buy or interact with this token.';
  } else if (level === 'SUSPICIOUS') {
    nextStep = 'Research this token thoroughly before investing — check the contract, team, and community.';
  } else {
    nextStep = 'Always do your own research before investing in any token.';
  }

  return {
    inputType: 'token',
    inputValue: address,
    riskScore: riskScore,
    riskLevel: level,
    confidence,
    confidenceReason,
    summary,
    scoreBreakdown: breakdown,
    nextStep,
    findings,
    recommendations,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
