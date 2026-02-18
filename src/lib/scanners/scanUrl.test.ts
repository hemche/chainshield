import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanUrl } from './scanUrl';
import { SafetyReport, UrlMetadata, CheckItem } from '@/types';

// Mock GoPlus module to prevent it from consuming reachability fetch mocks.
// By default, GoPlus returns null (API unavailable) for graceful degradation.
vi.mock('@/lib/apis/goplus', () => ({
  fetchPhishingSite: vi.fn().mockResolvedValue({ phishing: null, error: 'mocked' }),
  clearGoPlusCache: vi.fn(),
}));

import { fetchPhishingSite } from '@/lib/apis/goplus';

// ---------------------------------------------------------------------------
// Mock global fetch so no real HTTP calls are made.
// By default every fetch rejects (simulating unreachable host).
// Individual tests can override via vi.mocked(fetch).mockResolvedValueOnce(...)
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('mocked network error')),
  );
  vi.mocked(fetchPhishingSite).mockResolvedValue({ phishing: null, error: 'mocked' });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function allFindings(report: SafetyReport): string {
  return report.findings.map((f) => f.message).join(' | ');
}

/** Create a 301 Response with a Location header to simulate a redirect hop */
function make301(location: string, status = 301) {
  return new Response(null, { status, headers: { location } });
}

/** Create a 200 OK Response to end a redirect chain */
function make200() {
  return new Response(null, { status: 200 });
}

// =========================================================================
// 1) Suspicious Keyword Detection
// =========================================================================
describe('Suspicious keyword detection', () => {
  const keywordUrls = [
    { url: 'https://binance-airdrop-claim.example', keywords: ['airdrop', 'claim'] },
    { url: 'https://metamask-verify-wallet.example', keywords: ['metamask', 'verify'] },
    { url: 'https://ledger-verify-support.example', keywords: ['ledger', 'verify', 'support'] },
    { url: 'https://claim-free-eth-now.example', keywords: ['claim', 'free'] },
    { url: 'https://coinbase-support-verify-login.example', keywords: ['support', 'verify'] },
    { url: 'https://free-giveaway-bonus.example', keywords: ['free', 'giveaway', 'bonus'] },
    { url: 'https://nft-mint-rewards.example', keywords: ['nft-mint', 'reward'] },
  ];

  for (const { url, keywords } of keywordUrls) {
    it(`flags "${url}" for keywords: ${keywords.join(', ')}`, async () => {
      const report = await scanUrl(url);

      expect(report.riskLevel).not.toBe('SAFE');
      expect(report.riskScore).toBeGreaterThan(30);

      const findings = allFindings(report);
      expect(findings).toContain('scam-associated keywords');
      for (const kw of keywords) {
        expect(findings.toLowerCase()).toContain(kw);
      }
    });
  }
});

// =========================================================================
// 2) Suspicious TLD Detection
// =========================================================================
describe('Suspicious TLD detection', () => {
  const tldUrls = [
    { url: 'https://binance-claim.xyz', tld: '.xyz' },
    { url: 'https://airdrop-rewards.top', tld: '.top' },
    { url: 'https://wallet-verify.click', tld: '.click' },
    { url: 'https://crypto-bonus.vip', tld: '.vip' },
    { url: 'https://some-token.monster', tld: '.monster' },
    { url: 'https://defi-stake.site', tld: '.site' },
  ];

  for (const { url, tld } of tldUrls) {
    it(`flags TLD "${tld}" in "${url}"`, async () => {
      const report = await scanUrl(url);

      expect(report.riskScore).toBeGreaterThan(0);

      const findings = allFindings(report);
      expect(findings).toContain(`Suspicious domain extension: ${tld}`);
    });
  }
});

// =========================================================================
// 3) Unicode / Homoglyph Attack Detection
// =========================================================================
describe('Unicode / homoglyph attack detection', () => {
  // These contain non-ASCII characters that look like ASCII ones
  const unicodeUrls = [
    'https://b\u00ECnance.example',         // ì instead of i
    'https://met\u0430mask.example',         // Cyrillic а instead of Latin a
    'https://c\u00F2inbase.example',         // ò instead of o
  ];

  for (const url of unicodeUrls) {
    it(`flags unicode characters in "${url}"`, async () => {
      const report = await scanUrl(url);

      expect(report.riskLevel).not.toBe('SAFE');

      const findings = allFindings(report);
      expect(findings).toMatch(/non-ASCII|unicode|homoglyph|punycode/i);
    });
  }

  it('flags punycode-encoded domains (xn--)', async () => {
    const report = await scanUrl('https://xn--bnance-hya.example');

    const findings = allFindings(report);
    expect(findings).toMatch(/punycode/i);
  });
});

// =========================================================================
// 4) IP Address URL Detection
// =========================================================================
describe('IP address URL detection', () => {
  it('flags http://192.168.0.1/claim as DANGEROUS', async () => {
    const report = await scanUrl('http://192.168.0.1/claim');

    // http (25) + IP (25) + keyword "claim" (15) + unreachable (15) = 80
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(allFindings(report)).toContain('IP address');
  });

  it('flags http://104.21.44.99/login', async () => {
    const report = await scanUrl('http://104.21.44.99/login');

    // http (25) + IP (25) + unreachable (15) = 65
    expect(report.riskScore).toBeGreaterThan(40);
    expect(allFindings(report)).toContain('IP address');
    expect(allFindings(report)).toContain('HTTPS');
  });

  it('flags https IP-based URL', async () => {
    const report = await scanUrl('https://10.0.0.1/dashboard');

    expect(allFindings(report)).toContain('IP address');
    expect(report.riskScore).toBeGreaterThanOrEqual(25);
  });
});

// =========================================================================
// 5) HTTP (Not HTTPS) Detection
// =========================================================================
describe('HTTP (not HTTPS) detection', () => {
  it('flags http:// URL as insecure', async () => {
    const report = await scanUrl('http://binance-airdrop.example');

    const findings = allFindings(report);
    expect(findings).toContain('HTTPS');
    expect(report.riskScore).toBeGreaterThan(0);
  });

  it('http increases risk score vs equivalent https', async () => {
    const [httpReport, httpsReport] = await Promise.all([
      scanUrl('http://some-site.example'),
      scanUrl('https://some-site.example'),
    ]);

    expect(httpReport.riskScore).toBeGreaterThan(httpsReport.riskScore);
  });

  it('does not flag https URLs for HTTPS issue', async () => {
    const report = await scanUrl('https://safe-domain.example');

    const findings = allFindings(report);
    expect(findings).not.toContain('does not use HTTPS');
  });
});

// =========================================================================
// 6) Very Long Domain Detection
// =========================================================================
describe('Very long domain detection', () => {
  it('flags unusually long domain names', async () => {
    const report = await scanUrl(
      'https://binance-airdrop-claim-free-reward-verify-support-login.example',
    );

    expect(report.riskLevel).not.toBe('SAFE');
    expect(allFindings(report)).toContain('long domain');
  });

  it('flags domain with many hyphens', async () => {
    const report = await scanUrl(
      'https://a-b-c-d-e-f-g-h-i-j.example',
    );

    expect(allFindings(report)).toContain('hyphens');
  });
});

// =========================================================================
// 7) Subdomain Tricks
// =========================================================================
describe('Subdomain spoofing tricks', () => {
  const spoofedUrls = [
    {
      url: 'https://binance.com.claim-airdrop.example',
      brand: 'binance',
    },
    {
      url: 'https://metamask.io.secure-login.example',
      brand: 'metamask',
    },
    {
      url: 'https://coinbase.com.verify-account.example',
      brand: 'coinbase',
    },
  ];

  for (const { url, brand } of spoofedUrls) {
    it(`detects subdomain spoofing of "${brand}" in "${url}"`, async () => {
      const report = await scanUrl(url);

      expect(report.riskLevel).not.toBe('SAFE');

      const findings = allFindings(report);
      expect(findings.toLowerCase()).toContain('subdomain');
      expect(findings.toLowerCase()).toContain(brand);
    });
  }

  it('does NOT flag legitimate subdomains (e.g., app.binance.com)', async () => {
    // binance.com is trusted; app.binance.com should resolve to the trusted domain
    // The registered domain is binance.com which IS in the trusted list
    const report = await scanUrl('https://app.binance.com');

    // Trusted domain → early exit → SAFE
    expect(report.riskLevel).toBe('SAFE');
  });
});

// =========================================================================
// 8) Normal Safe Websites
// =========================================================================
describe('Normal safe websites', () => {
  const safeUrls = [
    'https://www.google.com',
    'https://github.com',
    'https://www.coinbase.com',
    'https://www.binance.com',
    'https://ethereum.org',
  ];

  for (const url of safeUrls) {
    it(`rates "${url}" as SAFE`, async () => {
      const report = await scanUrl(url);

      expect(report.riskLevel).toBe('SAFE');
      expect(report.riskScore).toBeLessThan(30);
    });
  }
});

// =========================================================================
// 9) Invalid URL Input
// =========================================================================
describe('Invalid URL input', () => {
  const invalidInputs = [
    'not a url',
    'binance',
    'htp://wrong.com',
  ];

  for (const input of invalidInputs) {
    it(`handles invalid input "${input}" without crashing`, async () => {
      // Should either throw or return a report — must not crash unexpectedly
      let report: SafetyReport | null = null;
      let threw = false;

      try {
        report = await scanUrl(input);
      } catch {
        threw = true;
      }

      if (threw) {
        // Throwing is acceptable for invalid input
        expect(threw).toBe(true);
      } else {
        // If it returns a report, it should signal risk
        expect(report).not.toBeNull();
        expect(report!.riskScore).toBeGreaterThanOrEqual(5);
        expect(report!.findings.length).toBeGreaterThan(0);
      }
    });
  }
});

// =========================================================================
// 10) Redirect detection (with mocked fetch)
// =========================================================================
describe('Redirect detection', () => {
  it('same-domain redirect — info severity, score impact 0', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://www.microsoft.com/en-ca/'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://www.microsoft.com');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBe(5); // floor only

    const redirectFinding = report.findings.find(f => f.message.includes('same domain'));
    expect(redirectFinding).toBeDefined();
    expect(redirectFinding!.severity).toBe('info');

    const meta = report.metadata as UrlMetadata;
    expect(meta.redirectCount).toBe(1);
    expect(meta.redirectedTo).toBe('https://www.microsoft.com/en-ca/');
  });

  it('cross-domain redirect — danger severity, score impact 30', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://evil-site.example/phish'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://short-link.example');

    const findings = allFindings(report);
    expect(findings).toContain('redirects to a different domain');

    const redirectFinding = report.findings.find(f => f.message.includes('different domain'));
    expect(redirectFinding).toBeDefined();
    expect(redirectFinding!.severity).toBe('danger');

    const meta = report.metadata as UrlMetadata;
    expect(meta.redirectedTo).toBe('https://evil-site.example/phish');
    expect(meta.redirectCount).toBe(1);

    // scoreOverride 30 → score = max(5, 30) = 30
    expect(report.riskScore).toBeGreaterThanOrEqual(30);
  });

  it('cross-domain redirect to suspicious TLD — danger severity, score impact 50', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://scam.xyz/phish'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://example.com');

    const findings = allFindings(report);
    expect(findings).toContain('suspicious TLD');

    const redirectFinding = report.findings.find(f => f.message.includes('suspicious TLD'));
    expect(redirectFinding).toBeDefined();
    expect(redirectFinding!.severity).toBe('danger');

    // scoreOverride 50 → score >= 50
    expect(report.riskScore).toBeGreaterThanOrEqual(50);
  });

  it('multi-hop redirect (>=3 hops) — adds warning finding', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://same.example/step2'))
      .mockResolvedValueOnce(make301('https://same.example/step3'))
      .mockResolvedValueOnce(make301('https://same.example/step4'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://same.example');

    const findings = allFindings(report);
    expect(findings).toContain('multiple redirects');

    const multihopFinding = report.findings.find(f => f.message.includes('multiple redirects'));
    expect(multihopFinding).toBeDefined();
    expect(multihopFinding!.severity).toBe('medium');

    const meta = report.metadata as UrlMetadata;
    expect(meta.redirectCount).toBe(3);

    // Same-domain info (0) + multi-hop medium override (10) = 10
    expect(report.riskScore).toBeGreaterThanOrEqual(10);
  });

  it('handles a fetch that succeeds with 200 (no redirect)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://normal-site.example');

    const findings = allFindings(report);
    expect(findings).not.toContain('redirect');
    expect(findings).not.toContain('URL unreachable');
    expect(findings).not.toContain('blocked');
  });
});

// =========================================================================
// 11) Combined signals (stacking)
// =========================================================================
describe('Combined risk signal stacking', () => {
  it('stacks multiple signals for extremely suspicious URL', async () => {
    // http + suspicious TLD + scam keywords + long domain + many hyphens + unreachable
    const report = await scanUrl(
      'http://free-airdrop-claim-bonus-reward-verify-wallet.xyz',
    );

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThan(60);
    expect(report.findings.length).toBeGreaterThanOrEqual(3);
  });
});

// =========================================================================
// 12) Report structure validation
// =========================================================================
describe('Report structure', () => {
  it('returns a valid SafetyReport shape', async () => {
    const report = await scanUrl('https://example.com');

    expect(report.inputType).toBe('url');
    expect(report.inputValue).toBe('https://example.com');
    expect(typeof report.riskScore).toBe('number');
    expect(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).toContain(report.riskLevel);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(typeof report.timestamp).toBe('string');
    expect(() => new Date(report.timestamp)).not.toThrow();
    // New fields
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(report.confidence);
    expect(typeof report.confidenceReason).toBe('string');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.scoreBreakdown)).toBe(true);
    // checksPerformed
    expect(Array.isArray(report.checksPerformed)).toBe(true);
    expect(report.checksPerformed!.length).toBeGreaterThan(0);
  });

  it('includes metadata with isHttps field', async () => {
    const report = await scanUrl('https://example.com');

    expect(report.metadata).toBeDefined();
    expect((report.metadata as UrlMetadata).isHttps).toBe(true);
  });

  it('riskScore is clamped between 5 and 100', async () => {
    const report = await scanUrl(
      'http://free-airdrop-claim-verify-bonus-reward-giveaway-metamask-ledger-support-connectwallet.xyz',
    );

    expect(report.riskScore).toBeLessThanOrEqual(100);
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
  });
});

// =========================================================================
// 13) URL Reachability — structured detection
// =========================================================================
describe('URL reachability detection', () => {
  it('200 OK — marks URL as reachable with status code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://reachable-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(true);
    expect(meta.statusCode).toBe(200);
    expect(meta.errorType).toBeUndefined();

    // Should not contain unreachable findings
    const findings = allFindings(report);
    expect(findings).not.toContain('URL unreachable');
    expect(findings).not.toContain('blocked');
  });

  it('301 redirect — captures final URL and marks reachable', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://final-destination.example/page'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://redirect-me.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(true);
    expect(meta.redirectedTo).toBe('https://final-destination.example/page');
    expect(meta.finalUrl).toBe('https://final-destination.example/page');
    expect(meta.redirectCount).toBe(1);

    const findings = allFindings(report);
    expect(findings).toContain('redirects to a different domain');
  });

  it('403 forbidden — marks reachable but blocked, adds small risk', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const report = await scanUrl('https://blocked-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(true);
    expect(meta.statusCode).toBe(403);
    expect(meta.errorType).toBe('blocked');

    const findings = allFindings(report);
    expect(findings).toContain('URL reachable but blocked access (HTTP 403)');

    // 403 blocked adds +5 (info with scoreOverride)
    expect(report.riskScore).toBeGreaterThanOrEqual(5);
    expect(report.riskScore).toBeLessThanOrEqual(10);

    // Confidence cannot be HIGH when blocked
    expect(report.confidence).not.toBe('HIGH');
  });

  it('429 rate limited — marks reachable but blocked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 }),
    );

    const report = await scanUrl('https://rate-limited.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(true);
    expect(meta.statusCode).toBe(429);
    expect(meta.errorType).toBe('blocked');

    const findings = allFindings(report);
    expect(findings).toContain('URL reachable but blocked access (HTTP 429)');
  });

  it('timeout (AbortError) — marks unreachable with timeout type', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const report = await scanUrl('https://slow-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(false);
    expect(meta.errorType).toBe('timeout');

    const findings = allFindings(report);
    expect(findings).toMatch(/URL unreachable \(timeout after 6s\)/);

    // Timeout adds +15 (medium) risk points minimum
    expect(report.riskScore).toBeGreaterThanOrEqual(15);

    // Confidence cannot be HIGH when unreachable
    expect(report.confidence).not.toBe('HIGH');
  });

  it('DNS failure (TypeError) — marks unreachable with dns type', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new TypeError('fetch failed'),
    );

    const report = await scanUrl('https://nonexistent-domain.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(false);
    expect(meta.errorType).toBe('dns');

    const findings = allFindings(report);
    expect(findings).toContain('URL unreachable (DNS resolution failed)');

    expect(report.riskScore).toBeGreaterThanOrEqual(15);
    expect(report.confidence).not.toBe('HIGH');
  });

  it('generic network error — marks unreachable with unknown type', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );

    const report = await scanUrl('https://down-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.urlReachable).toBe(false);
    expect(meta.errorType).toBe('unknown');

    const findings = allFindings(report);
    expect(findings).toContain('URL unreachable (connection error)');
  });
});

// =========================================================================
// 14) Confidence + Summary consistency with reachability
// =========================================================================
describe('Confidence and summary consistency', () => {
  it('SAFE + unreachable → summary notes reachability issue', async () => {
    // Default mock rejects → unreachable
    const report = await scanUrl('https://safe-looking.example');

    // Only finding is the unreachable one (medium = 15), so SAFE
    expect(report.riskLevel).toBe('SAFE');
    expect(report.summary).toContain('could not be reached for verification');
    expect(report.confidence).not.toBe('HIGH');
  });

  it('SAFE + blocked → summary notes blocked with manual verification', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 })
    );

    const report = await scanUrl('https://blocked-safe.example');

    // blocked finding (info, scoreOverride=5), score = 5 → SAFE
    expect(report.riskLevel).toBe('SAFE');
    expect(report.summary).toContain('blocks automated verification');
    expect(report.summary).toContain('Manual verification recommended');
    expect(report.confidence).not.toBe('HIGH');
  });

  it('SAFE + reachable → summary says no suspicious signals', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean-site.example');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.summary).toContain('No suspicious risk signals detected');
  });

  it('clean reachable HTTPS URL gets HIGH confidence', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean-site.example');

    // Reachable, HTTPS, 0 findings → HIGH confidence
    expect(report.findings.length).toBe(0);
    expect(report.confidence).toBe('HIGH');
    expect(report.confidenceReason).toContain('All');
    expect(report.confidenceReason).toContain('passed');
  });

  it('reachable URL with findings can have HIGH confidence', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    // This URL has multiple keyword signals → 2+ findings
    const report = await scanUrl('https://airdrop-claim-verify.example');

    // findings.length >= 2 + checks >= 5 + reachable → HIGH
    if (report.findings.length >= 2) {
      expect(report.confidence).toBe('HIGH');
    }
  });
});

// =========================================================================
// 15) Browser-like headers are sent
// =========================================================================
describe('Browser-like headers', () => {
  it('sends User-Agent, Accept, and Accept-Language headers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    await scanUrl('https://header-test.example');

    expect(fetch).toHaveBeenCalledWith(
      'https://header-test.example',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Mozilla/5.0'),
          'Accept': expect.stringContaining('text/html'),
          'Accept-Language': expect.stringContaining('en-US'),
        }),
      }),
    );
  });

  it('uses GET method instead of HEAD', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    await scanUrl('https://method-test.example');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});

// =========================================================================
// 16) Minimum score floor
// =========================================================================
describe('Minimum score floor', () => {
  it('trusted HTTPS domain has minimum score of 5', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://www.google.com');

    expect(report.riskScore).toBe(5);
    expect(report.riskLevel).toBe('SAFE');
  });

  it('clean reachable URL has minimum score of 5', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean-domain.example');

    expect(report.riskScore).toBe(5);
    expect(report.riskLevel).toBe('SAFE');
  });

  it('score is never 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://any-site.example');

    expect(report.riskScore).toBeGreaterThanOrEqual(5);
  });
});

// =========================================================================
// 17) checksPerformed array
// =========================================================================
describe('checksPerformed array', () => {
  it('includes all 11 checks for non-trusted URLs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://some-site.example');

    expect(report.checksPerformed).toBeDefined();
    expect(report.checksPerformed!.length).toBe(11);

    const labels = report.checksPerformed!.map((c: CheckItem) => c.label);
    expect(labels).toContain('HTTPS encryption');
    expect(labels).toContain('Unicode/homoglyph characters');
    expect(labels).toContain('Subdomain spoofing');
    expect(labels).toContain('Domain extension (TLD)');
    expect(labels).toContain('Domain length');
    expect(labels).toContain('Hyphen count');
    expect(labels).toContain('Numeric characters');
    expect(labels).toContain('Scam keywords');
    expect(labels).toContain('URL reachability');
    expect(labels).toContain('Domain-based URL');
    expect(labels).toContain('Phishing database (GoPlus)');
  });

  it('all checks pass for a clean reachable URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean-site.example');

    const failedChecks = report.checksPerformed!.filter((c: CheckItem) => !c.passed);
    expect(failedChecks.length).toBe(0);
  });

  it('HTTPS check fails for http URL', async () => {
    const report = await scanUrl('http://some-site.example');

    const httpsCheck = report.checksPerformed!.find((c: CheckItem) => c.label === 'HTTPS encryption');
    expect(httpsCheck).toBeDefined();
    expect(httpsCheck!.passed).toBe(false);
  });

  it('scam keywords check fails when keywords present', async () => {
    const report = await scanUrl('https://airdrop-claim.example');

    const keywordCheck = report.checksPerformed!.find((c: CheckItem) => c.label === 'Scam keywords');
    expect(keywordCheck).toBeDefined();
    expect(keywordCheck!.passed).toBe(false);
    expect(keywordCheck!.detail).toContain('airdrop');
  });

  it('reachability check fails when URL is unreachable', async () => {
    // Default mock rejects
    const report = await scanUrl('https://unreachable.example');

    const reachCheck = report.checksPerformed!.find((c: CheckItem) => c.label === 'URL reachability');
    expect(reachCheck).toBeDefined();
    expect(reachCheck!.passed).toBe(false);
  });

  it('trusted domains have 3 checks (HTTPS + trusted + reachability)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://github.com');

    expect(report.checksPerformed).toBeDefined();
    expect(report.checksPerformed!.length).toBe(3);

    const labels = report.checksPerformed!.map((c: CheckItem) => c.label);
    expect(labels).toContain('HTTPS encryption');
    expect(labels).toContain('Trusted domain');
    expect(labels).toContain('URL reachability');
  });

  it('each check item has label and passed boolean', async () => {
    const report = await scanUrl('https://example.com');

    for (const check of report.checksPerformed!) {
      expect(typeof check.label).toBe('string');
      expect(typeof check.passed).toBe('boolean');
    }
  });
});

// =========================================================================
// 18) Hostname and protocol in metadata
// =========================================================================
describe('Hostname and protocol metadata', () => {
  it('includes hostname and protocol for HTTPS URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://example.com/path?q=1');
    const meta = report.metadata as UrlMetadata;

    expect(meta.hostname).toBe('example.com');
    expect(meta.protocol).toBe('https');
  });

  it('includes hostname and protocol for HTTP URL', async () => {
    const report = await scanUrl('http://insecure-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.hostname).toBe('insecure-site.example');
    expect(meta.protocol).toBe('http');
  });

  it('includes hostname for trusted domains', async () => {
    const report = await scanUrl('https://www.google.com');
    const meta = report.metadata as UrlMetadata;

    expect(meta.hostname).toBe('www.google.com');
    expect(meta.protocol).toBe('https');
  });

  it('includes hostname when URL has subdomain', async () => {
    const report = await scanUrl('https://app.example.com');
    const meta = report.metadata as UrlMetadata;

    expect(meta.hostname).toBe('app.example.com');
  });
});

// =========================================================================
// 19) Redirect classification — detailed scenarios
// =========================================================================
describe('Redirect classification scenarios', () => {
  it('Case A: same-domain redirect (microsoft.com → /en-ca/)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://www.microsoft.com/en-ca/'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://www.microsoft.com');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBe(5);
    expect(report.confidence).toBe('HIGH');

    const redirectFinding = report.findings.find(f => f.message.includes('same domain'));
    expect(redirectFinding).toBeDefined();
    expect(redirectFinding!.severity).toBe('info');

    // Score breakdown should show 0 impact for the redirect
    const redirectBreakdown = report.scoreBreakdown.find(b => b.label.includes('same domain'));
    expect(redirectBreakdown).toBeDefined();
    expect(redirectBreakdown!.scoreImpact).toBe(0);
  });

  it('Case B: multi-hop redirect (3 hops same domain)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://hop.example/a'))
      .mockResolvedValueOnce(make301('https://hop.example/b'))
      .mockResolvedValueOnce(make301('https://hop.example/c'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://hop.example');

    const meta = report.metadata as UrlMetadata;
    expect(meta.redirectCount).toBe(3);

    // Same-domain info + multi-hop medium
    const multihopFinding = report.findings.find(f => f.message.includes('multiple redirects'));
    expect(multihopFinding).toBeDefined();
    expect(multihopFinding!.severity).toBe('medium');

    // Score: info(0) + multi-hop override(10) = 10
    expect(report.riskScore).toBeGreaterThanOrEqual(10);
    expect(report.riskLevel).toBe('SAFE');
  });

  it('Case C: cross-domain redirect (example.com → scam.xyz)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://scam.xyz/phish'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://example.com');

    const dangerFinding = report.findings.find(f => f.severity === 'danger');
    expect(dangerFinding).toBeDefined();
    expect(dangerFinding!.message).toContain('suspicious TLD');

    // scoreOverride 50 → at least SUSPICIOUS, likely DANGEROUS with override
    expect(report.riskScore).toBeGreaterThanOrEqual(50);
    expect(report.riskLevel).not.toBe('SAFE');
  });

  it('same-domain redirect preserves HIGH confidence', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://clean.example/new-path'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean.example');

    // Info finding only → should still be HIGH confidence
    expect(report.confidence).toBe('HIGH');
    expect(report.summary).toContain('No suspicious risk signals detected');
  });

  it('cross-domain redirect without suspicious TLD scores 30', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(make301('https://other-domain.com/page'))
      .mockResolvedValueOnce(make200());

    const report = await scanUrl('https://original.example');

    const redirectFinding = report.findings.find(f => f.message.includes('different domain'));
    expect(redirectFinding).toBeDefined();
    expect(redirectFinding!.severity).toBe('danger');

    // scoreOverride 30 → danger override forces at least SUSPICIOUS
    expect(report.riskLevel).not.toBe('SAFE');
  });
});

// =========================================================================
// 20) Mild keywords in path — legitimate sites should not be flagged
// =========================================================================
describe('Mild keywords in path (dappradar-style URLs)', () => {
  it('dappradar.com/rewards/airdrops with 403 → SAFE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const report = await scanUrl('https://dappradar.com/rewards/airdrops');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(30);
    expect(report.summary).toContain('blocks automated verification');
    expect(report.summary).toContain('Manual verification recommended');
  });

  it('dappradar.com/rewards/airdrops with 200 → SAFE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://dappradar.com/rewards/airdrops');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(10);
  });

  it('mild keywords in path produce info finding with 0 score impact', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://dappradar.com/rewards/airdrops');

    const mildFinding = report.findings.find(f => f.message.includes('crypto-related keywords'));
    expect(mildFinding).toBeDefined();
    expect(mildFinding!.severity).toBe('info');

    // No scam-associated finding
    const scamFinding = report.findings.find(f => f.message.includes('scam-associated'));
    expect(scamFinding).toBeUndefined();
  });

  it('mild keywords in DOMAIN are still flagged', async () => {
    const report = await scanUrl('https://free-giveaway-bonus.example');

    expect(report.riskLevel).not.toBe('SAFE');
    const findings = allFindings(report);
    expect(findings).toContain('scam-associated keywords');
  });

  it('mild keywords + strong keyword in path → still flagged', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://legit-site.com/claim/airdrop');

    // 'claim' is a strong keyword → normal severity
    const findings = allFindings(report);
    expect(findings).toContain('scam-associated keywords');
  });

  it('legit site with /free/bonus path + 403 → SAFE', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const report = await scanUrl('https://example.com/free/bonus');

    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(30);
  });

  it('scam keywords check passes for mild-only-in-path', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://dappradar.com/rewards/airdrops');

    const keywordCheck = report.checksPerformed!.find(c => c.label === 'Scam keywords');
    expect(keywordCheck).toBeDefined();
    expect(keywordCheck!.passed).toBe(true);
    expect(keywordCheck!.detail).toContain('benign');
  });

  it('401 is treated the same as 403 (low impact)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const report = await scanUrl('https://protected-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.errorType).toBe('blocked');
    expect(meta.statusCode).toBe(401);
    expect(report.riskScore).toBeLessThanOrEqual(10);
    expect(report.riskLevel).toBe('SAFE');
  });
});

// =========================================================================
// 21) GoPlus Phishing Database Integration
// =========================================================================
describe('GoPlus phishing database', () => {
  it('flags URL as phishing when GoPlus returns phishing_site=1', async () => {
    vi.mocked(fetchPhishingSite).mockResolvedValueOnce({ phishing: 1, error: null });

    const report = await scanUrl('https://fake-metamask.xyz');
    const meta = report.metadata as UrlMetadata;

    expect(meta.goPlusPhishing).toBe(true);
    expect(meta.goPlusChecked).toBe(true);

    const phishingFinding = report.findings.find(f => f.message.includes('GoPlus'));
    expect(phishingFinding).toBeDefined();
    expect(phishingFinding!.severity).toBe('danger');

    expect(report.riskScore).toBeGreaterThanOrEqual(60);
  });

  it('adds info finding when GoPlus returns phishing_site=0', async () => {
    vi.mocked(fetchPhishingSite).mockResolvedValueOnce({ phishing: 0, error: null });
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://legitimate-site.example');
    const meta = report.metadata as UrlMetadata;

    expect(meta.goPlusPhishing).toBe(false);
    expect(meta.goPlusChecked).toBe(true);

    const infoFinding = report.findings.find(f => f.message.includes('Not found in GoPlus'));
    expect(infoFinding).toBeDefined();
    expect(infoFinding!.severity).toBe('info');
  });

  it('degrades gracefully when GoPlus fails', async () => {
    vi.mocked(fetchPhishingSite).mockResolvedValueOnce({ phishing: null, error: 'timeout' });
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://clean-site.example');

    // No GoPlus findings should be added
    const goPlusFinding = report.findings.find(f => f.message.includes('GoPlus'));
    expect(goPlusFinding).toBeUndefined();

    // Check still appears but shows unavailable
    const goPlusCheck = report.checksPerformed!.find(c => c.label.includes('GoPlus'));
    expect(goPlusCheck).toBeDefined();
    expect(goPlusCheck!.detail).toContain('unavailable');
  });

  it('skips GoPlus check for trusted domains', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(make200());

    const report = await scanUrl('https://www.google.com');

    // Trusted domains skip GoPlus — no GoPlus check in checksPerformed
    const goPlusCheck = report.checksPerformed!.find(c => c.label.includes('GoPlus'));
    expect(goPlusCheck).toBeUndefined();

    // fetchPhishingSite should not have been called with a new value
    // (only the default mock from beforeEach)
    expect(report.riskLevel).toBe('SAFE');
  });

  it('GoPlus phishing + structural flags stack correctly', async () => {
    vi.mocked(fetchPhishingSite).mockResolvedValueOnce({ phishing: 1, error: null });

    // URL also has suspicious TLD and scam keywords
    const report = await scanUrl('https://free-airdrop-claim.xyz');

    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);

    // Should have both GoPlus and structural findings
    const findings = allFindings(report);
    expect(findings).toContain('GoPlus');
    expect(findings).toContain('scam-associated keywords');
  });
});
