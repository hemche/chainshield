import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTokenSecurity,
  fetchPhishingSite,
  fetchAddressSecurity,
  fetchNftSecurity,
  clearGoPlusCache,
} from './goplus';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('mocked network error')),
  );
  clearGoPlusCache();
});

function mockGoPlusResponse(result: unknown, code = 1) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ code, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

// ---------------------------------------------------------------------------
// fetchTokenSecurity
// ---------------------------------------------------------------------------

describe('fetchTokenSecurity', () => {
  const ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';

  it('returns token security data on success', async () => {
    mockGoPlusResponse({
      [ADDRESS]: { is_honeypot: '0', is_open_source: '1', buy_tax: '0', sell_tax: '0' },
    });

    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.is_honeypot).toBe('0');
    expect(data!.is_open_source).toBe('1');
  });

  it('returns null when token not in database', async () => {
    mockGoPlusResponse({});

    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toContain('not found');
  });

  it('handles API timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toContain('timed out');
  });

  it('handles network error', async () => {
    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toContain('error');
  });

  it('handles non-200 status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 }),
    );

    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toContain('429');
  });

  it('handles GoPlus error code', async () => {
    mockGoPlusResponse({}, 0);

    const { data, error } = await fetchTokenSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toContain('code 0');
  });

  it('uses cache on repeated calls', async () => {
    mockGoPlusResponse({
      [ADDRESS]: { is_honeypot: '0' },
    });

    const first = await fetchTokenSecurity(ADDRESS, 1);
    const second = await fetchTokenSecurity(ADDRESS, 1);

    expect(first.data).toEqual(second.data);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('lowercases address for lookup', async () => {
    const mixed = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    mockGoPlusResponse({
      [mixed.toLowerCase()]: { is_honeypot: '1' },
    });

    const { data } = await fetchTokenSecurity(mixed, 1);
    expect(data!.is_honeypot).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// fetchPhishingSite
// ---------------------------------------------------------------------------

describe('fetchPhishingSite', () => {
  it('returns phishing=1 for known phishing site', async () => {
    mockGoPlusResponse({ phishing_site: 1 });

    const { phishing, error } = await fetchPhishingSite('https://fake-metamask.xyz');
    expect(error).toBeNull();
    expect(phishing).toBe(1);
  });

  it('returns phishing=0 for safe site', async () => {
    mockGoPlusResponse({ phishing_site: 0 });

    const { phishing, error } = await fetchPhishingSite('https://google.com');
    expect(error).toBeNull();
    expect(phishing).toBe(0);
  });

  it('handles API failure gracefully', async () => {
    const { phishing, error } = await fetchPhishingSite('https://example.com');
    expect(phishing).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// fetchAddressSecurity
// ---------------------------------------------------------------------------

describe('fetchAddressSecurity', () => {
  const ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  it('returns clean result for safe address', async () => {
    mockGoPlusResponse({
      phishing_activities: '0',
      honeypot_related_address: '0',
      stealing_attack: '0',
      blacklist_doubt: '0',
      money_laundering: '0',
      sanctioned: '0',
      mixer: '0',
    });

    const { data, error } = await fetchAddressSecurity(ADDRESS, 1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.phishing_activities).toBe('0');
    expect(data!.sanctioned).toBe('0');
  });

  it('returns flags for malicious address', async () => {
    mockGoPlusResponse({
      phishing_activities: '1',
      stealing_attack: '1',
    });

    const { data } = await fetchAddressSecurity(ADDRESS, 1);
    expect(data!.phishing_activities).toBe('1');
    expect(data!.stealing_attack).toBe('1');
  });

  it('handles API failure gracefully', async () => {
    const { data, error } = await fetchAddressSecurity(ADDRESS, 1);
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// fetchNftSecurity
// ---------------------------------------------------------------------------

describe('fetchNftSecurity', () => {
  const ADDRESS = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d';

  it('returns NFT data when found on Ethereum', async () => {
    // GoPlus NFT endpoint returns flat result (not nested under address)
    mockGoPlusResponse({
      nft_name: 'BoredApeYachtClub',
      nft_symbol: 'BAYC',
      nft_erc: 'erc721',
      malicious_nft_contract: 0,
      trust_list: 1,
    });

    const { data, chainId, error } = await fetchNftSecurity(ADDRESS);
    expect(error).toBeNull();
    expect(chainId).toBe(1);
    expect(data).toBeDefined();
    expect(data!.nft_name).toBe('BoredApeYachtClub');
    expect(data!.trust_list).toBe(1);
  });

  it('falls through to BSC when Ethereum has no data', async () => {
    // Ethereum: no nft_name/nft_erc → treated as no data
    mockGoPlusResponse({});
    // BSC: has data
    mockGoPlusResponse({ nft_name: 'BSC NFT', nft_erc: 'erc721' });

    const { data, chainId, error } = await fetchNftSecurity(ADDRESS);
    expect(error).toBeNull();
    expect(chainId).toBe(56);
    expect(data!.nft_name).toBe('BSC NFT');
  });

  it('returns null when no chain has data', async () => {
    // Mock empty results for all 3 chains
    mockGoPlusResponse({});
    mockGoPlusResponse({});
    mockGoPlusResponse({});

    const { data, chainId, error } = await fetchNftSecurity(ADDRESS);
    expect(data).toBeNull();
    expect(chainId).toBeNull();
    expect(error).toContain('not found');
  });

  it('handles API timeout on first chain and falls through', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);
    // BSC: has data
    mockGoPlusResponse({ nft_name: 'Fallback NFT', nft_erc: 'erc721' });

    const { data, chainId } = await fetchNftSecurity(ADDRESS);
    expect(chainId).toBe(56);
    expect(data!.nft_name).toBe('Fallback NFT');
  });

  it('returns error when all chains fail', async () => {
    // All 3 chain requests fail (default mock rejects)
    const { data, chainId, error } = await fetchNftSecurity(ADDRESS);
    expect(data).toBeNull();
    expect(chainId).toBeNull();
    expect(error).toBeTruthy();
  });

  it('uses cache on repeated calls', async () => {
    mockGoPlusResponse({ nft_name: 'CachedNFT', nft_erc: 'erc721' });

    const first = await fetchNftSecurity(ADDRESS);
    const second = await fetchNftSecurity(ADDRESS);

    expect(first.data).toEqual(second.data);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
