import { describe, it, expect } from 'vitest';
import { isBitcoinAddress, detectInputType } from './detectInput';
import { scanBtcWallet } from './scanBtcWallet';
import { WalletMetadata } from '@/types';

// ---------------------------------------------------------------------------
// 1) isBitcoinAddress helper
// ---------------------------------------------------------------------------
describe('isBitcoinAddress', () => {
  it('detects Legacy P2PKH address (starts with 1)', () => {
    expect(isBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
  });

  it('detects P2SH address (starts with 3)', () => {
    expect(isBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
  });

  it('detects Bech32 SegWit address (starts with bc1q)', () => {
    expect(isBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
  });

  it('detects Bech32m Taproot address (starts with bc1p)', () => {
    expect(isBitcoinAddress('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isBitcoinAddress('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isBitcoinAddress('hello world')).toBe(false);
  });

  it('rejects Ethereum address', () => {
    expect(isBitcoinAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(false);
  });

  it('rejects address with invalid Base58 characters (0, O, I, l)', () => {
    expect(isBitcoinAddress('1A1zP0eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false); // 0
    expect(isBitcoinAddress('1A1zPOeP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false); // O
    expect(isBitcoinAddress('1A1zPIeP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false); // I
    expect(isBitcoinAddress('1A1zPleP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false); // l
  });

  it('rejects address that is too short', () => {
    expect(isBitcoinAddress('1A1zP1eP5QGe')).toBe(false);
  });

  it('rejects address that is too long', () => {
    expect(isBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNaXXXXXXXX')).toBe(false);
  });

  it('accepts Bech32 with uppercase (case-insensitive per BIP-173)', () => {
    expect(isBitcoinAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2) detectInputType — BTC routing
// ---------------------------------------------------------------------------
describe('detectInputType — BTC addresses', () => {
  it('detects Legacy BTC as btcWallet', () => {
    expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('btcWallet');
  });

  it('detects P2SH BTC as btcWallet', () => {
    expect(detectInputType('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('btcWallet');
  });

  it('detects Bech32 BTC as btcWallet', () => {
    expect(detectInputType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('btcWallet');
  });

  it('does NOT detect EVM address as btcWallet', () => {
    expect(detectInputType('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe('token');
  });

  it('does NOT detect URL as btcWallet', () => {
    expect(detectInputType('https://bitcoin.org')).toBe('url');
  });
});

// ---------------------------------------------------------------------------
// 3) scanBtcWallet — valid addresses
// ---------------------------------------------------------------------------
describe('scanBtcWallet — valid BTC addresses', () => {
  it('genesis address returns SAFE with score >= 5, MEDIUM confidence', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    expect(report.inputType).toBe('btcWallet');
    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
    expect(report.riskScore).toBeLessThanOrEqual(10);
    expect(report.confidence).toBe('MEDIUM');
  });

  it('Bech32 address returns SAFE with MEDIUM confidence', async () => {
    const report = await scanBtcWallet('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');

    expect(report.inputType).toBe('btcWallet');
    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
    expect(report.confidence).toBe('MEDIUM');
  });

  it('P2SH address returns SAFE', async () => {
    const report = await scanBtcWallet('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.confidence).toBe('MEDIUM');
  });

  it('summary says valid Bitcoin address, no scam patterns', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    expect(report.summary).toContain('valid Bitcoin address');
    expect(report.summary).toContain('No scam patterns');
  });

  it('includes Blockstream and Blockchain.com explorer links', async () => {
    const addr = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const report = await scanBtcWallet(addr);
    const meta = report.metadata as WalletMetadata;

    expect(meta.explorerUrls).toBeDefined();
    expect(meta.explorerUrls!.length).toBe(2);

    const blockstream = meta.explorerUrls!.find(e => e.name === 'Blockstream');
    expect(blockstream).toBeDefined();
    expect(blockstream!.url).toBe(`https://blockstream.info/address/${addr}`);

    const blockchain = meta.explorerUrls!.find(e => e.name === 'Blockchain.com');
    expect(blockchain).toBeDefined();
    expect(blockchain!.url).toBe(`https://www.blockchain.com/btc/address/${addr}`);
  });

  it('sets chain to Bitcoin', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    const meta = report.metadata as WalletMetadata;

    expect(meta.chain).toBe('Bitcoin');
  });

  it('finding mentions address type (Legacy)', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    const finding = report.findings.find(f => f.message.includes('Legacy'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('finding mentions address type (Bech32)', async () => {
    const report = await scanBtcWallet('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');

    const finding = report.findings.find(f => f.message.includes('Bech32'));
    expect(finding).toBeDefined();
  });

  it('score breakdown includes baseline floor', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    const floorItem = report.scoreBreakdown.find(b => b.label.includes('Baseline risk floor'));
    expect(floorItem).toBeDefined();
    expect(floorItem!.scoreImpact).toBe(5);
  });

  it('includes recommendations', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.join(' ')).toMatch(/block explorer/i);
  });
});

// ---------------------------------------------------------------------------
// 4) scanBtcWallet — invalid addresses
// ---------------------------------------------------------------------------
describe('scanBtcWallet — invalid addresses', () => {
  it('invalid address gets high severity finding', async () => {
    const report = await scanBtcWallet('not-a-btc-address');

    const finding = report.findings.find(f => f.message.includes('Invalid Bitcoin'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('invalid address gets LOW confidence', async () => {
    const report = await scanBtcWallet('xyz');

    expect(report.confidence).toBe('LOW');
  });

  it('invalid address has appropriate summary', async () => {
    const report = await scanBtcWallet('bad');

    expect(report.summary).toContain('Invalid Bitcoin');
  });
});

// ---------------------------------------------------------------------------
// 5) Report structure
// ---------------------------------------------------------------------------
describe('scanBtcWallet — report structure', () => {
  it('returns valid SafetyReport shape', async () => {
    const report = await scanBtcWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    expect(report.inputType).toBe('btcWallet');
    expect(typeof report.riskScore).toBe('number');
    expect(report.riskScore).toBeGreaterThanOrEqual(0);
    expect(report.riskScore).toBeLessThanOrEqual(100);
    expect(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).toContain(report.riskLevel);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(typeof report.timestamp).toBe('string');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(report.confidence);
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.scoreBreakdown)).toBe(true);
    expect(typeof report.nextStep).toBe('string');
  });
});
