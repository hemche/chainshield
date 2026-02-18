import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeDomain,
  parseSemicolonCsv,
  fetchAsicList,
  fetchAmfList,
  checkDomainAgainstGovLists,
  clearGovListCache,
} from './govlists';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
beforeEach(() => {
  clearGovListCache();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// normalizeDomain
// ---------------------------------------------------------------------------
describe('normalizeDomain', () => {
  it('strips protocol and www', () => {
    expect(normalizeDomain('https://www.example.com')).toBe('example.com');
  });

  it('strips path, query, hash', () => {
    expect(normalizeDomain('https://example.com/path?q=1#hash')).toBe('example.com');
  });

  it('lowercases', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('strips trailing dots', () => {
    expect(normalizeDomain('example.com.')).toBe('example.com');
  });
});

// ---------------------------------------------------------------------------
// parseSemicolonCsv
// ---------------------------------------------------------------------------
describe('parseSemicolonCsv', () => {
  it('parses semicolon-delimited CSV', () => {
    const csv = '"nom";"catégorie"\n"example.com";"Forex"\n"scam.xyz";"Crypto"';
    const rows = parseSemicolonCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['"example.com"', '"Forex"']);
  });

  it('strips UTF-8 BOM', () => {
    const csv = '\uFEFF"nom";"cat"\n"test.com";"Fraud"';
    const rows = parseSemicolonCsv(csv);
    expect(rows[0][0]).toBe('"nom"');
  });
});

// ---------------------------------------------------------------------------
// fetchAsicList
// ---------------------------------------------------------------------------
describe('fetchAsicList', () => {
  it('parses ASIC JSON and finds domains', async () => {
    const asicData = [
      {
        name: 'Scam Corp',
        categories: ['Crypto asset'],
        websites: ['https://www.scam-crypto.com/register', 'http://scam-crypto.net'],
      },
      {
        name: 'Another Scam',
        categories: ['Forex'],
        websites: [null, 'https://another-scam.xyz'],
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(asicData),
    }));

    const result = await fetchAsicList();
    expect(result.domains.has('scam-crypto.com')).toBe(true);
    expect(result.domains.has('scam-crypto.net')).toBe(true);
    expect(result.domains.has('another-scam.xyz')).toBe(true);
    expect(result.meta.get('scam-crypto.com')?.name).toBe('Scam Corp');
  });

  it('normalizes www prefix in ASIC websites', async () => {
    const asicData = [
      { name: 'WWW Test', websites: ['https://www.example-scam.com'] },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(asicData),
    }));

    const result = await fetchAsicList();
    expect(result.domains.has('example-scam.com')).toBe(true);
  });

  it('skips entries with null websites array', async () => {
    const asicData = [
      { name: 'No Websites', categories: ['Scam'] },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(asicData),
    }));

    const result = await fetchAsicList();
    expect(result.domains.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchAmfList
// ---------------------------------------------------------------------------
describe('fetchAmfList', () => {
  it('parses AMF CSV and finds domain entries', async () => {
    const csv = '"nom";"catégorie"\n"scam-forex.com";"Forex"\n"crypto-fraud.io";"Crypto-actifs"';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(csv),
    }));

    const result = await fetchAmfList();
    expect(result.domains.has('scam-forex.com')).toBe(true);
    expect(result.domains.has('crypto-fraud.io')).toBe(true);
    expect(result.meta.get('scam-forex.com')?.category).toBe('Forex');
  });

  it('ignores email entries from AMF', async () => {
    const csv = '"nom";"catégorie"\n"contact@scam.com";"Forex"\n"real-scam.com";"Crypto"';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(csv),
    }));

    const result = await fetchAmfList();
    expect(result.domains.has('contact@scam.com')).toBe(false);
    expect(result.domains.has('real-scam.com')).toBe(true);
  });

  it('ignores company name entries (no dot)', async () => {
    const csv = '"nom";"catégorie"\n"Société Frauduleuse SARL";"Forex"\n"scam-site.fr";"Forex"';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(csv),
    }));

    const result = await fetchAmfList();
    expect(result.domains.size).toBe(1);
    expect(result.domains.has('scam-site.fr')).toBe(true);
  });

  it('handles UTF-8 BOM in AMF CSV', async () => {
    const csv = '\uFEFF"nom";"catégorie"\n"bom-test.com";"Forex"';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(csv),
    }));

    const result = await fetchAmfList();
    expect(result.domains.has('bom-test.com')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkDomainAgainstGovLists
// ---------------------------------------------------------------------------
describe('checkDomainAgainstGovLists', () => {
  it('returns ASIC match when domain is in ASIC list', async () => {
    const mockFetch = vi.fn();

    // First call: ASIC
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Crypto Scam Inc', categories: ['Crypto asset'], websites: ['https://evil-crypto.com'] },
      ]),
    });
    // Second call: AMF
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('"nom";"catégorie"\n"other.com";"Forex"'),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await checkDomainAgainstGovLists('evil-crypto.com');
    expect(result.found).toBe(true);
    expect(result.source).toBe('ASIC MoneySmart (Australia)');
    expect(result.entityName).toBe('Crypto Scam Inc');
  });

  it('returns AMF match when domain is in AMF list but not ASIC', async () => {
    const mockFetch = vi.fn();

    // ASIC
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    // AMF
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('"nom";"catégorie"\n"fraud-forex.fr";"Forex"'),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await checkDomainAgainstGovLists('fraud-forex.fr');
    expect(result.found).toBe(true);
    expect(result.source).toBe('AMF France');
  });

  it('returns not found when domain is clean', async () => {
    const mockFetch = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('"nom";"catégorie"\n"other.com";"Forex"'),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await checkDomainAgainstGovLists('safe-domain.com');
    expect(result.found).toBe(false);
    expect(result.source).toBeNull();
    expect(result.error).toBeNull();
  });

  it('degrades gracefully when both APIs fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await checkDomainAgainstGovLists('any-domain.com');
    expect(result.found).toBe(false);
    expect(result.error).toBe('Government databases unavailable');
  });

  it('uses cached data on second call (only 2 fetches total)', async () => {
    const mockFetch = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Test', websites: ['https://cached-test.com'] },
      ]),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('"nom";"catégorie"'),
    });

    vi.stubGlobal('fetch', mockFetch);

    // First call — fetches both
    await checkDomainAgainstGovLists('cached-test.com');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call — uses cache
    const result = await checkDomainAgainstGovLists('cached-test.com');
    expect(result.found).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2); // No additional fetches
  });

  it('returns AMF result when ASIC times out', async () => {
    const mockFetch = vi.fn();

    // ASIC times out
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('aborted')));
    // AMF succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('"nom";"catégorie"\n"timeout-test.com";"Crypto"'),
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await checkDomainAgainstGovLists('timeout-test.com');
    expect(result.found).toBe(true);
    expect(result.source).toBe('AMF France');
  });
});
