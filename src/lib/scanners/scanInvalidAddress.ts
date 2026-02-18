import { SafetyReport } from '@/types';

export async function scanInvalidAddress(input: string): Promise<SafetyReport> {
  return {
    inputType: 'invalidAddress',
    inputValue: input,
    riskScore: 70,
    riskLevel: 'DANGEROUS',
    confidence: 'HIGH',
    confidenceReason: 'Address failed cryptographic checksum validation.',
    summary: 'This is not a valid blockchain address (checksum failed).',
    scoreBreakdown: [
      { label: 'Invalid address format or checksum', scoreImpact: 70 },
    ],
    nextStep: 'Double-check the address for typos. If you copied it, try copying again from the source.',
    findings: [
      { message: 'Invalid address — checksum failed', severity: 'danger' },
      { message: 'Sending funds to an invalid address could result in permanent loss', severity: 'danger' },
    ],
    recommendations: [
      'Double-check the address before sending funds. Funds sent to invalid addresses cannot be recovered.',
      'Verify the address with the sender or original source',
      'Never manually type blockchain addresses — always copy and paste',
      'Check that you are using the correct blockchain network',
    ],
    timestamp: new Date().toISOString(),
  };
}
