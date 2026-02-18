import { SafetyReport, Finding, TxMetadata } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { TX_EXPLORERS } from '@/config/rules';

const CHAIN_DETECT_ENDPOINTS = [
  { chain: 'Ethereum', url: (h: string) => `https://etherscan.io/tx/${h}` },
  { chain: 'BSC', url: (h: string) => `https://bscscan.com/tx/${h}` },
  { chain: 'Polygon', url: (h: string) => `https://polygonscan.com/tx/${h}` },
  { chain: 'Arbitrum', url: (h: string) => `https://arbiscan.io/tx/${h}` },
];

async function detectChain(hash: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const results = await Promise.allSettled(
      CHAIN_DETECT_ENDPOINTS.map(async (endpoint) => {
        const response = await fetch(endpoint.url(hash), {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        // A 200 response suggests the tx exists on this chain
        if (response.ok) {
          return endpoint.chain;
        }
        return null;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
  } catch {
    // Timeout or network failure — fall through to return null
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

export async function scanTxHash(hash: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: TxMetadata = {};

  const trimmed = hash.trim();

  // --- Validation checks ---

  if (!trimmed.startsWith('0x')) {
    findings.push({ message: 'Transaction hash should start with 0x', severity: 'high' });
  }

  if (trimmed.length !== 66) {
    findings.push({
      message: `Invalid hash length: ${trimmed.length} characters (expected 66)`,
      severity: 'high',
    });
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    findings.push({ message: 'Transaction hash contains invalid characters', severity: 'high' });
  }

  // --- Valid hash path ---

  const isValidFormat = findings.length === 0;

  if (isValidFormat) {
    findings.push({
      message: 'Transaction hash format is valid',
      severity: 'low',
    });

    // Auto chain detection via explorer HEAD requests
    const detectedChain = await detectChain(trimmed);
    if (detectedChain) {
      metadata.detectedChain = detectedChain;
      metadata.chain = detectedChain;
    } else {
      metadata.chain = 'Unknown chain — verify on explorers below';
    }

    // Provide explorer links for manual verification
    metadata.explorerUrl = TX_EXPLORERS
      .map(e => `${e.name}: ${e.prefix}${trimmed}`)
      .join('\n');
  }

  // --- Safety recommendations (always shown) ---

  recommendations.push('Verify the transaction on a block explorer to see full details');
  recommendations.push('Check if the transaction involves token approvals — revoke unlimited approvals');
  recommendations.push('Verify the spender address is a known, legitimate contract');
  recommendations.push('Look for "approve" or "setApprovalForAll" function calls — these grant spending permission');
  recommendations.push('If you see an unfamiliar contract, do not interact further');
  recommendations.push('Use revoke.cash to check and revoke token approvals');
  recommendations.push('Paste any wallet address from this transaction into ChainShield to check it against security databases');

  const { score, level, breakdown } = calculateRisk(findings);

  // Confidence: LOW for tx hashes since we can only validate format + detect chain
  const confidence = metadata.detectedChain ? 'MEDIUM' : 'LOW';
  const confidenceReason = metadata.detectedChain
    ? `Transaction found on ${metadata.detectedChain}. Format validation passed.`
    : 'Only format validation was performed — no on-chain data analyzed.';

  // Summary
  let summary: string;
  if (isValidFormat) {
    summary = metadata.detectedChain
      ? `Valid transaction hash detected on ${metadata.detectedChain}. Verify details on the block explorer.`
      : 'Valid transaction hash format. Verify on a block explorer to see full details.';
  } else {
    summary = `Invalid transaction hash — ${findings.length} format issue${findings.length > 1 ? 's' : ''} detected.`;
  }

  // Next step
  let nextStep: string;
  if (!isValidFormat) {
    nextStep = 'Double-check the transaction hash for typos or missing characters.';
  } else if (metadata.detectedChain) {
    nextStep = `View this transaction on ${metadata.detectedChain} block explorer for full details.`;
  } else {
    nextStep = 'Check this hash on multiple block explorers to find the correct chain.';
  }

  return {
    inputType: 'txHash',
    inputValue: hash,
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
