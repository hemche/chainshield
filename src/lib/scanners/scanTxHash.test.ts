import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanTxHash } from './scanTxHash';
import { SafetyReport, TxMetadata } from '@/types';

// ---------------------------------------------------------------------------
// Mock global fetch — chain detection uses fetch for HEAD requests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('mocked network error')),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_TX_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

function allFindings(report: SafetyReport): string {
  return report.findings.map((f) => f.message).join(' | ');
}

// =========================================================================
// 1) Valid Transaction Hash
// =========================================================================
describe('Valid transaction hash', () => {
  it('accepts a valid 66-char hex hash', async () => {
    const report = await scanTxHash(VALID_TX_HASH);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThan(30);

    const findings = allFindings(report);
    expect(findings).toMatch(/format is valid/i);
  });

  it('populates explorer links in metadata', async () => {
    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.explorerUrl).toContain('etherscan.io');
    expect(meta.explorerUrl).toContain('bscscan.com');
    expect(meta.explorerUrl).toContain('polygonscan.com');
    expect(meta.explorerUrl).toContain('arbiscan.io');
    expect(meta.explorerUrl).toContain(VALID_TX_HASH);
  });

  it('sets chain to Unknown when chain detection fails', async () => {
    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.chain).toMatch(/[Uu]nknown/);
  });

  it('always includes safety recommendations', async () => {
    const report = await scanTxHash(VALID_TX_HASH);
    const recs = report.recommendations.join(' ');

    expect(recs).toMatch(/token approvals/i);
    expect(recs).toMatch(/spender/i);
    expect(recs).toMatch(/revoke/i);
    expect(recs).toMatch(/approve/i);
  });
});

// =========================================================================
// 2) Auto Chain Detection
// =========================================================================
describe('Auto chain detection', () => {
  it('detects Ethereum chain when etherscan responds with 200', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('etherscan.io')) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.detectedChain).toBe('Ethereum');
    expect(meta.chain).toBe('Ethereum');
    expect(report.confidence).toBe('MEDIUM');
  });

  it('detects BSC chain when bscscan responds with 200', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('bscscan.com')) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.detectedChain).toBe('BSC');
    expect(meta.chain).toBe('BSC');
  });

  it('falls back to Unknown when all explorers return 404', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.detectedChain).toBeUndefined();
    expect(meta.chain).toMatch(/[Uu]nknown/);
    expect(report.confidence).toBe('LOW');
  });

  it('falls back to Unknown when fetch throws', async () => {
    // Default mock already rejects — just verify behavior
    const report = await scanTxHash(VALID_TX_HASH);
    const meta = report.metadata as TxMetadata;

    expect(meta.detectedChain).toBeUndefined();
    expect(meta.chain).toMatch(/[Uu]nknown/);
  });
});

// =========================================================================
// 3) Missing 0x Prefix
// =========================================================================
describe('Missing 0x prefix', () => {
  it('flags hash without 0x', async () => {
    const report = await scanTxHash(
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );

    expect(report.riskScore).toBeGreaterThan(0);

    const findings = allFindings(report);
    expect(findings).toMatch(/should start with 0x/i);
  });
});

// =========================================================================
// 4) Wrong Length
// =========================================================================
describe('Wrong hash length', () => {
  it('flags hash that is too short', async () => {
    const report = await scanTxHash('0xabcdef1234');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid hash length/i);
  });

  it('flags hash that is too long', async () => {
    const report = await scanTxHash(VALID_TX_HASH + 'ff');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid hash length/i);
  });
});

// =========================================================================
// 5) Non-Hex Characters
// =========================================================================
describe('Non-hex characters', () => {
  it('flags hash with non-hex characters', async () => {
    const report = await scanTxHash(
      '0xZZZZZZ1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );

    const findings = allFindings(report);
    expect(findings).toMatch(/invalid characters/i);
  });
});

// =========================================================================
// 6) Completely Invalid Input
// =========================================================================
describe('Completely invalid input', () => {
  it('handles empty string without crashing', async () => {
    const report = await scanTxHash('');

    expect(report).toBeDefined();
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it('handles random text without crashing', async () => {
    const report = await scanTxHash('not-a-hash-at-all');

    expect(report).toBeDefined();
    expect(report.riskScore).toBeGreaterThan(0);
  });

  it('does not crash on very long input', async () => {
    const report = await scanTxHash('0x' + 'a'.repeat(1000));

    expect(report).toBeDefined();
    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid hash length/i);
  });
});

// =========================================================================
// 7) Whitespace Handling
// =========================================================================
describe('Whitespace handling', () => {
  it('trims leading/trailing whitespace', async () => {
    const report = await scanTxHash(`  ${VALID_TX_HASH}  `);

    expect(report.riskLevel).toBe('SAFE');
    const findings = allFindings(report);
    expect(findings).toMatch(/format is valid/i);
  });
});

// =========================================================================
// 8) Report Structure
// =========================================================================
describe('Report structure', () => {
  it('returns a valid SafetyReport shape', async () => {
    const report = await scanTxHash(VALID_TX_HASH);

    expect(report.inputType).toBe('txHash');
    expect(report.inputValue).toBe(VALID_TX_HASH);
    expect(typeof report.riskScore).toBe('number');
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);
    expect(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).toContain(report.riskLevel);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(typeof report.timestamp).toBe('string');
    // New fields
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(report.confidence);
    expect(typeof report.confidenceReason).toBe('string');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.scoreBreakdown)).toBe(true);
    expect(typeof report.nextStep).toBe('string');
  });
});
