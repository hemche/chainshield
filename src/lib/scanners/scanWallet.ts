import { SafetyReport, Finding, WalletMetadata, ConfidenceLevel } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { WALLET_EXPLORERS, GOV_RESOURCE_LINKS } from '@/config/rules';
import { fetchAddressSecurity } from '@/lib/apis/goplus';

export async function scanWallet(address: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: WalletMetadata = {};
  let hasGoPlusData = false;

  const trimmed = address.trim();

  // Basic validation
  if (!trimmed.startsWith('0x')) {
    findings.push({ message: 'Wallet address should start with 0x', severity: 'high' });
  }

  if (trimmed.length !== 42) {
    findings.push({
      message: `Invalid address length: ${trimmed.length} characters (expected 42)`,
      severity: 'high',
    });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    findings.push({ message: 'Address contains invalid characters', severity: 'high' });
  }

  const isValidFormat = findings.length === 0;

  if (isValidFormat) {
    findings.push({
      message: 'Wallet address format is valid',
      severity: 'low',
    });

    // Check if it might also be a token contract (try DexScreener)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${trimmed}`,
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          findings.push({
            message: 'This address is also a token contract with active trading pairs',
            severity: 'low',
          });
        }
      }
    } catch {
      // Silently ignore — this is a bonus check
    }

    // Provide explorer links
    metadata.explorerUrls = WALLET_EXPLORERS.map(e => ({
      name: e.name,
      url: `${e.url}${trimmed}`,
    }));

    metadata.chain = 'EVM-compatible (check explorers)';

    // -----------------------------------------------------------------
    // GoPlus malicious address check — query ETH + BSC in parallel
    // for broader coverage (different chains may have different flags)
    // -----------------------------------------------------------------
    try {
      const CHAINS_TO_CHECK = [
        { id: 1, name: 'Ethereum' },
        { id: 56, name: 'BSC' },
      ];

      const results = await Promise.allSettled(
        CHAINS_TO_CHECK.map(c => fetchAddressSecurity(trimmed, c.id))
      );

      // Merge flags from all chains (deduplicated)
      const flags: string[] = [];
      const flagSet = new Set<string>();

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { data: addrSec } = result.value;
        if (!addrSec) continue;

        hasGoPlusData = true;
        metadata.goPlusChecked = true;

        const checks: Array<{ key: string; label: string; severity: 'danger' | 'high'; override?: number }> = [
          { key: 'phishing_activities', label: 'phishing activities', severity: 'danger', override: 60 },
          { key: 'stealing_attack', label: 'token-stealing attacks', severity: 'danger', override: 60 },
          { key: 'money_laundering', label: 'money laundering', severity: 'danger', override: 60 },
          { key: 'sanctioned', label: 'a sanctions list', severity: 'danger', override: 60 },
          { key: 'honeypot_related_address', label: 'honeypot tokens', severity: 'danger', override: 50 },
          { key: 'blacklist_doubt', label: 'blacklists', severity: 'high' },
          { key: 'mixer', label: 'cryptocurrency mixer usage', severity: 'high' },
        ];

        for (const check of checks) {
          if ((addrSec as Record<string, string>)[check.key] === '1' && !flagSet.has(check.key)) {
            flagSet.add(check.key);
            flags.push(check.key);
            findings.push({
              message: `Address flagged for ${check.label} (GoPlus)`,
              severity: check.severity,
              ...(check.override ? { scoreOverride: check.override } : {}),
            });
          }
        }
      }

      if (hasGoPlusData) {
        metadata.goPlusFlags = flags;
        metadata.isFlagged = flags.length > 0;

        if (flags.length === 0) {
          findings.push({
            message: 'Address not flagged in GoPlus security database',
            severity: 'info',
            scoreOverride: 0,
          });
        }
      }
    } catch {
      // GoPlus unavailable — graceful degradation
    }
  }

  // Educational recommendations
  recommendations.push('Check this address on block explorers to see transaction history');
  recommendations.push('Use revoke.cash to review and revoke any token approvals granted to this address');
  recommendations.push('Be cautious if this address contacted you claiming to be support or offering free tokens');
  recommendations.push('Never share your private key or seed phrase with anyone');
  recommendations.push('If you suspect this address is associated with a scam, report it on the relevant block explorer');

  const { score, level, breakdown } = calculateRisk(findings);

  // Add government resource links for flagged wallets
  if (level !== 'SAFE') {
    const topLinks = GOV_RESOURCE_LINKS.slice(0, 5).map(l => `${l.name} (${l.region}): ${l.url}`).join(' | ');
    recommendations.push(`Check government scam databases: ${topLinks}`);
  }

  // Confidence — upgraded to HIGH when GoPlus data is available
  let confidence: ConfidenceLevel;
  let confidenceReason: string;

  if (hasGoPlusData && metadata.isFlagged) {
    confidence = 'HIGH';
    confidenceReason = 'Address flagged in GoPlus security database.';
  } else if (hasGoPlusData) {
    confidence = 'HIGH';
    confidenceReason = 'Address format validated and checked against GoPlus security database. No flags detected.';
  } else {
    confidence = 'MEDIUM';
    confidenceReason = 'Address format validated — no on-chain transaction history analyzed.';
  }

  // Summary
  let summary: string;
  if (metadata.isFlagged) {
    summary = 'WARNING: This wallet address is flagged for malicious activity.';
  } else if (isValidFormat && hasGoPlusData) {
    summary = 'Valid wallet address. No malicious activity flags detected in security databases.';
  } else if (isValidFormat) {
    summary = 'Valid wallet address format. Check block explorers for transaction history and approvals.';
  } else {
    summary = `Invalid wallet address — ${findings.length} format issue${findings.length > 1 ? 's' : ''} detected.`;
  }

  // Next step
  let nextStep: string;
  if (!isValidFormat) {
    nextStep = 'Double-check the wallet address for typos or missing characters.';
  } else {
    nextStep = 'Review this address on a block explorer and check for suspicious approvals using revoke.cash.';
  }

  return {
    inputType: 'wallet',
    inputValue: address,
    riskScore: score,
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
