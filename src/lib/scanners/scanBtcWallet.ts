import { SafetyReport, Finding, WalletMetadata } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { BTC_EXPLORERS } from '@/config/rules';
import { isBitcoinAddress } from './detectInput';
import { checkBlocklist } from './checkBlocklist';

function getBtcAddressType(address: string): string {
  if (address.startsWith('bc1')) return 'Bech32 (SegWit)';
  if (address.startsWith('3')) return 'P2SH';
  if (address.startsWith('1')) return 'Legacy (P2PKH)';
  return 'Unknown';
}

export async function scanBtcWallet(address: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: WalletMetadata = {};

  const trimmed = address.trim();

  // Blocklist check
  const blocklistMatch = checkBlocklist(trimmed);
  if (blocklistMatch) {
    findings.push({
      message: `This address is flagged as: ${blocklistMatch.label} (source: ${blocklistMatch.source})`,
      severity: 'danger',
    });
    metadata.isFlagged = true;
  }

  // Format validation
  const isValid = isBitcoinAddress(trimmed);

  if (!isValid) {
    findings.push({ message: 'Invalid Bitcoin address format', severity: 'high' });
  } else {
    const addrType = getBtcAddressType(trimmed);
    findings.push({
      message: `Valid ${addrType} Bitcoin address`,
      severity: 'info',
      scoreOverride: 0,
    });

    // Explorer links
    metadata.explorerUrls = BTC_EXPLORERS.map(e => ({
      name: e.name,
      url: `${e.url}${trimmed}`,
    }));

    metadata.chain = 'Bitcoin';
  }

  // General recommendations
  recommendations.push('Verify this address on a Bitcoin block explorer before sending funds');
  recommendations.push('Never share your private key or seed phrase with anyone');
  recommendations.push('Double-check the full address before every transaction — Bitcoin transactions are irreversible');

  const { score, level, breakdown } = calculateRisk(findings);

  // Baseline floor: valid BTC addresses get minimum score of 5
  let riskScore = score;
  if (isValid && riskScore < 5) {
    breakdown.push({
      label: 'Baseline risk floor (no address is truly zero-risk)',
      scoreImpact: 5 - riskScore,
    });
    riskScore = 5;
  }

  const confidence = isValid ? 'MEDIUM' as const : 'LOW' as const;
  const confidenceReason = isValid
    ? 'Valid Bitcoin address format — no on-chain data analyzed.'
    : 'Address format validation failed.';

  let summary: string;
  if (isValid) {
    summary = 'This appears to be a valid Bitcoin address. No scam patterns detected.';
  } else {
    summary = `Invalid Bitcoin address — format validation failed.`;
  }

  const nextStep = isValid
    ? 'Verify this address on a block explorer to check transaction history before sending funds.'
    : 'Double-check the address for typos or missing characters.';

  return {
    inputType: 'btcWallet',
    inputValue: address,
    riskScore,
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
