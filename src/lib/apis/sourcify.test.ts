import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchContractVerification } from './sourcify';

const ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('mocked network error')),
  );
});

describe('fetchContractVerification', () => {
  it('returns verified=true for verified contract', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ isVerified: true }), { status: 200 }),
    );

    const { isVerified, error } = await fetchContractVerification(ADDRESS, 1);
    expect(error).toBeNull();
    expect(isVerified).toBe(true);
  });

  it('returns verified=false for 404 (not found in Sourcify)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Not found', { status: 404 }),
    );

    const { isVerified, error } = await fetchContractVerification(ADDRESS, 1);
    expect(error).toBeNull();
    expect(isVerified).toBe(false);
  });

  it('returns null on non-200/non-404 status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Error', { status: 500 }),
    );

    const { isVerified, error } = await fetchContractVerification(ADDRESS, 1);
    expect(isVerified).toBeNull();
    expect(error).toContain('500');
  });

  it('handles timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const { isVerified, error } = await fetchContractVerification(ADDRESS, 1);
    expect(isVerified).toBeNull();
    expect(error).toContain('timed out');
  });

  it('handles network error', async () => {
    const { isVerified, error } = await fetchContractVerification(ADDRESS, 1);
    expect(isVerified).toBeNull();
    expect(error).toBeTruthy();
  });

  it('handles string "true" for isVerified', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ isVerified: 'true' }), { status: 200 }),
    );

    const { isVerified } = await fetchContractVerification(ADDRESS, 1);
    expect(isVerified).toBe(true);
  });

  it('returns false when response has isVerified=false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ isVerified: false }), { status: 200 }),
    );

    const { isVerified } = await fetchContractVerification(ADDRESS, 1);
    expect(isVerified).toBe(false);
  });
});
