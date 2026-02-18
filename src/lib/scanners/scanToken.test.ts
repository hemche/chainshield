import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanToken } from './scanToken';
import { SafetyReport, TokenMetadata } from '@/types';

// Mock GoPlus and Sourcify modules to prevent real API calls and fetch mock consumption.
// Default: API unavailable (graceful degradation).
vi.mock('@/lib/apis/goplus', () => ({
  fetchTokenSecurity: vi.fn().mockResolvedValue({ data: null, error: 'mocked' }),
}));
vi.mock('@/lib/apis/sourcify', () => ({
  fetchContractVerification: vi.fn().mockResolvedValue({ isVerified: null, error: 'mocked' }),
}));

import { fetchTokenSecurity } from '@/lib/apis/goplus';
import { fetchContractVerification } from '@/lib/apis/sourcify';

// ---------------------------------------------------------------------------
// Helpers — build a mock DexScreener response
// ---------------------------------------------------------------------------
const VALID_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

function makePair(overrides: Record<string, unknown> = {}) {
  return {
    chainId: 'ethereum',
    dexId: 'uniswap',
    pairAddress: '0xPAIR',
    url: 'https://dexscreener.com/ethereum/0xPAIR',
    baseToken: { address: VALID_ADDRESS, name: 'TestToken', symbol: 'TST' },
    quoteToken: { name: 'WETH', symbol: 'WETH' },
    priceUsd: '1.23',
    priceChange: { h24: 2.5 },
    liquidity: { usd: 500_000 },
    fdv: 5_000_000,
    volume: { h24: 120_000 },
    pairCreatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days old
    ...overrides,
  };
}

function mockFetchJson(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function allFindings(report: SafetyReport): string {
  return report.findings.map((f) => f.message).join(' | ');
}

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('unmocked fetch')),
  );
  vi.mocked(fetchTokenSecurity).mockResolvedValue({ data: null, error: 'mocked' });
  vi.mocked(fetchContractVerification).mockResolvedValue({ isVerified: null, error: 'mocked' });
});

// =========================================================================
// 1) Safe Token (Case D — Healthy token)
// =========================================================================
describe('Safe token (high liquidity, decent volume, stable price)', () => {
  it('returns SAFE with score <= 30', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(30);
    expect(report.inputType).toBe('token');
    expect(report.inputValue).toBe(VALID_ADDRESS);
  });

  it('populates metadata correctly including new fields', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.name).toBe('TestToken');
    expect(meta.symbol).toBe('TST');
    expect(meta.chain).toBe('Ethereum');
    expect(meta.chainId).toBe('ethereum');
    expect(meta.dex).toBe('uniswap');
    expect(meta.liquidityUsd).toBe(500_000);
    expect(meta.volume24h).toBe(120_000);
    expect(meta.pairAddress).toBe('0xPAIR');
    expect(meta.priceUsd).toBe('1.23');
    expect(meta.dexscreenerUrl).toBe('https://dexscreener.com/ethereum/0xPAIR');
    expect(meta.pairCreatedAt).toBeDefined();
  });

  it('picks the most liquid pair when multiple are returned', async () => {
    mockFetchJson({
      pairs: [
        makePair({ liquidity: { usd: 10_000 }, dexId: 'low-liq-dex' }),
        makePair({ liquidity: { usd: 1_000_000 }, dexId: 'high-liq-dex' }),
      ],
    });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.liquidityUsd).toBe(1_000_000);
    expect(meta.dex).toBe('high-liq-dex');
  });

  it('has HIGH confidence with full DEX data (liquidity + volume + priceChange)', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('HIGH');
    expect(report.confidenceReason).toContain('Live market data');
  });

  it('summary reflects safe status with token name', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.summary).toContain('strong liquidity');
    expect(report.summary).toContain('healthy trading volume');
  });

  it('Case D: healthy token scores <= 30 with HIGH confidence', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 500_000 },
        volume: { h24: 250_000 },
        priceChange: { h24: 2 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(30);
    expect(report.confidence).toBe('HIGH');
  });
});

// =========================================================================
// 2) Suspicious Token (Case C — Medium risk)
// =========================================================================
describe('Suspicious token (low liquidity, low volume)', () => {
  it('returns SUSPICIOUS for liquidity between 5k and 50k', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 25_000 },
        volume: { h24: 500 },
        priceChange: { h24: 5 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SUSPICIOUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(31);
    expect(report.riskScore).toBeLessThanOrEqual(60);

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ll]ow liquidity/i);
    expect(findings).toMatch(/[Ll]ow.*volume/i);
  });

  it('Case C: medium risk token scores 35-60', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 20_000 },
        volume: { h24: 2_000 },
        priceChange: { h24: 5 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    // liquidity 20k < 50k → +25, volume 2k < 10k → +10 = 35
    expect(report.riskLevel).toBe('SUSPICIOUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(35);
    expect(report.riskScore).toBeLessThanOrEqual(60);
  });

  it('flags high volatility (50–200%)', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 100_000 },
        priceChange: { h24: 120 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).toMatch(/high.*volatility/i);
  });

  it('flags very new pair (1-3 days)', async () => {
    mockFetchJson({
      pairs: [makePair({
        pairCreatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).toMatch(/very new/i);
  });

  it('MEDIUM confidence when volume is missing', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 100_000 },
        volume: undefined,
        priceChange: { h24: 5 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    // liquidity present, volume missing → MEDIUM
    expect(report.confidence).toBe('MEDIUM');
  });
});

// =========================================================================
// 3) Dangerous Token (Case B — Low liquidity scam)
// =========================================================================
describe('Dangerous token (very low liquidity, extreme signals)', () => {
  it('Case B: low liquidity scam token — DANGEROUS, score >= 70', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 3_000 },
        volume: { h24: 200 },
        priceChange: { h24: 5 },
        pairCreatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days old
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(70);

    const findings = allFindings(report);
    expect(findings).toMatch(/[Dd]angerously low liquidity/i);
    expect(findings).toMatch(/[Vv]ery low.*volume/i);
  });

  it('Case E: extreme pump token — DANGEROUS with danger finding', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 60_000 },
        volume: { h24: 100_000 },
        priceChange: { h24: 400 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ee]xtreme.*pump/i);

    const dangerFinding = report.findings.find(f => f.severity === 'danger');
    expect(dangerFinding).toBeDefined();
    expect(dangerFinding!.message).toMatch(/[Ee]xtreme/i);

    expect(report.summary).toContain('extreme price volatility');
  });

  it('flags extreme price drop via high volatility', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 3_000 },
        priceChange: { h24: -80 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).toMatch(/high.*volatility/i);
    expect(report.recommendations.join(' ')).toMatch(/rug pull/i);
  });

  it('flags extremely new pair (< 1 day) as danger', async () => {
    mockFetchJson({
      pairs: [makePair({
        pairCreatedAt: Date.now() - 6 * 60 * 60 * 1000, // 6 hours old
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).toMatch(/extremely new/i);

    const ageFinding = report.findings.find(f => f.message.includes('extremely new'));
    expect(ageFinding).toBeDefined();
    expect(ageFinding!.severity).toBe('danger');
  });
});

// =========================================================================
// 4) No Pairs Returned (Case A)
// =========================================================================
describe('No pairs returned from DexScreener', () => {
  it('Case A: returns DANGEROUS with danger severity, score >= 60, confidence LOW', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.confidence).toBe('LOW');

    const findings = allFindings(report);
    expect(findings).toMatch(/no liquidity pairs/i);
    expect(report.findings.some(f => f.severity === 'danger')).toBe(true);
  });

  it('returns DANGEROUS when pairs is empty array', async () => {
    mockFetchJson({ pairs: [] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.confidence).toBe('LOW');
  });

  it('summary says token not listed on any DEX', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.summary).toContain('not listed on any DEX');
    expect(report.summary).toContain('extremely risky');
  });

  it('never shows SAFE when no pairs found', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).not.toBe('SAFE');
    expect(report.summary).not.toContain('strong liquidity');
    expect(report.summary).not.toContain('No suspicious risk signals');
  });

  it('recommends not interacting with unverified token', async () => {
    mockFetchJson({ pairs: [] });

    const report = await scanToken(VALID_ADDRESS);

    const recs = report.recommendations.join(' ');
    expect(recs).toMatch(/[Dd]o not interact/i);
    expect(recs).toMatch(/block explorer/i);
  });

  it('next step says do not buy', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.nextStep).toContain('Do not buy');
  });

  it('confidenceReason reflects no liquidity pairs', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidenceReason).toContain('No liquidity pairs found');
  });
});

// =========================================================================
// 5) API Error / Rate Limit (Case F)
// =========================================================================
describe('API error and rate limit handling', () => {
  it('Case F: API error → LOW confidence, warning finding, at least SUSPICIOUS', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('LOW');
    expect(report.riskLevel).not.toBe('SAFE');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Cc]ould not fetch token data/i);
    expect(report.recommendations.join(' ')).toMatch(/[Mm]anually verify/i);
  });

  it('handles HTTP 429 rate limit gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 }),
    );

    const report = await scanToken(VALID_ADDRESS);

    expect(report).toBeDefined();
    expect(report.riskLevel).not.toBe('SAFE');
    expect(report.confidence).toBe('LOW');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Cc]ould not fetch token data/i);
  });

  it('handles HTTP 500 server error gracefully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    const report = await scanToken(VALID_ADDRESS);

    expect(report).toBeDefined();
    expect(report.confidence).toBe('LOW');
    expect(report.riskLevel).not.toBe('SAFE');
  });

  it('handles timeout (abort) gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('The operation was aborted'));

    const report = await scanToken(VALID_ADDRESS);

    expect(report).toBeDefined();
    expect(report.confidence).toBe('LOW');
    expect(report.riskLevel).not.toBe('SAFE');
    const findings = allFindings(report);
    expect(findings).toMatch(/timed out/i);
  });
});

// =========================================================================
// 6) Invalid Address Format
// =========================================================================
describe('Invalid contract address', () => {
  it('flags address without 0x prefix', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken('dAC17F958D2ee523a2206206994597C13D831ec7');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid contract address/i);
  });

  it('flags address that is too short', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken('0x1234');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid contract address/i);
  });

  it('flags address with non-hex characters', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');

    const findings = allFindings(report);
    expect(findings).toMatch(/[Ii]nvalid contract address/i);
  });
});

// =========================================================================
// 7) FDV vs Liquidity Rule
// =========================================================================
describe('FDV vs liquidity check', () => {
  it('flags FDV > 10M with liquidity < 50k', async () => {
    mockFetchJson({
      pairs: [makePair({
        fdv: 50_000_000,
        liquidity: { usd: 30_000 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).toMatch(/FDV.*liquidity/i);
    expect(findings).toMatch(/rug pull risk/i);
  });

  it('does NOT flag FDV < 10M even with low liquidity ratio', async () => {
    mockFetchJson({
      pairs: [makePair({
        fdv: 5_000_000,
        liquidity: { usd: 30_000 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).not.toMatch(/FDV.*rug pull/i);
  });

  it('does NOT flag FDV > 10M when liquidity is healthy (>= 50k)', async () => {
    mockFetchJson({
      pairs: [makePair({
        fdv: 50_000_000,
        liquidity: { usd: 500_000 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const findings = allFindings(report);
    expect(findings).not.toMatch(/FDV.*rug pull/i);
  });
});

// =========================================================================
// 8) Chain Name Resolution
// =========================================================================
describe('Chain name resolution', () => {
  it('resolves known chain IDs to readable names', async () => {
    mockFetchJson({ pairs: [makePair({ chainId: 'bsc' })] });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.chain).toBe('BNB Smart Chain');
    expect(meta.chainId).toBe('bsc');
  });

  it('falls back to raw chainId for unknown chains', async () => {
    mockFetchJson({ pairs: [makePair({ chainId: 'fantom' })] });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.chain).toBe('fantom');
  });
});

// =========================================================================
// 9) Report Structure
// =========================================================================
describe('Report structure validation', () => {
  it('returns a valid SafetyReport shape', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.inputType).toBe('token');
    expect(typeof report.riskScore).toBe('number');
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);
    expect(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).toContain(report.riskLevel);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(typeof report.timestamp).toBe('string');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(report.confidence);
    expect(typeof report.confidenceReason).toBe('string');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.scoreBreakdown)).toBe(true);
    expect(typeof report.nextStep).toBe('string');
  });

  it('always includes general recommendations', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);
    const recs = report.recommendations.join(' ');

    expect(recs).toMatch(/contract.*verified/i);
    expect(recs).toMatch(/locked liquidity/i);
    expect(recs).toMatch(/[Nn]ever invest more/i);
  });
});

// =========================================================================
// 10) Severity Override — danger forces level
// =========================================================================
describe('Severity override rules', () => {
  it('danger severity finding prevents SAFE level', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.findings.some(f => f.severity === 'danger')).toBe(true);
    expect(report.riskLevel).not.toBe('SAFE');
  });

  it('danger severity + score >= 60 = DANGEROUS', async () => {
    mockFetchJson({ pairs: [] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.riskLevel).toBe('DANGEROUS');
  });

  it('no-danger findings with low score can still be SAFE', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.findings.some(f => f.severity === 'danger')).toBe(false);
    expect(report.riskLevel).toBe('SAFE');
  });
});

// =========================================================================
// 11) Summary + Banner consistency
// =========================================================================
describe('Summary and banner consistency', () => {
  it('SAFE token has no danger/warning language in summary', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.summary).not.toContain('dangerous');
    expect(report.summary).not.toContain('extremely risky');
    expect(report.summary).not.toContain('high-risk');
  });

  it('DANGEROUS no-pairs token has alarming summary', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.summary).toContain('extremely risky');
  });

  it('DANGEROUS token with data has signal-specific summary', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 2_000 },
        volume: { h24: 50 },
        priceChange: { h24: 5 },
        pairCreatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.summary).toContain('dangerously low liquidity');
  });

  it('score breakdown includes danger finding with +60 for no-pairs', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    const dangerBreakdown = report.scoreBreakdown.find(b => b.scoreImpact === 60);
    expect(dangerBreakdown).toBeDefined();
    expect(dangerBreakdown!.label).toContain('no liquidity pairs');
  });

  it('low liquidity token summary mentions low liquidity', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 25_000 },
        volume: { h24: 5_000 },
        priceChange: { h24: 5 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.summary).toContain('low liquidity');
  });
});

// =========================================================================
// 12) Confidence logic
// =========================================================================
describe('Confidence logic', () => {
  it('HIGH when liquidity + volume + priceChange all present', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('HIGH');
  });

  it('MEDIUM when liquidity present but volume missing', async () => {
    mockFetchJson({
      pairs: [makePair({
        volume: undefined,
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('MEDIUM');
  });

  it('LOW when no pairs returned', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('LOW');
  });

  it('LOW when API fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fail'));

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidence).toBe('LOW');
  });
});

// =========================================================================
// 13) Info findings for healthy metrics
// =========================================================================
describe('Info findings for healthy metrics', () => {
  it('produces info findings for healthy liquidity and volume', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    const infoFindings = report.findings.filter(f => f.severity === 'info');
    expect(infoFindings.length).toBeGreaterThanOrEqual(2);

    const liqInfo = infoFindings.find(f => f.message.includes('Liquidity is healthy'));
    expect(liqInfo).toBeDefined();

    const volInfo = infoFindings.find(f => f.message.includes('volume is healthy'));
    expect(volInfo).toBeDefined();
  });

  it('info findings have 0 score impact', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    const infoBreakdowns = report.scoreBreakdown.filter(b => b.scoreImpact === 0);
    expect(infoBreakdowns.length).toBeGreaterThanOrEqual(2);
  });
});

// =========================================================================
// 14) Score override accuracy
// =========================================================================
describe('Score override accuracy', () => {
  it('liquidity < 5k uses +50 override', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 3_000 },
        volume: { h24: 120_000 },
        priceChange: { h24: 2 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const liqBreakdown = report.scoreBreakdown.find(b => b.label.includes('Dangerously low'));
    expect(liqBreakdown).toBeDefined();
    expect(liqBreakdown!.scoreImpact).toBe(50);
  });

  it('liquidity < 50k uses +25 override', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 20_000 },
        volume: { h24: 120_000 },
        priceChange: { h24: 2 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const liqBreakdown = report.scoreBreakdown.find(b => b.label.includes('Low liquidity'));
    expect(liqBreakdown).toBeDefined();
    expect(liqBreakdown!.scoreImpact).toBe(25);
  });

  it('volume < 1k uses +15 override', async () => {
    mockFetchJson({
      pairs: [makePair({
        volume: { h24: 500 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volBreakdown = report.scoreBreakdown.find(b => b.label.includes('Very low 24h volume'));
    expect(volBreakdown).toBeDefined();
    expect(volBreakdown!.scoreImpact).toBe(15);
  });

  it('volume < 10k uses +10 override', async () => {
    mockFetchJson({
      pairs: [makePair({
        volume: { h24: 5_000 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volBreakdown = report.scoreBreakdown.find(b => b.label.includes('Low 24h trading volume'));
    expect(volBreakdown).toBeDefined();
    expect(volBreakdown!.scoreImpact).toBe(10);
  });
});

// =========================================================================
// 15) Baseline risk floor
// =========================================================================
describe('Baseline risk floor', () => {
  it('SAFE tokens never return score 0 — minimum is 5', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
  });

  it('healthy token with low priceChange gets exactly 5', async () => {
    mockFetchJson({
      pairs: [makePair({
        liquidity: { usd: 500_000 },
        volume: { h24: 120_000 },
        priceChange: { h24: 2 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskScore).toBe(5);
    expect(report.riskLevel).toBe('SAFE');
  });

  it('score breakdown includes baseline floor item', async () => {
    mockFetchJson({ pairs: [makePair()] });

    const report = await scanToken(VALID_ADDRESS);

    const floorItem = report.scoreBreakdown.find(b => b.label.includes('Baseline risk floor'));
    expect(floorItem).toBeDefined();
    expect(floorItem!.scoreImpact).toBe(5);
  });

  it('floor does not apply to non-SAFE tokens', async () => {
    mockFetchJson({ pairs: null });

    const report = await scanToken(VALID_ADDRESS);

    // Score is 60 from danger finding, not affected by floor
    expect(report.riskScore).toBe(60);
    const floorItem = report.scoreBreakdown.find(b => b.label.includes('Baseline risk floor'));
    expect(floorItem).toBeUndefined();
  });
});

// =========================================================================
// 16) Volatility micro-risk findings
// =========================================================================
describe('Volatility micro-risk findings', () => {
  it('moderate volatility (20–50%) adds info finding with +5', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 35 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volFinding = report.findings.find(f => f.message.includes('moderate 24h volatility'));
    expect(volFinding).toBeDefined();
    expect(volFinding!.severity).toBe('info');
    expect(volFinding!.scoreOverride).toBe(5);
    expect(volFinding!.message).toContain('±35%');
  });

  it('moderate volatility enforces minimum score of 10', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 25 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskScore).toBeGreaterThanOrEqual(10);
    expect(report.riskLevel).toBe('SAFE');
  });

  it('high volatility (50–200%) adds medium finding with +10', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 80 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volFinding = report.findings.find(f => f.message.includes('high 24h volatility'));
    expect(volFinding).toBeDefined();
    expect(volFinding!.severity).toBe('medium');
    expect(volFinding!.scoreOverride).toBe(10);
  });

  it('negative volatility (drop) is caught by abs check', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: -30 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volFinding = report.findings.find(f => f.message.includes('moderate 24h volatility'));
    expect(volFinding).toBeDefined();
    expect(volFinding!.message).toContain('±30%');
  });

  it('extreme pump (>200%) does NOT produce a separate volatility finding', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 400 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volFinding = report.findings.find(f => f.message.includes('volatility'));
    expect(volFinding).toBeUndefined();

    const pumpFinding = report.findings.find(f => f.message.includes('Extreme'));
    expect(pumpFinding).toBeDefined();
  });

  it('low price change (<20%) does NOT produce volatility finding', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 15 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const volFinding = report.findings.find(f => f.message.includes('volatility'));
    expect(volFinding).toBeUndefined();
  });

  it('volatile SAFE token summary mentions elevated volatility', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 30 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.riskLevel).toBe('SAFE');
    expect(report.summary).toContain('volatility');
    expect(report.summary).toContain('elevated');
  });

  it('breakdown includes volatility floor for volatile SAFE token', async () => {
    mockFetchJson({
      pairs: [makePair({
        priceChange: { h24: 25 },
      })],
    });

    const report = await scanToken(VALID_ADDRESS);

    const floorItem = report.scoreBreakdown.find(b => b.label.includes('price volatility detected'));
    expect(floorItem).toBeDefined();
  });
});

// =========================================================================
// 17) GoPlus Token Security Integration
// =========================================================================
describe('GoPlus token security', () => {
  it('detects honeypot token — DANGEROUS with danger finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '1', is_open_source: '1' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.isHoneypot).toBe(true);
    expect(meta.goPlusChecked).toBe(true);
    expect(report.riskLevel).toBe('DANGEROUS');

    const honeypotFinding = report.findings.find(f => f.message.includes('HONEYPOT'));
    expect(honeypotFinding).toBeDefined();
    expect(honeypotFinding!.severity).toBe('danger');

    expect(report.summary).toContain('HONEYPOT');
  });

  it('high sell tax (>10%) — danger finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', sell_tax: '0.15', buy_tax: '0', is_open_source: '1' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const taxFinding = report.findings.find(f => f.message.includes('High sell tax'));
    expect(taxFinding).toBeDefined();
    expect(taxFinding!.severity).toBe('danger');
    expect(taxFinding!.message).toContain('15.0%');
  });

  it('elevated sell tax (5-10%) — medium finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', sell_tax: '0.07', buy_tax: '0', is_open_source: '1' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const taxFinding = report.findings.find(f => f.message.includes('Elevated sell tax'));
    expect(taxFinding).toBeDefined();
    expect(taxFinding!.severity).toBe('medium');
    expect(taxFinding!.message).toContain('7.0%');
  });

  it('skips tax findings when honeypot detected', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '1', sell_tax: '1.0', buy_tax: '1.0', is_open_source: '1' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    // Should have honeypot finding but NOT tax findings
    const honeypotFinding = report.findings.find(f => f.message.includes('HONEYPOT'));
    expect(honeypotFinding).toBeDefined();

    const taxFinding = report.findings.find(f => f.message.includes('tax'));
    expect(taxFinding).toBeUndefined();
  });

  it('unverified contract source — high finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', is_open_source: '0', buy_tax: '0', sell_tax: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('NOT verified/open source'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('mintable token — medium finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', is_mintable: '1', is_open_source: '1', buy_tax: '0', sell_tax: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('minted'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('hidden owner — high finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', hidden_owner: '1', is_open_source: '1', buy_tax: '0', sell_tax: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('hidden owner'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('proxy contract — medium finding with scoreOverride 15', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', is_proxy: '1', is_open_source: '1', buy_tax: '0', sell_tax: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('proxy'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
    expect(finding!.scoreOverride).toBe(15);
  });

  it('selfdestruct — danger finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', selfdestruct: '1', is_open_source: '1', buy_tax: '0', sell_tax: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('selfdestruct'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('danger');
  });

  it('all GoPlus flags clear — info finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: {
        is_honeypot: '0', is_open_source: '1', is_mintable: '0',
        hidden_owner: '0', slippage_modifiable: '0', transfer_pausable: '0',
        is_proxy: '0', selfdestruct: '0', is_blacklisted: '0',
        buy_tax: '0', sell_tax: '0',
      },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    const finding = report.findings.find(f => f.message.includes('GoPlus security audit passed'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('GoPlus failure — graceful degradation, no GoPlus findings', async () => {
    mockFetchJson({ pairs: [makePair()] });
    // Default mock already returns error — just verify behavior

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.goPlusChecked).toBeUndefined();
    const goPlusFinding = report.findings.find(f => f.message.includes('GoPlus'));
    expect(goPlusFinding).toBeUndefined();
  });

  it('GoPlus data populates metadata fields', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: {
        is_honeypot: '0', is_open_source: '1', is_mintable: '0',
        hidden_owner: '0', buy_tax: '0.02', sell_tax: '0.03',
        holder_count: '5000', owner_address: '0xOwner',
        is_proxy: '0', selfdestruct: '0', is_blacklisted: '0',
        slippage_modifiable: '0', transfer_pausable: '0',
      },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.goPlusChecked).toBe(true);
    expect(meta.isHoneypot).toBe(false);
    expect(meta.isOpenSource).toBe(true);
    expect(meta.buyTax).toBeCloseTo(2);
    expect(meta.sellTax).toBeCloseTo(3);
    expect(meta.holderCount).toBe(5000);
    expect(meta.ownerAddress).toBe('0xOwner');
  });

  it('confidence reason includes GoPlus note when data available', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchTokenSecurity).mockResolvedValueOnce({
      data: { is_honeypot: '0', is_open_source: '1', buy_tax: '0', sell_tax: '0',
        is_mintable: '0', hidden_owner: '0', slippage_modifiable: '0',
        transfer_pausable: '0', is_proxy: '0', selfdestruct: '0', is_blacklisted: '0' },
      error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidenceReason).toContain('GoPlus security audit performed');
  });
});

// =========================================================================
// 18) Sourcify Contract Verification Integration
// =========================================================================
describe('Sourcify contract verification', () => {
  it('verified contract — info finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchContractVerification).mockResolvedValueOnce({
      isVerified: true, error: null,
    });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.sourcifyVerified).toBe(true);

    const finding = report.findings.find(f => f.message.includes('verified on Sourcify'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('unverified contract — low finding', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchContractVerification).mockResolvedValueOnce({
      isVerified: false, error: null,
    });

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.sourcifyVerified).toBe(false);

    const finding = report.findings.find(f => f.message.includes('NOT verified on Sourcify'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('low');
  });

  it('Sourcify failure — graceful degradation', async () => {
    mockFetchJson({ pairs: [makePair()] });
    // Default mock already returns null — verify no Sourcify finding

    const report = await scanToken(VALID_ADDRESS);
    const meta = report.metadata as TokenMetadata;

    expect(meta.sourcifyVerified).toBeUndefined();
    const sourcifyFinding = report.findings.find(f => f.message.includes('Sourcify'));
    expect(sourcifyFinding).toBeUndefined();
  });

  it('confidence reason includes Sourcify note when data available', async () => {
    mockFetchJson({ pairs: [makePair()] });
    vi.mocked(fetchContractVerification).mockResolvedValueOnce({
      isVerified: true, error: null,
    });

    const report = await scanToken(VALID_ADDRESS);

    expect(report.confidenceReason).toContain('Sourcify');
  });
});
