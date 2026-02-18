import { describe, it, expect } from 'vitest';
import { isValidEvmAddress, isValidBitcoinAddress, detectAddressType } from './addressValidation';
import { detectInputType } from '@/lib/scanners/detectInput';
import { scanInput } from '@/lib/scanners';

// ---------------------------------------------------------------------------
// 1) isValidEvmAddress
// ---------------------------------------------------------------------------
describe('isValidEvmAddress', () => {
  it('accepts correctly checksummed address (Vitalik)', () => {
    expect(isValidEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });

  it('accepts all-lowercase address (no checksum to verify)', () => {
    expect(isValidEvmAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true);
  });

  it('accepts all-uppercase address (no checksum to verify)', () => {
    expect(isValidEvmAddress('0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045')).toBe(true);
  });

  it('accepts zero address', () => {
    expect(isValidEvmAddress('0x0000000000000000000000000000000000000000')).toBe(true);
  });

  it('accepts USDT contract address', () => {
    expect(isValidEvmAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(true);
  });

  it('rejects bad checksum (mixed-case with wrong casing)', () => {
    // Flip one character's case to break checksum
    expect(isValidEvmAddress('0xd8dA6Bf26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
  });

  it('rejects address too short', () => {
    expect(isValidEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA9604')).toBe(false);
  });

  it('rejects address too long', () => {
    expect(isValidEvmAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA960450')).toBe(false);
  });

  it('accepts address without 0x prefix (ethers is permissive)', () => {
    expect(isValidEvmAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidEvmAddress('')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidEvmAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
  });

  it('rejects Bitcoin address', () => {
    expect(isValidEvmAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2) isValidBitcoinAddress
// ---------------------------------------------------------------------------
describe('isValidBitcoinAddress', () => {
  it('accepts valid Legacy P2PKH address (genesis block)', () => {
    expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
  });

  it('accepts valid P2SH address', () => {
    expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
  });

  it('accepts valid Bech32 SegWit address', () => {
    expect(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
  });

  it('rejects Taproot address (bitcoinjs-lib does not support Bech32m by default)', () => {
    expect(isValidBitcoinAddress('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')).toBe(false);
  });

  it('rejects Base58 address with bad checksum', () => {
    // Changed last char: 'a' → 'b'
    expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBe(false);
  });

  it('rejects Bech32 address with bad checksum', () => {
    // Changed last char to break checksum
    expect(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidBitcoinAddress('')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isValidBitcoinAddress('not-a-bitcoin-address')).toBe(false);
  });

  it('rejects EVM address', () => {
    expect(isValidBitcoinAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3) detectAddressType
// ---------------------------------------------------------------------------
describe('detectAddressType', () => {
  it('detects valid EVM address', () => {
    const result = detectAddressType('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.type).toBe('EVM');
    expect(result.valid).toBe(true);
  });

  it('detects invalid EVM address (bad checksum)', () => {
    const result = detectAddressType('0xd8dA6Bf26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.type).toBe('EVM');
    expect(result.valid).toBe(false);
  });

  it('detects valid BTC Legacy address', () => {
    const result = detectAddressType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(result.type).toBe('BTC');
    expect(result.valid).toBe(true);
  });

  it('detects invalid BTC Legacy address (bad checksum)', () => {
    const result = detectAddressType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb');
    expect(result.type).toBe('BTC');
    expect(result.valid).toBe(false);
  });

  it('detects valid BTC Bech32 address', () => {
    const result = detectAddressType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect(result.type).toBe('BTC');
    expect(result.valid).toBe(true);
  });

  it('detects invalid BTC Bech32 address (bad checksum)', () => {
    const result = detectAddressType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5');
    expect(result.type).toBe('BTC');
    expect(result.valid).toBe(false);
  });

  it('returns UNKNOWN for unrecognized input', () => {
    const result = detectAddressType('hello world');
    expect(result.type).toBe('UNKNOWN');
    expect(result.valid).toBe(false);
  });

  it('returns UNKNOWN for URL', () => {
    const result = detectAddressType('https://example.com');
    expect(result.type).toBe('UNKNOWN');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4) Invalid BTC address validation
// ---------------------------------------------------------------------------
describe('isValidBitcoinAddress — invalid BTC addresses', () => {
  it('rejects BTC address with garbage suffix (wrong length/checksum)', () => {
    expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7Di88327362')).toBe(false);
  });

  it('rejects BTC address with invalid characters (@)', () => {
    expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN@')).toBe(false);
  });

  it('rejects truncated BTC address', () => {
    expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTf')).toBe(false);
  });

  it('rejects BTC address with extra characters appended', () => {
    expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyXXXX')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5) detectInputType — broader BTC-like detection
// ---------------------------------------------------------------------------
describe('detectInputType — invalid BTC addresses', () => {
  it('classifies BTC address with garbage suffix as btcWallet', () => {
    expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5SLmv7Di88327362')).toBe('btcWallet');
  });

  it('classifies truncated BTC address as btcWallet', () => {
    expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5S')).toBe('btcWallet');
  });

  it('still classifies valid BTC as btcWallet', () => {
    expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('btcWallet');
  });
});

// ---------------------------------------------------------------------------
// 6) scanInput — end-to-end invalid BTC classification
// ---------------------------------------------------------------------------
describe('scanInput — invalid BTC addresses return INVALID_ADDRESS', () => {
  it('BTC with garbage suffix returns invalidAddress, DANGEROUS, score >= 70', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7Di88327362');

    expect(report.inputType).toBe('invalidAddress');
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(70);
    expect(report.confidence).toBe('HIGH');
    expect(report.summary).toContain('checksum failed');
  });

  it('BTC with invalid chars returns invalidAddress, DANGEROUS', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN@');

    expect(report.inputType).toBe('invalidAddress');
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(70);
    expect(report.confidence).toBe('HIGH');
  });

  it('BTC with bad checksum (last char changed) returns invalidAddress', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb');

    expect(report.inputType).toBe('invalidAddress');
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('valid BTC address still returns btcWallet SAFE', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    expect(report.inputType).toBe('btcWallet');
    expect(report.riskLevel).toBe('SAFE');
  });

  it('valid Bech32 address still returns btcWallet SAFE', async () => {
    const report = await scanInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');

    expect(report.inputType).toBe('btcWallet');
    expect(report.riskLevel).toBe('SAFE');
  });

  it('finding includes checksum failed message', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7Di88327362');

    const finding = report.findings.find(f => f.message.includes('checksum failed'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('danger');
  });

  it('recommendations include funds recovery warning', async () => {
    const report = await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7Di88327362');

    const rec = report.recommendations.find(r => r.includes('cannot be recovered'));
    expect(rec).toBeDefined();
  });
});
