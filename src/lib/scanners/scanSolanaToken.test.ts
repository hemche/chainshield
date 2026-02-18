import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanSolanaToken } from './scanSolanaToken';

function mockDexScreenerResponse(pairs: unknown[] | null = null) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ pairs }),
  });
}

function makePair(overrides: Record<string, unknown> = {}) {
  return {
    chainId: 'solana',
    dexId: 'raydium',
    pairAddress: 'SOLPairAddr123',
    url: 'https://dexscreener.com/solana/SOLPairAddr123',
    baseToken: { address: 'SoLToken123', name: 'TestToken', symbol: 'TEST' },
    quoteToken: { name: 'SOL', symbol: 'SOL' },
    priceUsd: '0.001',
    priceChange: { h24: 5 },
    liquidity: { usd: 100_000 },
    fdv: 500_000,
    volume: { h24: 50_000 },
    pairCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    ...overrides,
  };
}

const SOLANA_ADDR = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('scanSolanaToken', () => {
  it('returns SAFE for a healthy Solana token', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([makePair()]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.inputType).toBe('solanaToken');
    expect(report.riskLevel).toBe('SAFE');
    expect(report.confidence).toBe('MEDIUM');
    expect(report.metadata).toBeDefined();
  });

  it('returns DANGEROUS when no pairs found', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.findings.some(f => f.message.includes('no liquidity pairs'))).toBe(true);
  });

  it('flags extremely low liquidity', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ liquidity: { usd: 100 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.riskScore).toBeGreaterThanOrEqual(50);
    expect(report.findings.some(f => f.message.includes('Extremely low liquidity'))).toBe(true);
  });

  it('flags low liquidity as SUSPICIOUS', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ liquidity: { usd: 20_000 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Low liquidity'))).toBe(true);
  });

  it('flags very new pair as danger', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ pairCreatedAt: Date.now() - 6 * 60 * 60 * 1000 }), // 6 hours ago
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('extremely new'))).toBe(true);
  });

  it('flags new pair (2 days) as medium', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ pairCreatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('very new'))).toBe(true);
  });

  it('flags very low volume', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ volume: { h24: 500 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Very low 24h volume'))).toBe(true);
  });

  it('flags low volume', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ volume: { h24: 5_000 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Low 24h volume'))).toBe(true);
  });

  it('flags extreme price pump', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ priceChange: { h24: 500 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Extreme price pump'))).toBe(true);
  });

  it('flags large price swing', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ priceChange: { h24: -60 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Large price swing'))).toBe(true);
  });

  it('flags FDV vs liquidity mismatch', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ fdv: 20_000_000, liquidity: { usd: 30_000 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('exit liquidity risk'))).toBe(true);
  });

  it('flags very low FDV', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ fdv: 5_000 }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Very low FDV'))).toBe(true);
  });

  it('handles DexScreener API timeout gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('AbortError'), { name: 'AbortError' })
    ));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('timed out'))).toBe(true);
    expect(report.riskLevel).not.toBe('DANGEROUS');
  });

  it('handles DexScreener API error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Failed to fetch'))).toBe(true);
  });

  it('handles non-ok response gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: () => Promise.resolve({}),
    }));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('Failed to fetch'))).toBe(true);
  });

  it('prefers Solana pairs over other chains', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ chainId: 'ethereum', liquidity: { usd: 200_000 }, dexId: 'uniswap' }),
      makePair({ chainId: 'solana', liquidity: { usd: 100_000 }, dexId: 'raydium' }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    // Should use the Solana pair even though ETH pair has more liquidity
    expect((report.metadata as Record<string, unknown>)?.dex).toBe('raydium');
  });

  it('applies baseline floor of 5 for non-volatile tokens', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ priceChange: { h24: 0 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
  });

  it('applies baseline floor of 10 for volatile tokens', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ priceChange: { h24: 25 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.riskScore).toBeGreaterThanOrEqual(10);
  });

  it('includes rugcheck.xyz recommendation', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([makePair()]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.recommendations.some(r => r.includes('rugcheck.xyz'))).toBe(true);
  });

  it('includes gov resource links for risky tokens', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      makePair({ liquidity: { usd: 100 } }),
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.recommendations.some(r => r.includes('government scam databases'))).toBe(true);
  });

  it('includes checksPerformed', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([makePair()]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.checksPerformed).toBeDefined();
    expect(report.checksPerformed!.length).toBe(4);
  });

  it('handles malformed API response (pairs is not array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pairs: 'not-an-array' }),
    }));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('no liquidity pairs'))).toBe(true);
  });

  it('handles incomplete pair data gracefully', async () => {
    vi.stubGlobal('fetch', mockDexScreenerResponse([
      { chainId: 'solana', liquidity: { usd: 100_000 } }, // missing baseToken
    ]));
    const report = await scanSolanaToken(SOLANA_ADDR);
    expect(report.findings.some(f => f.message.includes('incomplete'))).toBe(true);
  });
});
