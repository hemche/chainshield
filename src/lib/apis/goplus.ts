import { GOPLUS_CONFIG } from '@/config/rules';

// ---------------------------------------------------------------------------
// GoPlus response types — values are strings "0"/"1", not booleans
// ---------------------------------------------------------------------------

export interface GoPlusTokenSecurity {
  is_honeypot?: string;
  is_open_source?: string;
  is_mintable?: string;
  buy_tax?: string;
  sell_tax?: string;
  hidden_owner?: string;
  slippage_modifiable?: string;
  transfer_pausable?: string;
  is_proxy?: string;
  selfdestruct?: string;
  is_blacklisted?: string;
  holder_count?: string;
  total_supply?: string;
  owner_address?: string;
  creator_address?: string;
}

export interface GoPlusAddressSecurity {
  phishing_activities?: string;
  honeypot_related_address?: string;
  stealing_attack?: string;
  blacklist_doubt?: string;
  money_laundering?: string;
  sanctioned?: string;
  mixer?: string;
}

// ---------------------------------------------------------------------------
// In-memory cache — deduplicates repeated scans within TTL
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; ts: number }>();
/** Maximum cache entries to prevent unbounded memory growth */
const CACHE_MAX_ENTRIES = 500;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > GOPLUS_CONFIG.cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  // Evict oldest entries when cache is full
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

/** Visible for testing — clears the in-memory cache */
export function clearGoPlusCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Generic GoPlus fetch wrapper
// ---------------------------------------------------------------------------

async function fetchGoPlus<T>(
  endpoint: string,
  timeoutMs: number = GOPLUS_CONFIG.fetchTimeoutMs,
): Promise<{ data: T | null; error: string | null }> {
  const cached = getCached<T>(endpoint);
  if (cached) return { data: cached, error: null };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${GOPLUS_CONFIG.baseUrl}${endpoint}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { data: null, error: `GoPlus API returned ${response.status}` };
    }

    const json = await response.json();

    // GoPlus wraps responses in { code: 1, result: ... }
    if (json?.code !== 1) {
      return { data: null, error: `GoPlus returned code ${json?.code}` };
    }

    setCache(endpoint, json.result);
    return { data: json.result as T, error: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      return { data: null, error: 'GoPlus API request timed out' };
    }
    return { data: null, error: `GoPlus API error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Typed API functions
// ---------------------------------------------------------------------------

/**
 * Fetch token security data from GoPlus.
 * Returns the security result for the given address on the specified chain.
 */
export async function fetchTokenSecurity(
  address: string,
  chainId: number,
): Promise<{ data: GoPlusTokenSecurity | null; error: string | null }> {
  const endpoint = `/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`;
  const result = await fetchGoPlus<Record<string, GoPlusTokenSecurity>>(endpoint);

  if (!result.data) return { data: null, error: result.error };

  // GoPlus nests the result under the lowercased address key
  const tokenData = result.data[address.toLowerCase()];
  if (!tokenData || Object.keys(tokenData).length === 0) {
    return { data: null, error: 'Token not found in GoPlus database' };
  }

  return { data: tokenData, error: null };
}

/**
 * Check if a URL is a known phishing site.
 * Returns 1 if phishing, 0 if not, null if API failed.
 */
export async function fetchPhishingSite(
  url: string,
): Promise<{ phishing: number | null; error: string | null }> {
  const endpoint = `/phishing_site?url=${encodeURIComponent(url)}`;
  const result = await fetchGoPlus<{ phishing_site: number }>(endpoint);

  if (!result.data) return { phishing: null, error: result.error };

  return { phishing: result.data.phishing_site ?? null, error: null };
}

/**
 * Check if a wallet address is flagged for malicious activity.
 */
export async function fetchAddressSecurity(
  address: string,
  chainId: number,
): Promise<{ data: GoPlusAddressSecurity | null; error: string | null }> {
  const endpoint = `/address_security/${address}?chain_id=${chainId}`;
  return fetchGoPlus<GoPlusAddressSecurity>(endpoint);
}
