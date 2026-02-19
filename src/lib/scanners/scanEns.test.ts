import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanEns } from './scanEns';

// Mock ENS resolver
vi.mock('@/lib/apis/ens', () => ({
  resolveEnsName: vi.fn(),
}));

// Mock GoPlus to prevent real API calls from scanWallet
vi.mock('@/lib/apis/goplus', () => ({
  fetchAddressSecurity: vi.fn().mockResolvedValue(null),
}));

import { resolveEnsName } from '@/lib/apis/ens';

const mockResolveEnsName = vi.mocked(resolveEnsName);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: mock fetch for scanWallet's DexScreener call
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ pairs: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

describe('scanEns', () => {
  it('returns resolved wallet report for valid ENS name', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      error: null,
    });

    const report = await scanEns('vitalik.eth');

    expect(report.inputType).toBe('ens');
    expect(report.inputValue).toBe('vitalik.eth');
    expect(report.riskLevel).toBeDefined();
    // Should have ENS resolution finding prepended
    expect(report.findings[0].message).toContain('resolves to');
    expect(report.findings[0].message).toContain('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(report.findings[0].severity).toBe('info');
  });

  it('returns SUSPICIOUS report when ENS resolution fails', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: null,
      error: 'ENS name does not resolve to an address',
    });

    const report = await scanEns('nonexistent.eth');

    expect(report.inputType).toBe('ens');
    expect(report.riskLevel).toBe('SUSPICIOUS');
    expect(report.riskScore).toBe(50);
    expect(report.confidence).toBe('LOW');
    expect(report.findings.some(f => f.message.includes('resolution failed'))).toBe(true);
  });

  it('includes ENS metadata with resolved address', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xABC123',
      error: null,
    });

    const report = await scanEns('test.eth');
    const meta = report.metadata as { ensName: string; resolvedAddress: string; resolutionStatus: string };

    expect(meta.ensName).toBe('test.eth');
    expect(meta.resolvedAddress).toBe('0xABC123');
    expect(meta.resolutionStatus).toBe('resolved');
  });

  it('includes ENS metadata with error on failure', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: null,
      error: 'ENS resolution timed out',
    });

    const report = await scanEns('timeout.eth');
    const meta = report.metadata as { ensName: string; resolutionStatus: string; resolutionError: string };

    expect(meta.ensName).toBe('timeout.eth');
    expect(meta.resolutionStatus).toBe('failed');
    expect(meta.resolutionError).toContain('timed out');
  });

  it('adds ENS ownership verification recommendation', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xABC123',
      error: null,
    });

    const report = await scanEns('check.eth');
    expect(report.recommendations.some(r => r.includes('app.ens.domains'))).toBe(true);
  });

  it('normalizes ENS name to lowercase', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xABC123',
      error: null,
    });

    const report = await scanEns('UPPERCASE.ETH');
    const meta = report.metadata as { ensName: string };
    expect(meta.ensName).toBe('uppercase.eth');
  });

  it('preserves original input value in report', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xABC123',
      error: null,
    });

    const report = await scanEns('  MyName.eth  ');
    // inputValue preserves original (with spaces), ensName is normalized
    expect(report.inputValue).toBe('  MyName.eth  ');
  });

  it('forwards wallet findings after ENS resolution finding', async () => {
    mockResolveEnsName.mockResolvedValueOnce({
      address: '0xABC123',
      error: null,
    });

    const report = await scanEns('wallet.eth');
    // First finding should be ENS resolution info
    expect(report.findings[0].severity).toBe('info');
    expect(report.findings[0].scoreOverride).toBe(0);
    // Should have wallet-related findings after
    expect(report.findings.length).toBeGreaterThan(1);
  });
});
