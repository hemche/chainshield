import { SOURCIFY_CONFIG } from '@/config/rules';

/**
 * Check if a contract's source code is verified on Sourcify.
 * Returns isVerified=true/false, or null if the API call fails.
 * A 404 response means the contract is not verified (not an error).
 */
export async function fetchContractVerification(
  address: string,
  chainId: number,
): Promise<{ isVerified: boolean | null; error: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOURCIFY_CONFIG.fetchTimeoutMs);

    const response = await fetch(
      `${SOURCIFY_CONFIG.baseUrl}/${chainId}/${address}?fields=isVerified`,
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    // 404 = contract not found in Sourcify = not verified
    if (response.status === 404) {
      return { isVerified: false, error: null };
    }

    if (!response.ok) {
      return { isVerified: null, error: `Sourcify API returned ${response.status}` };
    }

    const data = await response.json();
    const verified = data?.isVerified === true || data?.isVerified === 'true';

    return { isVerified: verified, error: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      return { isVerified: null, error: 'Sourcify API request timed out' };
    }
    return { isVerified: null, error: `Sourcify API error: ${msg}` };
  }
}
