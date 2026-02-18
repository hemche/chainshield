import { InputType } from '@/types';

// Base58Check: starts with 1 or 3, valid Base58 charset (no 0, O, I, l), 26-35 chars
const BTC_BASE58_RE = /^[13][1-9A-HJ-NP-Za-km-z]{24,33}$/;
// Bech32/Bech32m: starts with bc1, alphanumeric, 42-62 chars (case-insensitive per BIP-173)
const BTC_BECH32_RE = /^bc1[a-z0-9]{38,59}$/i;
// Solana: Base58, 32-44 chars, same charset as BTC but NOT starting with 1/3/bc1
const SOLANA_RE = /^[2-9A-HJ-NP-Za-km-z][1-9A-HJ-NP-Za-km-z]{31,43}$/;

export function isBitcoinAddress(input: string): boolean {
  return BTC_BASE58_RE.test(input) || BTC_BECH32_RE.test(input);
}

export function isSolanaAddress(input: string): boolean {
  // Must match Base58 pattern, 32-44 chars, and NOT match BTC patterns
  return SOLANA_RE.test(input) && !isBitcoinAddress(input);
}

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();

  // URL detection
  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    return 'url';
  }

  // Domain-like patterns (e.g., something.com)
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(trimmed) && !trimmed.startsWith('0x')) {
    return 'url';
  }

  // Transaction hash: 0x followed by 64 hex characters
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return 'txHash';
  }

  // Contract/wallet address: 0x followed by 40 hex characters
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    // Could be either token contract or wallet — we try token first
    return 'token';
  }

  // Loose hex check for partial addresses
  if (/^0x[a-fA-F0-9]+$/.test(trimmed)) {
    if (trimmed.length === 66) return 'txHash';
    if (trimmed.length === 42) return 'token';
    return 'wallet';
  }

  // Bitcoin address detection (Legacy, P2SH, Bech32) — must check before Solana
  if (isBitcoinAddress(trimmed)) {
    return 'btcWallet';
  }

  // Solana address detection (Base58, 32-44 chars, not BTC)
  if (isSolanaAddress(trimmed)) {
    return 'solanaToken';
  }

  // Broader BTC-like detection: correct prefix and charset but wrong length
  // These get routed through checksum validation in scanInput()
  if (/^[13][1-9A-HJ-NP-Za-km-z]{19,49}$/.test(trimmed)) {
    return 'btcWallet';
  }
  if (/^bc1[a-z0-9]{5,69}$/i.test(trimmed)) {
    return 'btcWallet';
  }

  return 'unknown';
}
