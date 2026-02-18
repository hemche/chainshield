import { ASIC_CONFIG, AMF_CONFIG } from '@/config/rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovListCheckResult {
  found: boolean;
  source: string | null;
  entityName: string | null;
  category: string | null;
  error: string | null;
}

interface CachedDomainSet {
  domains: Set<string>;
  /** Map from domain → entity metadata (name, category) */
  meta: Map<string, { name: string; category: string }>;
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Cache — lazy-loaded, stale-while-revalidate
// ---------------------------------------------------------------------------

let asicCache: CachedDomainSet | null = null;
let amfCache: CachedDomainSet | null = null;

/** Visible for testing — clears both caches */
export function clearGovListCache(): void {
  asicCache = null;
  amfCache = null;
}

// ---------------------------------------------------------------------------
// Domain normalization
// ---------------------------------------------------------------------------

/** Strip protocol, www, trailing paths/slashes, lowercase */
export function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  // Remove protocol
  d = d.replace(/^https?:\/\//, '');
  // Remove www prefix
  d = d.replace(/^www\./, '');
  // Remove path, query, hash, trailing slash
  d = d.split('/')[0].split('?')[0].split('#')[0];
  // Remove trailing dots
  d = d.replace(/\.+$/, '');
  return d;
}

/** Check if a string looks like a domain (has dot, no spaces, no @) */
function isDomainLike(value: string): boolean {
  return value.includes('.') && !value.includes(' ') && !value.includes('@');
}

// ---------------------------------------------------------------------------
// ASIC MoneySmart (Australia) — JSON array
// ---------------------------------------------------------------------------

interface AsicEntry {
  name?: string;
  categories?: string[];
  websites?: (string | null)[];
}

export async function fetchAsicList(): Promise<CachedDomainSet> {
  // Return cached if still valid
  if (asicCache && Date.now() - asicCache.fetchedAt < ASIC_CONFIG.cacheTtlMs) {
    return asicCache;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ASIC_CONFIG.fetchTimeoutMs);

    const response = await fetch(ASIC_CONFIG.baseUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ASIC API returned ${response.status}`);
    }

    const entries: AsicEntry[] = await response.json();
    const domains = new Set<string>();
    const meta = new Map<string, { name: string; category: string }>();

    for (const entry of entries) {
      const entityName = entry.name || 'Unknown entity';
      const category = entry.categories?.join(', ') || 'Scam';

      if (!Array.isArray(entry.websites)) continue;

      for (const website of entry.websites) {
        if (!website) continue;
        const domain = normalizeDomain(website);
        if (domain && isDomainLike(domain)) {
          domains.add(domain);
          if (!meta.has(domain)) {
            meta.set(domain, { name: entityName, category });
          }
        }
      }
    }

    asicCache = { domains, meta, fetchedAt: Date.now() };
    return asicCache;
  } catch {
    // If stale cache exists, use it as fallback
    if (asicCache) return asicCache;
    throw new Error('ASIC API unavailable');
  }
}

// ---------------------------------------------------------------------------
// AMF France — semicolon-delimited CSV with BOM
// ---------------------------------------------------------------------------

/** Parse semicolon-delimited CSV, stripping UTF-8 BOM if present */
export function parseSemicolonCsv(raw: string): string[][] {
  let text = raw;
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(line => line.split(';').map(cell => cell.trim()));
}

export async function fetchAmfList(): Promise<CachedDomainSet> {
  // Return cached if still valid
  if (amfCache && Date.now() - amfCache.fetchedAt < AMF_CONFIG.cacheTtlMs) {
    return amfCache;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AMF_CONFIG.fetchTimeoutMs);

    const response = await fetch(AMF_CONFIG.baseUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`AMF API returned ${response.status}`);
    }

    const raw = await response.text();
    const rows = parseSemicolonCsv(raw);

    // Find header row — look for a column named "nom" or "Nom"
    const headerRow = rows[0] || [];
    const nomIndex = headerRow.findIndex(
      h => h.toLowerCase().replace(/"/g, '') === 'nom'
    );
    const categoryIndex = headerRow.findIndex(
      h => h.toLowerCase().replace(/"/g, '') === 'catégorie' || h.toLowerCase().replace(/"/g, '') === 'categorie'
    );

    const domains = new Set<string>();
    const meta = new Map<string, { name: string; category: string }>();

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nom = (nomIndex >= 0 ? row[nomIndex] : row[0])?.replace(/"/g, '').trim();
      if (!nom) continue;

      // Only keep entries that look like domains
      if (!isDomainLike(nom)) continue;

      const domain = normalizeDomain(nom);
      if (domain) {
        domains.add(domain);
        if (!meta.has(domain)) {
          const category = categoryIndex >= 0
            ? (row[categoryIndex]?.replace(/"/g, '').trim() || 'Financial fraud')
            : 'Financial fraud';
          meta.set(domain, { name: domain, category });
        }
      }
    }

    amfCache = { domains, meta, fetchedAt: Date.now() };
    return amfCache;
  } catch {
    // If stale cache exists, use it as fallback
    if (amfCache) return amfCache;
    throw new Error('AMF API unavailable');
  }
}

// ---------------------------------------------------------------------------
// Public API — check a domain against both lists in parallel
// ---------------------------------------------------------------------------

export async function checkDomainAgainstGovLists(domain: string): Promise<GovListCheckResult> {
  const normalizedDomain = normalizeDomain(domain);

  const [asicResult, amfResult] = await Promise.allSettled([
    fetchAsicList(),
    fetchAmfList(),
  ]);

  // Check ASIC
  if (asicResult.status === 'fulfilled') {
    const { domains, meta } = asicResult.value;
    if (domains.has(normalizedDomain)) {
      const entry = meta.get(normalizedDomain);
      return {
        found: true,
        source: 'ASIC MoneySmart (Australia)',
        entityName: entry?.name || null,
        category: entry?.category || null,
        error: null,
      };
    }
  }

  // Check AMF
  if (amfResult.status === 'fulfilled') {
    const { domains, meta } = amfResult.value;
    if (domains.has(normalizedDomain)) {
      const entry = meta.get(normalizedDomain);
      return {
        found: true,
        source: 'AMF France',
        entityName: entry?.name || null,
        category: entry?.category || null,
        error: null,
      };
    }
  }

  // Both failed
  const asicFailed = asicResult.status === 'rejected';
  const amfFailed = amfResult.status === 'rejected';
  if (asicFailed && amfFailed) {
    return {
      found: false,
      source: null,
      entityName: null,
      category: null,
      error: 'Government databases unavailable',
    };
  }

  // Not found in any available list
  return {
    found: false,
    source: null,
    entityName: null,
    category: null,
    error: null,
  };
}
