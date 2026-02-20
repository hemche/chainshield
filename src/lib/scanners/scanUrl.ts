import { SafetyReport, Finding, UrlMetadata, ConfidenceLevel, CheckItem } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import {
  SUSPICIOUS_TLDS,
  SCAM_KEYWORDS,
  MILD_KEYWORDS,
  TRUSTED_DOMAINS,
  SPOOFED_BRANDS,
  URL_THRESHOLDS,
} from '@/config/rules';
import { fetchPhishingSite } from '@/lib/apis/goplus';
import { checkDomainAgainstGovLists } from '@/lib/apis/govlists';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

function isSameDomain(host1: string, host2: string): boolean {
  const strip = (h: string) => h.replace(/^www\./, '');
  const h1 = strip(host1);
  const h2 = strip(host2);
  return h1 === h2 || h1.endsWith('.' + h2) || h2.endsWith('.' + h1);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Parse an IPv4 address from various notations (dotted, decimal, octal, hex)
 * and return a normalized 32-bit integer, or null if not an IP.
 */
function parseIpv4ToInt(host: string): number | null {
  // Standard dotted notation: 127.0.0.1, 0177.0.0.1, 0x7f.0.0.1
  const parts = host.split('.');
  if (parts.length === 4 && parts.every(p => /^(0x[0-9a-fA-F]+|0[0-7]*|[1-9]\d*|0)$/.test(p))) {
    const octets = parts.map(p => {
      if (p.startsWith('0x') || p.startsWith('0X')) return parseInt(p, 16);
      if (p.startsWith('0') && p.length > 1) return parseInt(p, 8);
      return parseInt(p, 10);
    });
    if (octets.some(o => isNaN(o) || o < 0 || o > 255)) return null;
    return (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  }

  // Single decimal notation: 2130706433 = 127.0.0.1
  if (/^\d+$/.test(host)) {
    const n = parseInt(host, 10);
    if (n >= 0 && n <= 0xFFFFFFFF) return n;
  }

  // Single hex notation: 0x7f000001
  if (/^0x[0-9a-fA-F]+$/i.test(host)) {
    const n = parseInt(host, 16);
    if (n >= 0 && n <= 0xFFFFFFFF) return n;
  }

  return null;
}

/**
 * Check if a 32-bit IPv4 integer falls in a private/reserved range.
 */
function isPrivateIpv4(ip: number): boolean {
  const a = (ip >>> 24) & 0xFF;
  const b = (ip >>> 16) & 0xFF;

  if (a === 127) return true;           // 127.0.0.0/8 — loopback
  if (a === 10) return true;            // 10.0.0.0/8 — private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local / metadata
  if (a === 0) return true;             // 0.0.0.0/8 — current network

  return false;
}

/**
 * Returns true if the hostname resolves to a private/reserved IP range.
 * Blocks SSRF attacks including IPv6, decimal/octal/hex IP bypasses.
 */
function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Block reserved hostnames
  const reservedHosts = ['localhost', '0.0.0.0', '[::1]', '[::0]'];
  if (reservedHosts.includes(lower)) return true;

  // Block any IPv6 address — bracket notation [::1], [::ffff:127.0.0.1], etc.
  // We block all IPv6 because there is no legitimate reason for users to scan
  // IPv6 literal URLs, and many IPv6 forms can encode private IPv4 addresses.
  if (lower.startsWith('[') && lower.endsWith(']')) return true;

  // Block cloud metadata endpoint in all forms
  if (lower === '169.254.169.254') return true;

  // Parse IPv4 in all notations (dotted, decimal, octal, hex)
  const ipInt = parseIpv4ToInt(lower);
  if (ipInt !== null) {
    return isPrivateIpv4(ipInt);
  }

  return false;
}

export async function scanUrl(input: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const checks: CheckItem[] = [];
  const normalizedUrl = normalizeUrl(input);
  const domain = extractDomain(normalizedUrl);
  const metadata: UrlMetadata = {};

  // Set hostname and protocol
  try {
    const parsed = new URL(normalizedUrl);
    metadata.hostname = parsed.hostname;
    metadata.protocol = parsed.protocol.replace(':', '');
  } catch {
    // ignore parse error
  }

  // Check HTTPS
  const isHttps = normalizedUrl.startsWith('https://');
  metadata.isHttps = isHttps;
  checks.push({
    label: 'HTTPS encryption',
    passed: isHttps,
    detail: isHttps ? 'Connection is encrypted' : 'Not encrypted',
  });
  if (!isHttps) {
    findings.push({ message: 'Site does not use HTTPS encryption', severity: 'high', messageKey: 'no_https' });
    recommendations.push('Avoid entering any personal information on non-HTTPS sites');
  }

  // Check if domain is trusted (exact match or subdomain of a trusted domain)
  const isTrusted = (TRUSTED_DOMAINS as readonly string[]).some(
    td => domain === td || domain.endsWith('.' + td)
  );
  if (isTrusted) {
    checks.push({ label: 'Trusted domain', passed: true, detail: `${domain} is on the trusted allowlist` });
  }

  // -------------------------------------------------------------------------
  // Structural checks — skipped for trusted domains
  // -------------------------------------------------------------------------
  if (!isTrusted) {
    // Check for unicode / homoglyph characters in domain
    const hasNonAscii = /[^\x00-\x7F]/.test(domain);
    const hasPunycode = /xn--/.test(domain);
    checks.push({
      label: 'Unicode/homoglyph characters',
      passed: !hasNonAscii && !hasPunycode,
      detail: hasNonAscii || hasPunycode ? 'Suspicious characters detected' : 'No suspicious characters',
    });
    if (hasNonAscii) {
      findings.push({
        message: 'Domain contains non-ASCII (unicode) characters — possible homoglyph/punycode attack',
        severity: 'high',
        messageKey: 'unicode_domain',
      });
      recommendations.push('Homoglyph attacks use lookalike characters to impersonate legitimate sites');
    }
    if (hasPunycode) {
      findings.push({
        message: 'Domain uses punycode encoding (xn--) — may be disguising unicode characters',
        severity: 'high',
        messageKey: 'punycode_domain',
      });
    }

    // Check for subdomain spoofing tricks
    const domainParts = domain.split('.');
    let subdomainSpoofed = false;
    if (domainParts.length >= 3) {
      const subdomainPortion = domainParts.slice(0, -2).join('.');
      for (const brand of SPOOFED_BRANDS) {
        if (subdomainPortion.includes(brand)) {
          const registeredDomain = domainParts.slice(-2).join('.');
          const isBrandDomain = (TRUSTED_DOMAINS as readonly string[]).some(
            td => td === domain || td === registeredDomain
          );
          if (!isBrandDomain) {
            subdomainSpoofed = true;
            findings.push({
              message: `Subdomain impersonates "${brand}" — the actual domain is ${registeredDomain}`,
              severity: 'high',
              messageKey: 'subdomain_spoof',
              messageParams: { brand, domain: registeredDomain },
            });
            recommendations.push('Check the actual domain name, not just the subdomain — scammers use subdomains to mimic trusted brands');
            break;
          }
        }
      }
    }
    checks.push({
      label: 'Subdomain spoofing',
      passed: !subdomainSpoofed,
      detail: subdomainSpoofed ? 'Brand impersonation in subdomain' : 'No subdomain tricks',
    });

    // Check suspicious TLDs
    let hasSuspiciousTld = false;
    for (const tld of SUSPICIOUS_TLDS) {
      if (domain.endsWith(tld)) {
        hasSuspiciousTld = true;
        findings.push({ message: `Suspicious domain extension: ${tld}`, severity: 'medium', messageKey: 'suspicious_tld', messageParams: { tld } });
        recommendations.push('Be cautious with uncommon domain extensions often used in scams');
        break;
      }
    }
    checks.push({
      label: 'Domain extension (TLD)',
      passed: !hasSuspiciousTld,
      detail: hasSuspiciousTld ? 'Suspicious TLD detected' : 'Standard domain extension',
    });

    // Check domain length
    const domainWithoutTld = domain.split('.').slice(0, -1).join('.');
    const domainTooLong = domainWithoutTld.length > URL_THRESHOLDS.maxDomainLength;
    checks.push({
      label: 'Domain length',
      passed: !domainTooLong,
      detail: `${domainWithoutTld.length} characters`,
    });
    if (domainTooLong) {
      findings.push({ message: 'Unusually long domain name', severity: 'medium', messageKey: 'long_domain' });
    }

    // Check hyphens
    const hyphenCount = (domain.match(/-/g) || []).length;
    const tooManyHyphens = hyphenCount >= URL_THRESHOLDS.maxHyphens;
    checks.push({
      label: 'Hyphen count',
      passed: !tooManyHyphens,
      detail: `${hyphenCount} hyphen${hyphenCount !== 1 ? 's' : ''}`,
    });
    if (tooManyHyphens) {
      findings.push({ message: `Domain contains ${hyphenCount} hyphens — common in phishing URLs`, severity: 'medium', messageKey: 'many_hyphens', messageParams: { count: hyphenCount } });
    }

    // Check numbers in domain
    const numberCount = (domainWithoutTld.match(/\d/g) || []).length;
    const tooManyNumbers = numberCount > URL_THRESHOLDS.maxNumbers;
    checks.push({
      label: 'Numeric characters',
      passed: !tooManyNumbers,
      detail: `${numberCount} number${numberCount !== 1 ? 's' : ''} in domain`,
    });
    if (tooManyNumbers) {
      findings.push({ message: 'Domain contains many numbers — common in scam URLs', severity: 'low', messageKey: 'many_numbers' });
    }

    // Check for scam keywords
    const urlLower = normalizedUrl.toLowerCase();
    const foundKeywords: string[] = [];
    for (const keyword of SCAM_KEYWORDS) {
      if (urlLower.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    const hasScamKeywords = foundKeywords.length > 0;

    // Categorize: mild keywords only in path (not domain) are benign
    const mildFound = foundKeywords.filter(kw => (MILD_KEYWORDS as readonly string[]).includes(kw));
    const strongFound = foundKeywords.filter(kw => !(MILD_KEYWORDS as readonly string[]).includes(kw));
    const mildOnlyInPath = mildFound.length > 0 && strongFound.length === 0
      && mildFound.every(kw => !domain.includes(kw));

    checks.push({
      label: 'Scam keywords',
      passed: !hasScamKeywords || mildOnlyInPath,
      detail: hasScamKeywords
        ? (mildOnlyInPath
          ? `Found in path (benign): ${foundKeywords.join(', ')}`
          : `Found: ${foundKeywords.join(', ')}`)
        : 'No scam keywords',
    });
    if (hasScamKeywords && !mildOnlyInPath) {
      findings.push({
        message: `URL contains scam-associated keywords: ${foundKeywords.join(', ')}`,
        severity: foundKeywords.length >= 2 ? 'high' : 'medium',
        messageKey: 'scam_keywords',
        messageParams: { keywords: foundKeywords.join(', ') },
      });
      recommendations.push('URLs with these keywords are frequently associated with phishing attacks');
    } else if (hasScamKeywords && mildOnlyInPath) {
      findings.push({
        message: `URL path contains crypto-related keywords: ${foundKeywords.join(', ')}`,
        severity: 'info',
        scoreOverride: 0,
        messageKey: 'path_keywords',
        messageParams: { keywords: foundKeywords.join(', ') },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // GoPlus phishing database check — fire early, await after reachability
  // ---------------------------------------------------------------------------
  const goPlusPromise = isTrusted ? null : fetchPhishingSite(normalizedUrl);

  // ---------------------------------------------------------------------------
  // Government regulatory database check — fire early, await after GoPlus
  // ---------------------------------------------------------------------------
  const govListPromise = isTrusted ? null : checkDomainAgainstGovLists(domain);

  // ---------------------------------------------------------------------------
  // Reachability check — follow redirects manually to track hops and domains
  // ---------------------------------------------------------------------------
  const timeoutSeconds = URL_THRESHOLDS.fetchTimeoutMs / 1000;
  let reachabilityPassed = false;

  // SSRF guard: block initial URL pointing to private/reserved hosts
  const initialHost = metadata.hostname || '';
  if (isPrivateOrReservedHost(initialHost)) {
    findings.push({
      message: 'URL points to a private or reserved IP address — blocked for safety.',
      severity: 'danger',
      scoreOverride: 50,
      messageKey: 'private_ip',
    });
    checks.push({ label: 'URL reachability', passed: false, detail: 'Blocked: private/reserved host' });
  }

  // Only proceed with reachability if not blocked
  if (!isPrivateOrReservedHost(initialHost)) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_THRESHOLDS.fetchTimeoutMs);

    let currentUrl = normalizedUrl;
    let redirectCount = 0;
    const maxRedirects = 10;
    const visitedUrls = new Set<string>([currentUrl]);
    let response!: Response;

    // Follow redirects manually so we can count hops and inspect domains
    while (redirectCount <= maxRedirects) {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: BROWSER_HEADERS,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;

        const resolvedUrl = new URL(location, currentUrl).href;
        const resolvedScheme = new URL(resolvedUrl).protocol;
        const resolvedHost = new URL(resolvedUrl).hostname;

        // Block non-HTTP(S) redirect schemes (file://, javascript:, data:, etc.)
        if (resolvedScheme !== 'https:' && resolvedScheme !== 'http:') {
          findings.push({
            message: `URL redirects to non-HTTP scheme (${resolvedScheme}) — blocked for safety.`,
            severity: 'danger',
            scoreOverride: 50,
            messageKey: 'redirect_non_http',
            messageParams: { scheme: resolvedScheme },
          });
          break;
        }

        // SSRF protection: block redirects to private/reserved IPs
        if (isPrivateOrReservedHost(resolvedHost)) {
          findings.push({
            message: 'URL redirects to a private or reserved IP address — blocked for safety.',
            severity: 'danger',
            scoreOverride: 50,
            messageKey: 'redirect_private_ip',
          });
          break;
        }

        // Redirect loop detection
        if (visitedUrls.has(resolvedUrl)) {
          findings.push({
            message: 'URL redirect loop detected — the URL redirects back to a previously visited address.',
            severity: 'medium',
            scoreOverride: 15,
            messageKey: 'redirect_loop',
          });
          break;
        }

        currentUrl = resolvedUrl;
        visitedUrls.add(currentUrl);
        redirectCount++;
        if (redirectCount >= maxRedirects) break;
      } else {
        break;
      }
    }

    clearTimeout(timeout);

    metadata.urlReachable = true;
    metadata.statusCode = response.status;

    // Classify redirects
    if (redirectCount > 0) {
      metadata.redirectedTo = currentUrl;
      metadata.finalUrl = currentUrl;
      metadata.redirectCount = redirectCount;

      const originalHost = new URL(normalizedUrl).hostname.toLowerCase();
      const finalHost = new URL(currentUrl).hostname.toLowerCase();
      const sameDomain = isSameDomain(originalHost, finalHost);

      if (sameDomain) {
        findings.push({
          message: 'URL redirects to a different path on the same domain (common behavior).',
          severity: 'info',
          scoreOverride: 0,
          messageKey: 'redirect_same_domain',
        });
      } else {
        // Cross-domain redirect — check for suspicious TLD in target
        const finalTld = '.' + finalHost.split('.').pop();
        const hasSuspiciousTldInTarget = (SUSPICIOUS_TLDS as readonly string[]).includes(finalTld);

        if (hasSuspiciousTldInTarget) {
          findings.push({
            message: `URL redirects to a different domain with suspicious TLD (${finalHost}) — high phishing risk.`,
            severity: 'danger',
            scoreOverride: 50,
            messageKey: 'redirect_suspicious_tld',
            messageParams: { host: finalHost },
          });
        } else {
          findings.push({
            message: 'URL redirects to a different domain — phishing risk.',
            severity: 'danger',
            scoreOverride: 30,
            messageKey: 'redirect_different_domain',
          });
        }
        recommendations.push('Be cautious with redirecting URLs — verify the final destination');
      }

      // Multi-hop check (separate from domain check)
      if (redirectCount >= 3) {
        findings.push({
          message: 'URL performs multiple redirects (may indicate tracking or obfuscation).',
          severity: 'medium',
          scoreOverride: 10,
          messageKey: 'multiple_redirects',
        });
      }
    }

    // Status-specific findings
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      metadata.errorType = 'blocked';
      findings.push({
        message: `URL reachable but blocked access (HTTP ${response.status})`,
        severity: 'info',
        scoreOverride: 5,
        messageKey: 'blocked_access',
        messageParams: { status: response.status },
      });
      recommendations.push(`Server returned HTTP ${response.status} — likely bot protection. Try visiting manually in your browser.`);
    } else if (response.status >= 400) {
      findings.push({
        message: `URL returned error status (HTTP ${response.status})`,
        severity: 'medium',
        messageKey: 'error_status',
        messageParams: { status: response.status },
      });
    }

    reachabilityPassed = !metadata.errorType && response.status < 400;
  } catch (error) {
    metadata.urlReachable = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    // Trusted domains: unreachable is just bot protection / network flakiness (info)
    // Untrusted domains: unreachable means we can't verify safety (high, forces SUSPICIOUS)
    const unreachableSeverity = isTrusted ? 'info' as const : 'high' as const;
    const unreachableOverride = isTrusted ? 0 : 31;

    if (errorName === 'AbortError' || errorMessage.includes('abort')) {
      metadata.errorType = 'timeout';
      findings.push({
        message: isTrusted
          ? `URL unreachable (timeout after ${timeoutSeconds}s)`
          : `URL unreachable (timeout after ${timeoutSeconds}s) — cannot verify safety`,
        severity: unreachableSeverity,
        scoreOverride: unreachableOverride,
        messageKey: isTrusted ? 'timeout_trusted' : 'timeout_untrusted',
        messageParams: { seconds: timeoutSeconds },
      });
    } else if (error instanceof TypeError) {
      metadata.errorType = 'dns';
      findings.push({
        message: isTrusted
          ? 'URL unreachable (DNS resolution failed)'
          : 'URL unreachable (DNS resolution failed) — domain may not exist',
        severity: unreachableSeverity,
        scoreOverride: unreachableOverride,
        messageKey: isTrusted ? 'dns_failed_trusted' : 'dns_failed_untrusted',
      });
    } else {
      metadata.errorType = 'unknown';
      findings.push({
        message: isTrusted
          ? 'URL unreachable (connection error)'
          : 'URL unreachable (connection error) — cannot verify safety',
        severity: unreachableSeverity,
        scoreOverride: unreachableOverride,
        messageKey: isTrusted ? 'connection_error_trusted' : 'connection_error_untrusted',
      });
    }
    recommendations.push('Could not verify this URL — exercise extra caution');
  }
  } // end if (!isPrivateOrReservedHost)

  checks.push({
    label: 'URL reachability',
    passed: reachabilityPassed,
    detail: reachabilityPassed
      ? `Responded with HTTP ${metadata.statusCode}`
      : metadata.errorType === 'timeout' ? `Timeout after ${timeoutSeconds}s`
      : metadata.errorType === 'dns' ? 'DNS resolution failed'
      : metadata.errorType === 'blocked' ? `Blocked (HTTP ${metadata.statusCode})`
      : metadata.urlReachable === true ? `HTTP ${metadata.statusCode}`
      : 'Unreachable',
  });

  // ---------------------------------------------------------------------------
  // GoPlus phishing result — await the earlier promise
  // ---------------------------------------------------------------------------
  if (goPlusPromise) {
    const goPlusResult = await goPlusPromise.catch(() => ({ phishing: null, error: 'GoPlus unavailable' }));

    if (goPlusResult.phishing === 1) {
      metadata.goPlusPhishing = true;
      metadata.goPlusChecked = true;
      findings.push({
        message: 'URL flagged as phishing by GoPlus security database',
        severity: 'danger',
        scoreOverride: 60,
        messageKey: 'goplus_phishing',
      });
      checks.push({ label: 'Phishing database (GoPlus)', passed: false, detail: 'Flagged as phishing' });
    } else if (goPlusResult.phishing === 0) {
      metadata.goPlusPhishing = false;
      metadata.goPlusChecked = true;
      findings.push({
        message: 'Not found in GoPlus phishing database',
        severity: 'info',
        scoreOverride: 0,
        messageKey: 'goplus_not_phishing',
      });
      checks.push({ label: 'Phishing database (GoPlus)', passed: true, detail: 'Not in phishing database' });
    } else {
      // API failed — graceful degradation, no finding added
      checks.push({ label: 'Phishing database (GoPlus)', passed: true, detail: 'Database check unavailable' });
    }
  }

  // ---------------------------------------------------------------------------
  // Government regulatory database result — await the earlier promise
  // ---------------------------------------------------------------------------
  if (govListPromise) {
    const govResult = await govListPromise.catch(() => ({
      found: false, source: null, entityName: null, category: null,
      error: 'Government databases unavailable',
    }));

    if (govResult.found) {
      metadata.govChecked = true;
      if (govResult.source?.includes('ASIC')) metadata.govFlaggedAsic = true;
      if (govResult.source?.includes('AMF')) metadata.govFlaggedAmf = true;
      metadata.govSource = govResult.source || undefined;

      const entityInfo = govResult.entityName
        ? ` (entity: ${govResult.entityName})`
        : '';
      const categoryInfo = govResult.category
        ? ` — category: ${govResult.category}`
        : '';

      findings.push({
        message: `Listed in ${govResult.source} government scam database${entityInfo}${categoryInfo}`,
        severity: 'high',
        messageKey: 'gov_flagged',
        messageParams: { source: govResult.source || '', entityInfo, categoryInfo },
      });
      checks.push({
        label: 'Government databases (ASIC/AMF)',
        passed: false,
        detail: `Flagged by ${govResult.source}`,
      });
    } else if (!govResult.error) {
      metadata.govChecked = true;
      findings.push({
        message: 'Not found in ASIC or AMF government scam databases',
        severity: 'info',
        scoreOverride: 0,
        messageKey: 'gov_not_flagged',
      });
      checks.push({
        label: 'Government databases (ASIC/AMF)',
        passed: true,
        detail: 'Not in government scam databases',
      });
    } else {
      // API error — graceful degradation
      checks.push({
        label: 'Government databases (ASIC/AMF)',
        passed: true,
        detail: 'Database check unavailable',
      });
    }
  }

  // Check for IP-based URLs (skip for trusted domains)
  if (!isTrusted) {
    const isIpUrl = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(normalizedUrl);
    checks.push({
      label: 'Domain-based URL',
      passed: !isIpUrl,
      detail: isIpUrl ? 'Uses IP address instead of domain' : 'Uses a proper domain name',
    });
    if (isIpUrl) {
      findings.push({ message: 'URL uses an IP address instead of a domain name', severity: 'high', messageKey: 'ip_address_url' });
      recommendations.push('Legitimate sites rarely use raw IP addresses');
    }
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('Always verify URLs before connecting your wallet');
  }
  recommendations.push('Never enter your seed phrase on any website');
  recommendations.push('Bookmark trusted sites to avoid phishing links');

  const { score: rawScore, level, breakdown } = calculateRisk(findings);
  const score = Math.max(5, rawScore);
  if (score > rawScore) {
    breakdown.push({ label: 'Baseline risk floor (no URL is truly zero-risk)', scoreImpact: score - rawScore });
  }

  // Add government resource links for risky URLs
  if (level !== 'SAFE') {
    recommendations.push('Cross-check with government scam databases (DFPI, CFTC, SEC, FCA, ASIC, AMF) for additional verification');
  }

  // ---------------------------------------------------------------------------
  // Confidence — trusted domains always HIGH; otherwise heuristic-based
  // ---------------------------------------------------------------------------
  let confidence: ConfidenceLevel;
  let confidenceReason: string;

  if (isTrusted) {
    confidence = 'HIGH';
    confidenceReason = `Domain is on the trusted allowlist. ${checks.length} checks performed.`;
  } else {
    const hasWarningOrDanger = findings.some(
      f => f.severity === 'medium' || f.severity === 'high' || f.severity === 'danger'
    );
    if (metadata.urlReachable === false) {
      confidence = checks.length >= 5 && findings.length >= 2 ? 'MEDIUM' : 'LOW';
    } else if (metadata.errorType === 'blocked') {
      confidence = checks.length >= 5 ? 'MEDIUM' : 'LOW';
    } else if (isHttps && !hasWarningOrDanger) {
      confidence = 'HIGH';
    } else {
      confidence = checks.length >= 5 ? (findings.length >= 2 ? 'HIGH' : 'MEDIUM') : 'LOW';
    }

    if (metadata.urlReachable === false) {
      confidenceReason = `${checks.length} structural checks performed, but the URL could not be reached for verification.`;
    } else if (metadata.errorType === 'blocked') {
      confidenceReason = `${checks.length} checks performed. Server blocked direct verification (HTTP ${metadata.statusCode}).`;
    } else if (isHttps && !hasWarningOrDanger) {
      confidenceReason = `All ${checks.length} checks passed. URL is reachable and uses HTTPS.`;
    } else if (confidence === 'HIGH') {
      confidenceReason = `${checks.length} checks performed with ${findings.length} signals detected. URL was reachable.`;
    } else {
      confidenceReason = `${checks.length} checks performed.`;
    }

    if (metadata.govChecked) {
      confidenceReason += ' Government regulatory databases checked.';
    }
  }

  // ---------------------------------------------------------------------------
  // Summary — includes domain name for context
  // ---------------------------------------------------------------------------
  let summary: string;
  if (isTrusted) {
    summary = `This is a known trusted domain (${domain}).`;
  } else if (metadata.urlReachable === false) {
    summary = `${domain} could not be reached — safety cannot be verified. Exercise caution.`;
  } else if (level === 'SAFE' && metadata.errorType === 'blocked') {
    summary = `Site appears structurally safe but blocks automated verification (${metadata.statusCode}). Manual verification recommended.`;
  } else if (level === 'SAFE') {
    summary = 'No suspicious risk signals detected.';
  } else if (level === 'SUSPICIOUS') {
    summary = 'Some suspicious patterns detected — review carefully.';
  } else {
    summary = 'High-risk signals detected — avoid interacting.';
  }

  // Next step
  let nextStep: string;
  if (isTrusted) {
    nextStep = 'No action needed — this is a recognized safe domain.';
  } else if (level === 'DANGEROUS') {
    nextStep = 'Do not visit this URL or connect your wallet to it.';
  } else if (level === 'SUSPICIOUS') {
    nextStep = 'Verify the domain carefully before interacting — check official sources.';
  } else {
    nextStep = 'Always verify URLs before connecting your wallet.';
  }

  return {
    inputType: 'url',
    inputValue: input,
    riskScore: score,
    riskLevel: level,
    confidence,
    confidenceReason,
    summary,
    scoreBreakdown: breakdown,
    nextStep,
    findings,
    recommendations,
    checksPerformed: checks,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
