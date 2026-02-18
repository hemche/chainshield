import { BLOCKED_ADDRESSES, BlocklistEntry } from '@/data/blocklist';

// Build a Set for O(1) lookups (lowercase addresses)
const addressSet = new Map<string, BlocklistEntry>();
for (const entry of BLOCKED_ADDRESSES) {
  const normalized = entry.address.toLowerCase();
  // Keep first entry for duplicates
  if (!addressSet.has(normalized)) {
    addressSet.set(normalized, entry);
  }
}

/**
 * Check if an address is on the known scam/exploit/sanctioned blocklist.
 * Returns the matching entry or null.
 */
export function checkBlocklist(address: string): BlocklistEntry | null {
  return addressSet.get(address.toLowerCase()) ?? null;
}

/**
 * Check if a domain is on the blocked domains list.
 * Currently not populated — placeholder for future use.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function checkDomainBlocklist(_domain: string): BlocklistEntry | null {
  return null;
}
