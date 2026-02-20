import { SafetyReport, Finding, SolanaMetadata, ConfidenceLevel } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { TOKEN_THRESHOLDS } from '@/config/rules';

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

export async function scanSolanaToken(address: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: SolanaMetadata = { chain: 'Solana', mintAddress: address };
  let hasDexData = false;
  let hasVolume = false;
  let hasPriceChange = false;
  let hasExtremePump = false;
  let hasVeryLowLiquidity = false;
  let hasLowLiquidity = false;
  let hasHighVolatility = false;
  let hasModerateVolatility = false;

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

    const data: DexScreenerResponse = {
      pairs: Array.isArray(raw?.pairs) ? raw.pairs : null,
    };

    if (!data.pairs || data.pairs.length === 0) {
      findings.push({
        message: 'DexScreener returned no liquidity pairs — token may be unlisted or a scam',
        severity: 'danger',
        messageKey: 'no_liquidity_pairs',
      });
      recommendations.push('Do not interact with this token unless verified on a Solana explorer');
      recommendations.push('Verify the mint address on solscan.io or solana.fm');
      recommendations.push('Do not send funds to unverified contracts');
    } else {
      hasDexData = true;

      // Filter to Solana pairs only, use most liquid
      const solanaPairs = data.pairs.filter(p => p.chainId === 'solana');
      const pair = (solanaPairs.length > 0 ? solanaPairs : data.pairs).reduce((best, cur) =>
        (cur.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? cur : best
      );

      if (!pair.baseToken || !pair.chainId) {
        findings.push({
          message: 'Token data is incomplete — API returned unexpected format.',
          severity: 'medium',
        });
      } else {
        // Populate metadata
        metadata.name = pair.baseToken.name;
        metadata.symbol = pair.baseToken.symbol;
        metadata.dex = pair.dexId;
        metadata.liquidityUsd = pair.liquidity?.usd;
        metadata.fdv = pair.fdv;
        metadata.volume24h = pair.volume?.h24;
        metadata.priceUsd = pair.priceUsd;
        metadata.priceChange24h = pair.priceChange?.h24;
        metadata.pairAddress = pair.pairAddress;
        metadata.dexscreenerUrl = pair.url;
        metadata.pairCreatedAt = pair.pairCreatedAt;

        // --- Pair age analysis ---
        if (pair.pairCreatedAt) {
          const ageMs = Date.now() - pair.pairCreatedAt;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          metadata.pairAge = ageDays < 1
            ? `${Math.round(ageMs / (1000 * 60 * 60))} hours`
            : `${Math.round(ageDays)} days`;

          if (ageDays < TOKEN_THRESHOLDS.pairAgeDangerousDays) {
            findings.push({
              message: `Token pair created ${metadata.pairAge} ago — extremely new`,
              severity: 'danger',
              scoreOverride: 25,
              messageKey: 'solana_pair_very_new',
              messageParams: { age: metadata.pairAge },
            });
          } else if (ageDays < TOKEN_THRESHOLDS.pairAgeSuspiciousDays) {
            findings.push({
              message: `Token pair created ${metadata.pairAge} ago — very new`,
              severity: 'medium',
              scoreOverride: 15,
              messageKey: 'solana_pair_new',
              messageParams: { age: metadata.pairAge },
            });
          }
        }

        // --- Liquidity analysis ---
        const liq = pair.liquidity?.usd || 0;
        if (liq < TOKEN_THRESHOLDS.liquidityDangerous) {
          hasVeryLowLiquidity = true;
          findings.push({
            message: `Extremely low liquidity: $${liq.toLocaleString()} USD`,
            severity: 'danger',
            scoreOverride: 50,
            messageKey: 'solana_low_liquidity',
            messageParams: { amount: liq.toLocaleString() },
          });
        } else if (liq < TOKEN_THRESHOLDS.liquiditySuspicious) {
          hasLowLiquidity = true;
          findings.push({
            message: `Low liquidity: $${liq.toLocaleString()} USD`,
            severity: 'medium',
            scoreOverride: 25,
            messageKey: 'solana_moderate_liquidity',
            messageParams: { amount: liq.toLocaleString() },
          });
        }

        // --- Volume analysis ---
        const vol = pair.volume?.h24 || 0;
        if (vol < TOKEN_THRESHOLDS.volumeVeryLow) {
          hasVolume = true;
          findings.push({
            message: `Very low 24h volume: $${vol.toLocaleString()} USD`,
            severity: 'medium',
            scoreOverride: 15,
            messageKey: 'solana_low_volume',
            messageParams: { amount: vol.toLocaleString() },
          });
        } else if (vol < TOKEN_THRESHOLDS.volumeLow) {
          hasVolume = true;
          findings.push({
            message: `Low 24h volume: $${vol.toLocaleString()} USD`,
            severity: 'medium',
            scoreOverride: 10,
            messageKey: 'solana_moderate_volume',
            messageParams: { amount: vol.toLocaleString() },
          });
        }

        // --- Price change analysis ---
        const change = pair.priceChange?.h24;
        if (change !== undefined && change !== null) {
          hasPriceChange = true;

          if (change > TOKEN_THRESHOLDS.priceChangeDangerous) {
            hasExtremePump = true;
            findings.push({
              message: `Extreme price pump: +${change.toFixed(1)}% in 24h`,
              severity: 'danger',
              messageKey: 'solana_extreme_pump',
              messageParams: { change: change.toFixed(1) },
            });
          } else if (change > TOKEN_THRESHOLDS.priceChangeSuspicious || change < TOKEN_THRESHOLDS.priceDropThreshold) {
            findings.push({
              message: `Large price swing: ${change > 0 ? '+' : ''}${change.toFixed(1)}% in 24h`,
              severity: 'medium',
              scoreOverride: 10,
              messageKey: 'solana_large_swing',
              messageParams: { change: `${change > 0 ? '+' : ''}${change.toFixed(1)}` },
            });
          }

          const absChange = Math.abs(change);
          if (absChange > TOKEN_THRESHOLDS.volatilityHigh) {
            hasHighVolatility = true;
          } else if (absChange > TOKEN_THRESHOLDS.volatilityModerate) {
            hasModerateVolatility = true;
          }
        }

        // --- FDV vs Liquidity mismatch ---
        if (pair.fdv > TOKEN_THRESHOLDS.fdvHighThreshold && liq < TOKEN_THRESHOLDS.liquiditySuspicious) {
          findings.push({
            message: `High FDV ($${(pair.fdv / 1e6).toFixed(1)}M) with low liquidity ($${liq.toLocaleString()}) — exit liquidity risk`,
            severity: 'medium',
            scoreOverride: 20,
            messageKey: 'solana_high_fdv',
            messageParams: { fdv: `${(pair.fdv / 1e6).toFixed(1)}M`, liquidity: liq.toLocaleString() },
          });
        }

        // --- Low FDV info ---
        if (pair.fdv < TOKEN_THRESHOLDS.fdvVeryLow) {
          findings.push({
            message: `Very low FDV: $${pair.fdv.toLocaleString()}`,
            severity: 'low',
            messageKey: 'solana_low_fdv',
            messageParams: { amount: pair.fdv.toLocaleString() },
          });
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      findings.push({
        message: 'DexScreener API timed out — could not fetch token data',
        severity: 'medium',
        messageKey: 'solana_timeout',
      });
    } else {
      findings.push({
        message: 'Failed to fetch token data from DexScreener',
        severity: 'medium',
        messageKey: 'solana_fetch_failed',
      });
    }
    recommendations.push('Try scanning again — the data source may be temporarily unavailable');
  }

  // --- Recommendations ---
  if (hasDexData) {
    recommendations.push('Verify the token on solscan.io for detailed contract info');
    recommendations.push('Check if the token has a verified project on DexScreener');
    if (hasVeryLowLiquidity || hasLowLiquidity) {
      recommendations.push('Low liquidity tokens have high slippage — use small position sizes');
    }
    if (hasExtremePump) {
      recommendations.push('Extreme price pumps often precede dumps — exercise extreme caution');
    }
    if (hasVolume) {
      recommendations.push('Low volume makes it difficult to exit positions at fair price');
    }
  }

  recommendations.push('Never invest more than you can afford to lose');
  recommendations.push('Solana tokens cannot currently be checked for honeypot — verify on rugcheck.xyz');

  const { score, level, breakdown } = calculateRisk(findings);

  // Add government resource links for risky tokens
  if (level !== 'SAFE') {
    recommendations.push('Cross-check with government scam databases (DFPI, CFTC, SEC, FCA, ASIC, AMF) for additional verification');
  }

  // Baseline floor: SAFE tokens get at least 5; volatile ones get 10
  const isVolatile = hasHighVolatility || hasModerateVolatility || hasPriceChange;
  const floor = isVolatile ? 10 : 5;
  const finalScore = Math.max(floor, score);
  // Use calculateRisk's level (handles severity override) but adjust for floor
  const finalLevel = finalScore > score
    ? (finalScore > 60 ? 'DANGEROUS' : finalScore > 30 ? 'SUSPICIOUS' : 'SAFE')
    : level;
  const finalBreakdown = finalScore > score
    ? [...breakdown, { label: 'Baseline risk floor (Solana token)', scoreImpact: finalScore - score }]
    : breakdown;

  // Confidence
  let confidence: ConfidenceLevel = 'LOW';
  const reasons: string[] = [];
  if (hasDexData) {
    confidence = 'MEDIUM';
    reasons.push('DexScreener data available');
  } else {
    reasons.push('No DexScreener data found');
  }
  reasons.push('GoPlus not available for Solana tokens');
  const confidenceReason = reasons.join('. ') + '.';

  // Summary
  let summary: string;
  if (!hasDexData) {
    summary = 'No trading data found for this Solana token. It may be unlisted, a scam, or a wallet address.';
  } else if (finalLevel === 'DANGEROUS') {
    summary = `High-risk Solana token${metadata.symbol ? ` (${metadata.symbol})` : ''} — multiple danger signals detected.`;
  } else if (finalLevel === 'SUSPICIOUS') {
    summary = `Solana token${metadata.symbol ? ` (${metadata.symbol})` : ''} has some risk signals — proceed with caution.`;
  } else {
    summary = `Solana token${metadata.symbol ? ` (${metadata.symbol})` : ''} shows no major red flags based on available data.`;
  }

  // Next step
  let nextStep: string;
  if (!hasDexData) {
    nextStep = 'Verify this address on solscan.io to confirm it is a valid token.';
  } else if (finalLevel === 'DANGEROUS') {
    nextStep = 'Do NOT interact with this token until you have thoroughly verified it on multiple sources.';
  } else if (finalLevel === 'SUSPICIOUS') {
    nextStep = 'Check rugcheck.xyz for honeypot analysis before trading.';
  } else {
    nextStep = 'Check rugcheck.xyz for additional safety analysis before trading.';
  }

  // Checks performed
  const checksPerformed = [
    { label: 'DexScreener liquidity data', passed: hasDexData, detail: hasDexData ? 'Trading pair found' : 'No pairs found' },
    { label: 'Liquidity threshold check', passed: !hasVeryLowLiquidity && !hasLowLiquidity, detail: metadata.liquidityUsd !== undefined ? `$${metadata.liquidityUsd.toLocaleString()}` : 'N/A' },
    { label: '24h volume check', passed: !hasVolume, detail: metadata.volume24h !== undefined ? `$${metadata.volume24h.toLocaleString()}` : 'N/A' },
    { label: 'Price volatility check', passed: !hasExtremePump && !hasHighVolatility, detail: metadata.priceChange24h !== undefined ? `${metadata.priceChange24h > 0 ? '+' : ''}${metadata.priceChange24h.toFixed(1)}%` : 'N/A' },
  ];

  return {
    inputType: 'solanaToken',
    inputValue: address,
    riskScore: finalScore,
    riskLevel: finalLevel,
    confidence,
    confidenceReason,
    summary,
    scoreBreakdown: finalBreakdown,
    nextStep,
    findings,
    recommendations,
    checksPerformed,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
