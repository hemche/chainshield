import { SafetyReport, EnsMetadata, WalletMetadata } from '@/types';
import { resolveEnsName } from '@/lib/apis/ens';
import { scanWallet } from './scanWallet';

export async function scanEns(ensName: string): Promise<SafetyReport> {
  const normalized = ensName.trim().toLowerCase();

  // Step 1: Resolve ENS name to Ethereum address
  const { address, error } = await resolveEnsName(normalized);

  // Step 2: If resolution failed, return a report with the error
  if (!address) {
    return {
      inputType: 'ens',
      inputValue: ensName,
      riskScore: 50,
      riskLevel: 'SUSPICIOUS',
      confidence: 'LOW',
      confidenceReason: 'ENS name could not be resolved — unable to scan the underlying wallet.',
      summary: `Could not resolve "${normalized}" to an Ethereum address.`,
      scoreBreakdown: [
        { label: 'ENS resolution failed', scoreImpact: 15 },
        { label: 'Unable to verify underlying wallet', scoreImpact: 15 },
      ],
      nextStep: 'Verify the ENS name is spelled correctly and currently registered at app.ens.domains.',
      findings: [
        { message: `ENS resolution failed: ${error}`, severity: 'medium', messageKey: 'ens_failed', messageParams: { error: error ?? 'Unknown error' } },
        { message: 'Cannot assess wallet risk without a resolved address', severity: 'medium', messageKey: 'ens_no_address' },
      ],
      recommendations: [
        'Double-check the ENS name spelling',
        'Verify the name is registered at app.ens.domains',
        'If this name was shared with you, be cautious — it may be intentionally misspelled',
        'Never share your private key or seed phrase with anyone',
      ],
      metadata: {
        ensName: normalized,
        resolvedAddress: '',
        resolutionStatus: 'failed',
        resolutionError: error ?? 'Unknown error',
      } as EnsMetadata,
      timestamp: new Date().toISOString(),
    };
  }

  // Step 3: Delegate to wallet scanner with resolved address
  const walletReport = await scanWallet(address);
  const walletMeta = (walletReport.metadata ?? {}) as WalletMetadata;

  // Step 4: Build ENS metadata by forwarding wallet metadata fields
  const ensMetadata: EnsMetadata = {
    ensName: normalized,
    resolvedAddress: address,
    resolutionStatus: 'resolved',
    chain: walletMeta.chain,
    explorerUrls: walletMeta.explorerUrls,
    goPlusFlags: walletMeta.goPlusFlags,
    goPlusChecked: walletMeta.goPlusChecked,
    isFlagged: walletMeta.isFlagged,
  };

  // Step 5: Prepend ENS resolution finding
  const ensFindings = [
    {
      message: `ENS name "${normalized}" resolves to ${address}`,
      severity: 'info' as const,
      scoreOverride: 0,
      messageKey: 'ens_resolved',
      messageParams: { name: normalized, address },
    },
    ...walletReport.findings,
  ];

  // Step 6: Add ENS-specific recommendation
  const ensRecommendations = [
    `Verify ENS ownership at app.ens.domains/name/${normalized}`,
    ...walletReport.recommendations,
  ];

  return {
    ...walletReport,
    inputType: 'ens',
    inputValue: ensName,
    findings: ensFindings,
    recommendations: ensRecommendations,
    metadata: ensMetadata,
  };
}
