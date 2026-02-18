import { isAddress } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';

/**
 * Validate an EVM address using EIP-55 checksum rules.
 * - All lowercase: valid (no checksum to verify)
 * - Correctly checksummed mixed-case: valid
 * - Incorrectly checksummed mixed-case: invalid
 */
export function isValidEvmAddress(input: string): boolean {
  try {
    return isAddress(input);
  } catch {
    return false;
  }
}

/**
 * Validate a Bitcoin address using cryptographic checksum verification.
 * - Base58Check addresses (1..., 3...): double-SHA256 checksum
 * - Bech32 addresses (bc1...): Bech32/Bech32m checksum
 */
export function isValidBitcoinAddress(input: string): boolean {
  try {
    bitcoin.address.toOutputScript(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect whether an input is an EVM or BTC address and validate it.
 */
export function detectAddressType(input: string): {
  type: 'EVM' | 'BTC' | 'UNKNOWN';
  valid: boolean;
} {
  // EVM: 0x + 40 hex characters
  if (/^0x[a-fA-F0-9]{40}$/.test(input)) {
    return { type: 'EVM', valid: isValidEvmAddress(input) };
  }

  // BTC Base58: starts with 1 or 3, 26-35 chars, valid Base58 charset
  if (/^[13][1-9A-HJ-NP-Za-km-z]{24,33}$/.test(input)) {
    return { type: 'BTC', valid: isValidBitcoinAddress(input) };
  }

  // BTC Bech32: starts with bc1, lowercase, 42-62 chars
  if (/^bc1[a-z0-9]{38,59}$/.test(input)) {
    return { type: 'BTC', valid: isValidBitcoinAddress(input) };
  }

  return { type: 'UNKNOWN', valid: false };
}
