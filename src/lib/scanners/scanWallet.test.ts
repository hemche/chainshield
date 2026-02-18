import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanWallet } from './scanWallet';
import { SafetyReport, WalletMetadata } from '@/types';

// Mock GoPlus module to prevent real API calls.
vi.mock('@/lib/apis/goplus', () => ({
  fetchAddressSecurity: vi.fn().mockResolvedValue({ data: null, error: 'mocked' }),
}));

import { fetchAddressSecurity } from '@/lib/apis/goplus';

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('mocked network error')),
  );
  vi.mocked(fetchAddressSecurity).mockResolvedValue({ data: null, error: 'mocked' });
});

function allFindings(report: SafetyReport): string {
  return report.findings.map((f) => f.message).join(' | ');
}

// =========================================================================
// 1) Basic format validation
// =========================================================================
describe('Wallet format validation', () => {
  it('valid EVM address — SAFE with low finding', async () => {
    const report = await scanWallet(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.inputType).toBe('wallet');
    expect(allFindings(report)).toContain('Wallet address format is valid');
  });

  it('missing 0x prefix — high finding', async () => {
    const report = await scanWallet('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045');

    expect(allFindings(report)).toContain('should start with 0x');
  });

  it('wrong length — high finding', async () => {
    const report = await scanWallet('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604');

    expect(allFindings(report)).toContain('Invalid address length');
  });

  it('invalid characters — high finding', async () => {
    const report = await scanWallet('0xGGGG6BF26964aF9D7eEd9e03E53415D37aA96045');

    expect(allFindings(report)).toContain('invalid characters');
  });
});

// =========================================================================
// 2) Report structure
// =========================================================================
describe('Report structure', () => {
  it('returns valid SafetyReport shape', async () => {
    const report = await scanWallet(VALID_ADDRESS);

    expect(report.inputType).toBe('wallet');
    expect(report.inputValue).toBe(VALID_ADDRESS);
    expect(typeof report.riskScore).toBe('number');
    expect(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).toContain(report.riskLevel);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(report.confidence);
    expect(typeof report.summary).toBe('string');
  });

  it('includes explorer URLs for valid address', async () => {
    const report = await scanWallet(VALID_ADDRESS);
    const meta = report.metadata as WalletMetadata;

    expect(meta.explorerUrls).toBeDefined();
    expect(meta.explorerUrls!.length).toBe(6);
    expect(meta.explorerUrls!.map(e => e.name)).toContain('Etherscan');
    expect(meta.explorerUrls!.map(e => e.name)).toContain('BaseScan');
  });
});

// =========================================================================
// 3) GoPlus Malicious Address Integration
// =========================================================================
describe('GoPlus malicious address check', () => {
  it('clean address — HIGH confidence, info finding', async () => {
    const cleanData = {
      data: {
        phishing_activities: '0',
        honeypot_related_address: '0',
        stealing_attack: '0',
        blacklist_doubt: '0',
        money_laundering: '0',
        sanctioned: '0',
        mixer: '0',
      },
      error: null,
    };
    // Mock both ETH and BSC chain checks
    vi.mocked(fetchAddressSecurity).mockResolvedValueOnce(cleanData).mockResolvedValueOnce(cleanData);

    const report = await scanWallet(VALID_ADDRESS);
    const meta = report.metadata as WalletMetadata;

    expect(meta.goPlusChecked).toBe(true);
    expect(meta.isFlagged).toBe(false);
    expect(meta.goPlusFlags).toEqual([]);
    expect(report.confidence).toBe('HIGH');
    expect(report.summary).toContain('No malicious activity flags');

    const finding = report.findings.find(f => f.message.includes('not flagged'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('phishing address — DANGEROUS, danger finding', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({ data: { phishing_activities: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);
    const meta = report.metadata as WalletMetadata;

    expect(meta.isFlagged).toBe(true);
    expect(meta.goPlusFlags).toContain('phishing_activities');
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.summary).toContain('flagged for malicious activity');

    const finding = report.findings.find(f => f.message.includes('phishing activities'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('danger');
  });

  it('sanctioned address — DANGEROUS', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({ data: { sanctioned: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(allFindings(report)).toContain('sanctions list');
  });

  it('money laundering address — DANGEROUS', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({ data: { money_laundering: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(allFindings(report)).toContain('money laundering');
  });

  it('stealing attack address — DANGEROUS', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({ data: { stealing_attack: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(allFindings(report)).toContain('token-stealing attacks');
  });

  it('mixer usage — high finding (not danger)', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({ data: { mixer: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('mixer'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('multiple flags — all findings present', async () => {
    vi.mocked(fetchAddressSecurity)
      .mockResolvedValueOnce({
        data: { phishing_activities: '1', sanctioned: '1', mixer: '1' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: 'mocked' });

    const report = await scanWallet(VALID_ADDRESS);
    const meta = report.metadata as WalletMetadata;

    expect(meta.goPlusFlags!.length).toBe(3);
    expect(report.riskLevel).toBe('DANGEROUS');

    const findings = allFindings(report);
    expect(findings).toContain('phishing');
    expect(findings).toContain('sanctions');
    expect(findings).toContain('mixer');
  });

  it('GoPlus failure — graceful degradation, MEDIUM confidence', async () => {
    // Default mock returns null (error)

    const report = await scanWallet(VALID_ADDRESS);
    const meta = report.metadata as WalletMetadata;

    expect(meta.goPlusChecked).toBeUndefined();
    expect(report.confidence).toBe('MEDIUM');

    // No GoPlus findings
    const goPlusFinding = report.findings.find(f => f.message.includes('GoPlus'));
    expect(goPlusFinding).toBeUndefined();
  });

  it('GoPlus not called for invalid address', async () => {
    const report = await scanWallet('0xinvalid');

    expect(report.confidence).toBe('MEDIUM');
    // fetchAddressSecurity should not have been called with new value
    const meta = report.metadata as WalletMetadata;
    expect(meta.goPlusChecked).toBeUndefined();
  });
});
