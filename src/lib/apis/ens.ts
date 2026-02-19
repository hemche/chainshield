import { ENS_CONFIG } from '@/config/rules';
import { JsonRpcProvider } from 'ethers';

// In-memory cache: ensName (lowercase) → { address: string | null, ts: number }
const cache = new Map<string, { address: string | null; ts: number }>();

export interface EnsResolutionResult {
  address: string | null;
  error: string | null;
}

function getCached(name: string): string | null | undefined {
  const entry = cache.get(name.toLowerCase());
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ENS_CONFIG.cacheTtlMs) {
    cache.delete(name.toLowerCase());
    return undefined;
  }
  return entry.address;
}

function setCache(name: string, address: string | null): void {
  const key = name.toLowerCase();
  // Evict oldest entry if at capacity
  if (cache.size >= ENS_CONFIG.cacheMaxEntries && !cache.has(key)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { address, ts: Date.now() });
}

export function clearEnsCache(): void {
  cache.clear();
}

export async function resolveEnsName(name: string): Promise<EnsResolutionResult> {
  const normalized = name.toLowerCase();

  // Check cache first (may return null for negative cache)
  const cached = getCached(normalized);
  if (cached !== undefined) {
    return {
      address: cached,
      error: cached ? null : 'ENS name does not resolve to an address',
    };
  }

  const rpcs = [ENS_CONFIG.primaryRpc, ENS_CONFIG.fallbackRpc];

  for (let i = 0; i < rpcs.length; i++) {
    const rpcUrl = rpcs[i];
    const isLast = i === rpcs.length - 1;

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const address = await Promise.race<string | null>([
        provider.resolveName(normalized),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ENS resolution timed out')), ENS_CONFIG.fetchTimeoutMs)
        ),
      ]);

      // Cache result (including null for negative cache)
      setCache(normalized, address);

      if (!address) {
        return { address: null, error: 'ENS name does not resolve to an address' };
      }
      return { address, error: null };
    } catch (err) {
      if (isLast) {
        const msg = err instanceof Error ? err.message : String(err);
        return { address: null, error: `ENS resolution failed: ${msg}` };
      }
      // Primary failed, try fallback
    }
  }

  return { address: null, error: 'ENS resolution failed: all RPC endpoints unreachable' };
}
