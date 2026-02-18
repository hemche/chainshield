import { describe, it, expect } from 'vitest';
import { detectInputType, isBitcoinAddress, isSolanaAddress } from './detectInput';

// ============================================================================
// detectInputType — unit tests
// ============================================================================

describe('detectInputType', () => {
  // -------------------------------------------------------------------------
  // URL detection
  // -------------------------------------------------------------------------
  describe('URL detection', () => {
    it('detects https:// URLs', () => {
      expect(detectInputType('https://example.com')).toBe('url');
    });

    it('detects http:// URLs', () => {
      expect(detectInputType('http://example.com')).toBe('url');
    });

    it('detects www. prefixed URLs', () => {
      expect(detectInputType('www.example.com')).toBe('url');
    });

    it('detects bare domain names', () => {
      expect(detectInputType('uniswap.org')).toBe('url');
      expect(detectInputType('binance.com')).toBe('url');
    });

    it('detects subdomains', () => {
      expect(detectInputType('app.uniswap.org')).toBe('url');
    });

    it('detects domains with paths', () => {
      expect(detectInputType('example.com/path/to/page')).toBe('url');
    });

    it('is case insensitive for protocol', () => {
      expect(detectInputType('HTTPS://EXAMPLE.COM')).toBe('url');
      expect(detectInputType('Http://test.com')).toBe('url');
    });

    it('does not detect 0x addresses as URLs', () => {
      // 0x + 40 hex chars looks like "0xABC...something.com" but should NOT match as URL
      expect(detectInputType('0xdAC17F958D2ee523a2206206994597C13D831ec7')).not.toBe('url');
    });
  });

  // -------------------------------------------------------------------------
  // Transaction hash detection
  // -------------------------------------------------------------------------
  describe('Transaction hash detection', () => {
    it('detects a valid tx hash (0x + 64 hex chars)', () => {
      const txHash = '0x' + 'a'.repeat(64);
      expect(detectInputType(txHash)).toBe('txHash');
    });

    it('detects uppercase hex tx hash', () => {
      const txHash = '0x' + 'ABCDEF1234567890'.repeat(4);
      expect(detectInputType(txHash)).toBe('txHash');
    });

    it('detects mixed case hex tx hash', () => {
      const txHash = '0xabcdEF0123456789abcdEF0123456789abcdEF0123456789abcdEF0123456789';
      expect(detectInputType(txHash)).toBe('txHash');
    });
  });

  // -------------------------------------------------------------------------
  // Token / EVM address detection (0x + 40 hex)
  // -------------------------------------------------------------------------
  describe('Token/EVM address detection', () => {
    it('detects 0x + 40 hex as token (initial type before fallback)', () => {
      expect(detectInputType('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe('token');
    });

    it('detects lowercase 0x + 40 hex as token', () => {
      expect(detectInputType('0x' + 'a'.repeat(40))).toBe('token');
    });

    it('detects uppercase 0x + 40 hex as token', () => {
      expect(detectInputType('0x' + 'A'.repeat(40))).toBe('token');
    });
  });

  // -------------------------------------------------------------------------
  // Loose hex fallback
  // -------------------------------------------------------------------------
  describe('Loose hex fallback', () => {
    it('returns wallet for 0x + hex with unexpected length', () => {
      expect(detectInputType('0xabcdef1234')).toBe('wallet');
    });

    it('returns txHash for 0x + 64 hex in loose check', () => {
      // This should match the strict regex first, but also through loose
      const hash = '0x' + 'f'.repeat(64);
      expect(detectInputType(hash)).toBe('txHash');
    });

    it('returns token for 0x + 40 hex in loose check', () => {
      const addr = '0x' + 'f'.repeat(40);
      expect(detectInputType(addr)).toBe('token');
    });
  });

  // -------------------------------------------------------------------------
  // Bitcoin address detection
  // -------------------------------------------------------------------------
  describe('Bitcoin address detection', () => {
    it('detects Legacy P2PKH address (starts with 1)', () => {
      expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('btcWallet');
    });

    it('detects P2SH address (starts with 3)', () => {
      expect(detectInputType('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('btcWallet');
    });

    it('detects Bech32 address (starts with bc1)', () => {
      expect(detectInputType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('btcWallet');
    });

    it('detects Bech32 address case-insensitively', () => {
      expect(detectInputType('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')).toBe('btcWallet');
    });

    it('detects broader BTC-like patterns (wrong length but correct prefix)', () => {
      // Too short for strict regex but has BTC prefix+charset
      expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL')).toBe('btcWallet');
    });

    it('detects broader bc1 patterns (wrong length)', () => {
      expect(detectInputType('bc1qtest123')).toBe('btcWallet');
    });
  });

  // -------------------------------------------------------------------------
  // Solana address detection
  // -------------------------------------------------------------------------
  describe('Solana address detection', () => {
    it('detects a Solana address (Base58, 32-44 chars)', () => {
      expect(detectInputType('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe('solanaToken');
    });

    it('detects Solana pump.fun style addresses', () => {
      expect(detectInputType('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe('solanaToken');
    });

    it('does not confuse BTC Legacy with Solana', () => {
      expect(detectInputType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('btcWallet');
    });

    it('does not confuse BTC P2SH with Solana', () => {
      expect(detectInputType('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('btcWallet');
    });

    it('does not confuse bc1 with Solana', () => {
      expect(detectInputType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('btcWallet');
    });
  });

  // -------------------------------------------------------------------------
  // Unknown input
  // -------------------------------------------------------------------------
  describe('Unknown input', () => {
    it('returns unknown for random text', () => {
      expect(detectInputType('hello world')).toBe('unknown');
    });

    it('returns unknown for empty-ish input', () => {
      expect(detectInputType('')).toBe('unknown');
    });

    it('returns unknown for special characters', () => {
      expect(detectInputType('@#$%^&*()')).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Whitespace trimming
  // -------------------------------------------------------------------------
  describe('whitespace handling', () => {
    it('trims leading/trailing spaces', () => {
      expect(detectInputType('  https://example.com  ')).toBe('url');
    });

    it('trims leading/trailing spaces for addresses', () => {
      expect(detectInputType('  0x' + 'a'.repeat(40) + '  ')).toBe('token');
    });
  });
});

// ============================================================================
// isBitcoinAddress — unit tests
// ============================================================================

describe('isBitcoinAddress', () => {
  it('returns true for valid Legacy P2PKH address', () => {
    expect(isBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
  });

  it('returns true for valid P2SH address', () => {
    expect(isBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
  });

  it('returns true for valid Bech32 address', () => {
    expect(isBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
  });

  it('returns true for Bech32 case-insensitive', () => {
    expect(isBitcoinAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')).toBe(true);
  });

  it('returns false for EVM address', () => {
    expect(isBitcoinAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isBitcoinAddress('hello')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBitcoinAddress('')).toBe(false);
  });

  it('returns false for too-short base58', () => {
    expect(isBitcoinAddress('1abc')).toBe(false);
  });

  it('returns false for base58 with invalid chars (0, O, I, l)', () => {
    expect(isBitcoinAddress('1O1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
  });
});

// ============================================================================
// isSolanaAddress — unit tests
// ============================================================================

describe('isSolanaAddress', () => {
  it('returns true for a valid Solana address', () => {
    expect(isSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true);
  });

  it('returns true for USDC mint on Solana', () => {
    expect(isSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
  });

  it('returns false for BTC Legacy address', () => {
    expect(isSolanaAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
  });

  it('returns false for BTC P2SH address', () => {
    expect(isSolanaAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(false);
  });

  it('returns false for BTC Bech32 address', () => {
    expect(isSolanaAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false);
  });

  it('returns false for EVM address', () => {
    expect(isSolanaAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(false);
  });

  it('returns false for too short string', () => {
    expect(isSolanaAddress('ABC123')).toBe(false);
  });

  it('returns false for string with invalid Base58 chars', () => {
    expect(isSolanaAddress('0000000000000000000000000000000000000000000')).toBe(false);
  });
});
