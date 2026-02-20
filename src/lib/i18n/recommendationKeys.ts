/**
 * Maps English recommendation strings → translation keys (under `recommendations.*`).
 * Used by ReportCard to translate recommendation strings from the API response.
 * Falls back to the English string if no key is found.
 */
const recommendationKeyMap: Record<string, string> = {
  // URL scanner
  'Avoid entering any personal information on non-HTTPS sites': 'no_https',
  'Homoglyph attacks use lookalike characters to impersonate legitimate sites': 'homoglyph_explain',
  'Check the actual domain name, not just the subdomain — scammers use subdomains to mimic trusted brands': 'check_domain',
  'Be cautious with uncommon domain extensions often used in scams': 'suspicious_tld',
  'URLs with these keywords are frequently associated with phishing attacks': 'scam_keywords',
  'Be cautious with redirecting URLs — verify the final destination': 'verify_redirect',
  'Could not verify this URL — exercise extra caution': 'exercise_caution',
  'Always verify URLs before connecting your wallet': 'verify_urls',
  'Never enter your seed phrase on any website': 'no_seed_phrase',
  'Bookmark trusted sites to avoid phishing links': 'bookmark_trusted',
  'Cross-check with government scam databases (DFPI, CFTC, SEC, FCA, ASIC, AMF) for additional verification': 'gov_databases',
  'Legitimate sites rarely use raw IP addresses': 'no_raw_ip',

  // Token scanner
  'Do not interact with this token unless verified on a block explorer': 'verify_block_explorer',
  'Verify the contract address on a block explorer': 'verify_contract',
  'Do not send funds to unverified contracts': 'no_unverified_funds',
  'Extremely new tokens are very likely to be scams or rug pulls': 'new_tokens_scam',
  'New tokens are significantly more likely to be scams or rug pulls': 'new_tokens_risk',
  'Tokens with very low liquidity can be easily manipulated or are likely scams': 'low_liquidity_scam',
  'Low liquidity makes it difficult to sell without large price impact': 'low_liquidity_impact',
  'Extreme price pumps are often followed by dumps — be very cautious': 'pump_warning',
  'Large price drops may indicate a rug pull or whale dumping': 'dump_warning',
  'A very high FDV with low liquidity means the token could crash easily': 'high_fdv_warning',
  'HONEYPOT: This token cannot be sold once purchased — do not buy': 'honeypot_warning',
  'Check if the contract is verified on the block explorer': 'check_verified',
  'Look for locked liquidity before investing': 'locked_liquidity',
  'Never invest more than you can afford to lose': 'never_invest_more',
  'Manually verify this token on DexScreener or a block explorer': 'manual_verify',

  // NFT scanner
  'Do NOT interact with this NFT contract — it has been flagged as malicious': 'nft_malicious',
  'This contract can steal your NFTs — do not approve or interact': 'nft_steal',
  'Admin-only minting can dilute the collection value': 'nft_dilute',
  'Verify the contract address matches the official collection — copycats exist': 'nft_copycat',
  'Check the NFT collection on OpenSea or other marketplaces for community verification': 'nft_marketplace',
  'Verify the contract on the block explorer before interacting': 'nft_verify_explorer',
  'Be cautious of free NFT airdrops — they are often scam vectors': 'nft_airdrops',
  'Never approve a contract without understanding what permissions you are granting': 'nft_approve',

  // Wallet scanner
  'Check this address on block explorers to see transaction history': 'wallet_check_explorer',
  'Use revoke.cash to review and revoke any token approvals granted to this address': 'wallet_revoke',
  'Be cautious if this address contacted you claiming to be support or offering free tokens': 'wallet_caution',
  'Never share your private key or seed phrase with anyone': 'no_private_key',
  'If you suspect this address is associated with a scam, report it on the relevant block explorer': 'wallet_report_scam',

  // Tx scanner
  'Verify the transaction on a block explorer to see full details': 'tx_verify',
  'Check if the transaction involves token approvals — revoke unlimited approvals at revoke.cash': 'tx_check_approvals',
  'Look for "approve" or "setApprovalForAll" function calls — these grant spending permission to another address': 'tx_approve_warning',
  'Unlimited approvals (max uint256) are especially risky — prefer setting exact amounts': 'tx_unlimited_warning',
  'Verify the spender address is a known, legitimate contract (check labels on the block explorer)': 'tx_verify_spender',
  'If you see an unfamiliar contract as the spender, do not interact further': 'tx_unfamiliar',
  'Paste any wallet address from this transaction into ChainShield to check it against security databases': 'tx_paste_wallet',

  // BTC scanner
  'Verify this address on a Bitcoin block explorer before sending funds': 'btc_verify',
  'Double-check the full address before every transaction — Bitcoin transactions are irreversible': 'btc_double_check',

  // ENS scanner
  'Double-check the ENS name spelling': 'ens_check_spelling',
  'Verify the name is registered at app.ens.domains': 'ens_verify',
  'If this name was shared with you, be cautious — it may be intentionally misspelled': 'ens_misspelled',

  // Invalid address
  'Double-check the address before sending funds. Funds sent to invalid addresses cannot be recovered.': 'invalid_double_check',
  'Verify the address with the sender or original source': 'invalid_verify_source',
  'Never manually type blockchain addresses — always copy and paste': 'invalid_no_manual',
  'Check that you are using the correct blockchain network': 'invalid_check_network',

  // Unknown input
  'Please provide a URL, contract address, transaction hash, or wallet address': 'unknown_provide_input',
  'Look up this address on a chain-specific block explorer': 'unknown_chain_explorer',
  'ChainShield currently supports EVM (0x...) and Bitcoin addresses': 'unknown_supported',
  'Ensure your input is a valid URL, EVM contract address (0x... 42 chars), transaction hash (0x... 66 chars), or wallet address': 'unknown_check_input',
  'Double-check for typos or extra spaces': 'unknown_typos',

  // Solana scanner
  'Do not interact with this token unless verified on a Solana explorer': 'solana_verify_explorer',
  'Verify the mint address on solscan.io or solana.fm': 'solana_verify_mint',
  'Check if the token has a verified project on DexScreener': 'solana_check_project',
  'Low liquidity tokens have high slippage — use small position sizes': 'solana_slippage',
  'Extreme price pumps often precede dumps — exercise extreme caution': 'solana_pump_warning',
  'Low volume makes it difficult to exit positions at fair price': 'solana_volume_warning',
  'Solana tokens cannot currently be checked for honeypot — verify on rugcheck.xyz': 'solana_rugcheck',
  'Try scanning again — the data source may be temporarily unavailable': 'solana_try_again',
  'Verify the token on solscan.io for detailed contract info': 'solana_verify_solscan',
};

/**
 * Look up the translation key for a recommendation string.
 * Returns the key if found, null otherwise.
 */
export function getRecommendationKey(englishText: string): string | null {
  return recommendationKeyMap[englishText] ?? null;
}

/**
 * Special recommendations that contain dynamic values (e.g., HTTP status codes).
 * These need pattern matching instead of exact lookup.
 */
const dynamicPatterns: Array<{ pattern: RegExp; key: string; extractParams: (match: RegExpMatchArray) => Record<string, string | number> }> = [
  {
    pattern: /^Server returned HTTP (\d+) — likely bot protection\. Try visiting manually in your browser\.$/,
    key: 'bot_protection',
    extractParams: (match) => ({ status: parseInt(match[1]) }),
  },
];

/**
 * Look up translation key for recommendations that may contain dynamic values.
 * Returns { key, params } if found, null otherwise.
 */
export function getRecommendationKeyWithParams(englishText: string): { key: string; params?: Record<string, string | number> } | null {
  // Try exact match first
  const exactKey = recommendationKeyMap[englishText];
  if (exactKey) return { key: exactKey };

  // Try dynamic patterns
  for (const { pattern, key, extractParams } of dynamicPatterns) {
    const match = englishText.match(pattern);
    if (match) return { key, params: extractParams(match) };
  }

  return null;
}
