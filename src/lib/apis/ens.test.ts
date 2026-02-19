import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveEnsName, clearEnsCache } from './ens';

// Mock ethers JsonRpcProvider
const mockResolveName = vi.fn();

vi.mock('ethers', () => ({
  JsonRpcProvider: vi.fn().mockImplementation(() => ({
    resolveName: mockResolveName,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  clearEnsCache();
});

describe('resolveEnsName', () => {
  it('resolves a valid ENS name to an address', async () => {
    mockResolveName.mockResolvedValueOnce('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');

    const result = await resolveEnsName('vitalik.eth');
    expect(result.address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.error).toBeNull();
  });

  it('returns error for unresolvable ENS name', async () => {
    mockResolveName.mockResolvedValueOnce(null);

    const result = await resolveEnsName('nonexistent-random-name.eth');
    expect(result.address).toBeNull();
    expect(result.error).toBe('ENS name does not resolve to an address');
  });

  it('returns cached result on second call', async () => {
    mockResolveName.mockResolvedValueOnce('0xABC123');

    const first = await resolveEnsName('cached.eth');
    const second = await resolveEnsName('cached.eth');

    expect(first.address).toBe('0xABC123');
    expect(second.address).toBe('0xABC123');
    // Provider created only once (first call)
    expect(mockResolveName).toHaveBeenCalledTimes(1);
  });

  it('caches negative results (unresolvable names)', async () => {
    mockResolveName.mockResolvedValueOnce(null);

    const first = await resolveEnsName('notfound.eth');
    const second = await resolveEnsName('notfound.eth');

    expect(first.address).toBeNull();
    expect(second.address).toBeNull();
    expect(mockResolveName).toHaveBeenCalledTimes(1);
  });

  it('falls back to secondary RPC when primary fails', async () => {
    // Primary fails
    mockResolveName.mockRejectedValueOnce(new Error('RPC error'));
    // Fallback succeeds
    mockResolveName.mockResolvedValueOnce('0xFALLBACK');

    const result = await resolveEnsName('fallback.eth');
    expect(result.address).toBe('0xFALLBACK');
    expect(result.error).toBeNull();
  });

  it('returns error when both RPCs fail', async () => {
    mockResolveName.mockRejectedValueOnce(new Error('Primary down'));
    mockResolveName.mockRejectedValueOnce(new Error('Fallback down'));

    const result = await resolveEnsName('allfail.eth');
    expect(result.address).toBeNull();
    expect(result.error).toContain('ENS resolution failed');
    expect(result.error).toContain('Fallback down');
  });

  it('handles timeout', async () => {
    // Never resolves — will hit timeout
    mockResolveName.mockImplementationOnce(
      () => new Promise(() => {/* never resolves */})
    );
    // Fallback also never resolves
    mockResolveName.mockImplementationOnce(
      () => new Promise(() => {/* never resolves */})
    );

    const result = await resolveEnsName('slow.eth');
    expect(result.address).toBeNull();
    expect(result.error).toContain('timed out');
  }, 20_000);

  it('normalizes ENS name to lowercase', async () => {
    mockResolveName.mockResolvedValueOnce('0xABC');

    await resolveEnsName('VITALIK.ETH');
    // Second call with different case should hit cache
    const second = await resolveEnsName('vitalik.eth');

    expect(second.address).toBe('0xABC');
    expect(mockResolveName).toHaveBeenCalledTimes(1);
  });
});
