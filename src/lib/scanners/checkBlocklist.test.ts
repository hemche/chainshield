import { describe, it, expect } from 'vitest';
import { checkBlocklist, checkDomainBlocklist } from './checkBlocklist';

describe('checkBlocklist', () => {
  it('returns entry for known Tornado Cash address', () => {
    const result = checkBlocklist('0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('sanctioned');
    expect(result!.label).toContain('Tornado Cash');
  });

  it('returns entry for Lazarus Group address', () => {
    const result = checkBlocklist('0x098b716b8aaf21512996dc57eb0615e2383e2f96');
    expect(result).not.toBeNull();
    expect(result!.label).toContain('Lazarus');
  });

  it('returns entry for Inferno Drainer', () => {
    const result = checkBlocklist('0x000000dcb9a6efab015b66d0dde43a42ec3f848b');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('drainer');
  });

  it('returns entry for BTC scam address (Twitter 2020)', () => {
    const result = checkBlocklist('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    expect(result).not.toBeNull();
    expect(result!.label).toContain('Twitter Bitcoin Scam');
  });

  it('is case-insensitive', () => {
    const lower = checkBlocklist('0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3');
    const upper = checkBlocklist('0xD4B88DF4D29F5CEDD6857912842CFF3B20C8CFA3');
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(lower!.address).toBe(upper!.address);
  });

  it('returns null for unknown address', () => {
    const result = checkBlocklist('0x0000000000000000000000000000000000000001');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(checkBlocklist('')).toBeNull();
  });

  it('returns null for non-address string', () => {
    expect(checkBlocklist('hello-world')).toBeNull();
  });
});

describe('checkDomainBlocklist', () => {
  it('returns null (placeholder — not yet populated)', () => {
    expect(checkDomainBlocklist('scam.xyz')).toBeNull();
  });
});
