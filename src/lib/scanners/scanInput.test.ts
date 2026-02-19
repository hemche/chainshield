import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanInput } from './index';

// Mock all scanner modules to isolate scanInput routing logic
vi.mock('./scanUrl', () => ({
  scanUrl: vi.fn().mockResolvedValue({
    inputType: 'url', inputValue: 'https://example.com', riskScore: 5, riskLevel: 'SAFE',
    confidence: 'HIGH', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [], recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanToken', () => ({
  scanToken: vi.fn().mockResolvedValue({
    inputType: 'token', inputValue: '0x' + 'a'.repeat(40), riskScore: 5, riskLevel: 'SAFE',
    confidence: 'HIGH', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [{ message: 'DexScreener data available', severity: 'low' }],
    recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanTxHash', () => ({
  scanTxHash: vi.fn().mockResolvedValue({
    inputType: 'txHash', inputValue: '0x' + 'a'.repeat(64), riskScore: 8, riskLevel: 'SAFE',
    confidence: 'MEDIUM', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [], recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanWallet', () => ({
  scanWallet: vi.fn().mockResolvedValue({
    inputType: 'wallet', inputValue: '0x' + 'a'.repeat(40), riskScore: 5, riskLevel: 'SAFE',
    confidence: 'MEDIUM', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [], recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanBtcWallet', () => ({
  scanBtcWallet: vi.fn().mockResolvedValue({
    inputType: 'btcWallet', inputValue: 'bc1test', riskScore: 5, riskLevel: 'SAFE',
    confidence: 'MEDIUM', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [], recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanSolanaToken', () => ({
  scanSolanaToken: vi.fn().mockResolvedValue({
    inputType: 'solanaToken', inputValue: 'SolAddr', riskScore: 5, riskLevel: 'SAFE',
    confidence: 'MEDIUM', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [], recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanEns', () => ({
  scanEns: vi.fn().mockResolvedValue({
    inputType: 'ens', inputValue: 'vitalik.eth', riskScore: 5, riskLevel: 'SAFE',
    confidence: 'MEDIUM', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [{ message: 'ENS name resolved', severity: 'info' }],
    recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

vi.mock('./scanInvalidAddress', () => ({
  scanInvalidAddress: vi.fn().mockResolvedValue({
    inputType: 'invalidAddress', inputValue: 'bad', riskScore: 70, riskLevel: 'DANGEROUS',
    confidence: 'HIGH', confidenceReason: 'mock', summary: 'mock', scoreBreakdown: [],
    findings: [{ message: 'Invalid address', severity: 'danger' }],
    recommendations: [], timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

// Mock validation functions
vi.mock('@/lib/validation/addressValidation', () => ({
  isValidEvmAddress: vi.fn().mockReturnValue(true),
  isValidBitcoinAddress: vi.fn().mockReturnValue(true),
}));

import { scanUrl } from './scanUrl';
import { scanToken } from './scanToken';
import { scanTxHash } from './scanTxHash';
import { scanWallet } from './scanWallet';
import { scanBtcWallet } from './scanBtcWallet';
import { scanSolanaToken } from './scanSolanaToken';
import { scanInvalidAddress } from './scanInvalidAddress';
import { scanEns } from './scanEns';
import { isValidEvmAddress, isValidBitcoinAddress } from '@/lib/validation/addressValidation';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// scanInput — routing tests
// ============================================================================

describe('scanInput', () => {
  // -------------------------------------------------------------------------
  // Empty / no input
  // -------------------------------------------------------------------------
  describe('empty input', () => {
    it('returns SAFE report with "No input provided" for empty string', async () => {
      const report = await scanInput('');
      expect(report.inputType).toBe('unknown');
      expect(report.riskScore).toBe(0);
      expect(report.riskLevel).toBe('SAFE');
      expect(report.findings[0].message).toBe('No input provided');
    });

    it('returns SAFE report for whitespace-only input', async () => {
      const report = await scanInput('   ');
      expect(report.inputType).toBe('unknown');
      expect(report.riskScore).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // URL routing
  // -------------------------------------------------------------------------
  describe('URL routing', () => {
    it('routes https:// URLs to scanUrl', async () => {
      await scanInput('https://example.com');
      expect(scanUrl).toHaveBeenCalledWith('https://example.com');
    });

    it('routes bare domains to scanUrl', async () => {
      await scanInput('uniswap.org');
      expect(scanUrl).toHaveBeenCalledWith('uniswap.org');
    });
  });

  // -------------------------------------------------------------------------
  // Transaction hash routing
  // -------------------------------------------------------------------------
  describe('Transaction hash routing', () => {
    it('routes 0x + 64 hex to scanTxHash', async () => {
      const hash = '0x' + 'a'.repeat(64);
      await scanInput(hash);
      expect(scanTxHash).toHaveBeenCalledWith(hash);
    });
  });

  // -------------------------------------------------------------------------
  // Token routing + fallback to wallet
  // -------------------------------------------------------------------------
  describe('Token routing', () => {
    it('routes 0x + 40 hex to scanToken when EVM address is valid', async () => {
      const addr = '0x' + 'a'.repeat(40);
      await scanInput(addr);
      expect(scanToken).toHaveBeenCalledWith(addr);
    });

    it('routes to scanInvalidAddress when EVM checksum fails', async () => {
      vi.mocked(isValidEvmAddress).mockReturnValueOnce(false);
      const addr = '0x' + 'a'.repeat(40);
      await scanInput(addr);
      expect(scanInvalidAddress).toHaveBeenCalledWith(addr);
      expect(scanToken).not.toHaveBeenCalled();
    });

    it('falls back to scanWallet when token scan finds no liquidity pairs', async () => {
      vi.mocked(scanToken).mockResolvedValueOnce({
        inputType: 'token',
        inputValue: '0x' + 'a'.repeat(40),
        riskScore: 65,
        riskLevel: 'DANGEROUS',
        confidence: 'LOW',
        confidenceReason: 'mock',
        summary: 'mock',
        scoreBreakdown: [],
        findings: [
          { message: 'Token has no liquidity pairs on DexScreener', severity: 'danger' },
        ],
        recommendations: [],
        timestamp: '2026-01-01T00:00:00.000Z',
      });

      const addr = '0x' + 'a'.repeat(40);
      const report = await scanInput(addr);
      expect(scanToken).toHaveBeenCalledWith(addr);
      expect(scanWallet).toHaveBeenCalledWith(addr);
      expect(report.inputType).toBe('wallet');
    });

    it('does NOT fall back to wallet when token has pairs', async () => {
      const addr = '0x' + 'a'.repeat(40);
      const report = await scanInput(addr);
      expect(scanToken).toHaveBeenCalledWith(addr);
      expect(scanWallet).not.toHaveBeenCalled();
      expect(report.inputType).toBe('token');
    });
  });

  // -------------------------------------------------------------------------
  // Wallet routing
  // -------------------------------------------------------------------------
  describe('Wallet routing', () => {
    it('routes loose 0x hex (non-standard length) to scanWallet after validation', async () => {
      // 0x + 20 hex chars — not 40 or 64, so detectInputType returns 'wallet'
      // But isValidEvmAddress mock returns true
      const addr = '0x' + 'ab'.repeat(10);
      // This is length 22, which is 0x + 20 hex. detectInput will return 'wallet'
      await scanInput(addr);
      expect(scanWallet).toHaveBeenCalled();
    });

    it('routes to scanInvalidAddress for invalid wallet address', async () => {
      vi.mocked(isValidEvmAddress).mockReturnValueOnce(false);
      const addr = '0x' + 'ab'.repeat(10);
      await scanInput(addr);
      expect(scanInvalidAddress).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // BTC wallet routing
  // -------------------------------------------------------------------------
  describe('BTC wallet routing', () => {
    it('routes valid BTC address to scanBtcWallet', async () => {
      await scanInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      expect(scanBtcWallet).toHaveBeenCalled();
    });

    it('routes to scanInvalidAddress when BTC checksum fails', async () => {
      vi.mocked(isValidBitcoinAddress).mockReturnValueOnce(false);
      await scanInput('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
      expect(scanInvalidAddress).toHaveBeenCalled();
      expect(scanBtcWallet).not.toHaveBeenCalled();
    });

    it('routes Legacy BTC address to scanBtcWallet', async () => {
      await scanInput('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      expect(scanBtcWallet).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // ENS name routing
  // -------------------------------------------------------------------------
  describe('ENS name routing', () => {
    it('routes *.eth names to scanEns', async () => {
      await scanInput('vitalik.eth');
      expect(scanEns).toHaveBeenCalledWith('vitalik.eth');
    });

    it('routes subdomain ENS names to scanEns', async () => {
      await scanInput('pay.vitalik.eth');
      expect(scanEns).toHaveBeenCalledWith('pay.vitalik.eth');
    });
  });

  // -------------------------------------------------------------------------
  // Solana token routing
  // -------------------------------------------------------------------------
  describe('Solana token routing', () => {
    it('routes Solana addresses to scanSolanaToken', async () => {
      await scanInput('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      expect(scanSolanaToken).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Unknown input — default branch
  // -------------------------------------------------------------------------
  describe('Unknown input', () => {
    it('returns SUSPICIOUS for completely unrecognized input', async () => {
      const report = await scanInput('!@#$%^&*()');
      expect(report.inputType).toBe('unknown');
      expect(report.riskLevel).toBe('SUSPICIOUS');
      expect(report.riskScore).toBe(50);
    });

    it('returns SAFE with LOW confidence for wallet-like alphanumeric strings', async () => {
      // 30-char alphanumeric that doesn't match any known format
      const report = await scanInput('ABCDEFGHIJKLMNOPQRSTUVWXYZabcd');
      expect(report.riskLevel).toBe('SAFE');
      expect(report.riskScore).toBe(5);
      expect(report.confidence).toBe('LOW');
    });

    it('routes BTC-like prefix with wrong chars to scanInvalidAddress', async () => {
      // Starts with 1, length 25, but not BTC valid
      vi.mocked(isValidBitcoinAddress).mockReturnValueOnce(false);
      // This input looks like BTC (starts with 1, correct-ish length) but has invalid chars
      // The broader regex in detectInput would catch it as btcWallet
      await scanInput('1AAAAAAAAAAAAAAAAAAAAAAAAA');
      // Should go through btcWallet path → isValidBitcoinAddress returns false → scanInvalidAddress
      expect(scanInvalidAddress).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Whitespace trimming
  // -------------------------------------------------------------------------
  describe('whitespace handling', () => {
    it('trims input before routing', async () => {
      await scanInput('  https://example.com  ');
      expect(scanUrl).toHaveBeenCalledWith('https://example.com');
    });
  });
});
