// ============================================================================
// ChainShield — Centralized Rules Engine
// All detection thresholds and constants live here for easy tuning.
// ============================================================================

// ---------------------------------------------------------------------------
// URL Scanner Rules
// ---------------------------------------------------------------------------

export const SUSPICIOUS_TLDS = [
  '.xyz', '.top', '.click', '.vip', '.buzz', '.tk', '.ml', '.ga', '.cf',
  '.gq', '.wang', '.club', '.online', '.site', '.icu', '.fun', '.monster',
  '.surf', '.rest', '.hair', '.sbs', '.cfd', '.live',
] as const;

export const SCAM_KEYWORDS = [
  'airdrop', 'claim', 'reward', 'rewards', 'bonus', 'connectwallet',
  'connect-wallet', 'verify', 'free-mint', 'freemint', 'giveaway',
  'claim-reward', 'metamask', 'validate', 'sync-wallet', 'dapp-connect',
  'token-claim', 'nft-drop', 'urgent', 'act-now', 'limited-time',
  'approve-token', 'ledger', 'support', 'free', 'double-your', 'nft-mint',
] as const;

/** Mild crypto keywords — benign when only in URL path of a structurally clean site */
export const MILD_KEYWORDS = [
  'airdrop', 'reward', 'rewards', 'bonus', 'free', 'giveaway', 'nft-drop', 'nft-mint',
] as const;

export const TRUSTED_DOMAINS = [
  'google.com', 'www.google.com',
  'github.com', 'www.github.com',
  'coinbase.com', 'www.coinbase.com',
  'binance.com', 'www.binance.com',
  'ethereum.org', 'www.ethereum.org',
  'etherscan.io', 'www.etherscan.io',
  'coingecko.com', 'www.coingecko.com',
] as const;

export const SPOOFED_BRANDS = [
  'binance', 'coinbase', 'metamask', 'ledger', 'opensea',
  'uniswap', 'ethereum', 'bitcoin', 'kraken', 'crypto.com',
] as const;

export const URL_THRESHOLDS = {
  /** Domain (without TLD) longer than this triggers a finding */
  maxDomainLength: 30,
  /** Hyphens at or above this count trigger a finding */
  maxHyphens: 3,
  /** Numbers above this count in the domain trigger a finding */
  maxNumbers: 4,
  /** Fetch timeout for reachability check (ms) */
  fetchTimeoutMs: 6000,
} as const;

// ---------------------------------------------------------------------------
// Token Scanner Rules
// ---------------------------------------------------------------------------

export const TOKEN_THRESHOLDS = {
  /** Liquidity below this is danger (+50) */
  liquidityDangerous: 5_000,
  /** Liquidity below this is warning (+25) */
  liquiditySuspicious: 50_000,
  /** 24h volume below this is warning (+15) */
  volumeVeryLow: 1_000,
  /** 24h volume below this is warning (+10) */
  volumeLow: 10_000,
  /** 24h price change above this is warning (+10) */
  priceChangeSuspicious: 50,
  /** 24h price change above this is danger (extreme pump) */
  priceChangeDangerous: 200,
  /** 24h price drop below this triggers a warning (+10) */
  priceDropThreshold: -50,
  /** 24h absolute change above this triggers moderate volatility info (+5) */
  volatilityModerate: 20,
  /** 24h absolute change above this triggers high volatility warning (+10) */
  volatilityHigh: 50,
  /** FDV above this with low liquidity triggers a warning (+20) */
  fdvHighThreshold: 10_000_000,
  /** Pair younger than this many days is danger (+25) */
  pairAgeDangerousDays: 1,
  /** Pair younger than this many days is warning (+15) */
  pairAgeSuspiciousDays: 3,
  /** FDV below this is a low finding */
  fdvVeryLow: 10_000,
  /** DexScreener API timeout (ms) */
  fetchTimeoutMs: 10_000,
} as const;

export const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  bsc: 'BNB Smart Chain',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  avalanche: 'Avalanche',
  base: 'Base',
  solana: 'Solana',
};

// ---------------------------------------------------------------------------
// Transaction Hash Scanner Rules
// ---------------------------------------------------------------------------

export const TX_EXPLORERS = [
  { name: 'Ethereum', prefix: 'https://etherscan.io/tx/' },
  { name: 'BSC', prefix: 'https://bscscan.com/tx/' },
  { name: 'Polygon', prefix: 'https://polygonscan.com/tx/' },
  { name: 'Arbitrum', prefix: 'https://arbiscan.io/tx/' },
  { name: 'Base', prefix: 'https://basescan.org/tx/' },
] as const;

// ---------------------------------------------------------------------------
// Wallet Scanner Rules
// ---------------------------------------------------------------------------

export const WALLET_EXPLORERS = [
  { name: 'Etherscan', url: 'https://etherscan.io/address/' },
  { name: 'BscScan', url: 'https://bscscan.com/address/' },
  { name: 'PolygonScan', url: 'https://polygonscan.com/address/' },
  { name: 'Arbiscan', url: 'https://arbiscan.io/address/' },
  { name: 'Optimistic', url: 'https://optimistic.etherscan.io/address/' },
  { name: 'BaseScan', url: 'https://basescan.org/address/' },
] as const;

// ---------------------------------------------------------------------------
// Bitcoin Wallet Scanner Rules
// ---------------------------------------------------------------------------

export const BTC_EXPLORERS = [
  { name: 'Blockstream', url: 'https://blockstream.info/address/' },
  { name: 'Blockchain.com', url: 'https://www.blockchain.com/btc/address/' },
] as const;

// ---------------------------------------------------------------------------
// GoPlus Security API Configuration
// ---------------------------------------------------------------------------

export const GOPLUS_CONFIG = {
  /** Base URL for all GoPlus API endpoints */
  baseUrl: 'https://api.gopluslabs.io/api/v1',
  /** Timeout for GoPlus API calls (ms) */
  fetchTimeoutMs: 8_000,
  /** Buy/sell tax above this percentage is danger */
  taxDangerous: 10,
  /** Buy/sell tax above this percentage is medium warning */
  taxSuspicious: 5,
  /** In-memory cache TTL (ms) — deduplicates repeated scans */
  cacheTtlMs: 5 * 60 * 1000,
} as const;

// ---------------------------------------------------------------------------
// Sourcify Contract Verification API Configuration
// ---------------------------------------------------------------------------

export const SOURCIFY_CONFIG = {
  /** Base URL for Sourcify API */
  baseUrl: 'https://sourcify.dev/server/v2/contract',
  /** Timeout for Sourcify API calls (ms) */
  fetchTimeoutMs: 5_000,
} as const;

// ---------------------------------------------------------------------------
// Chain ID Mapping (DexScreener string → GoPlus/Sourcify numeric)
// ---------------------------------------------------------------------------

export const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  base: 8453,
};

// ---------------------------------------------------------------------------
// Government Regulatory Scam Database Configuration
// ---------------------------------------------------------------------------

export const ASIC_CONFIG = {
  /** ASIC MoneySmart Investor Alert List (Australia) */
  baseUrl: 'https://static.moneysmart.gov.au/_data/investor-alert-list.json',
  /** Fetch timeout (ms) */
  fetchTimeoutMs: 10_000,
  /** Cache TTL (ms) — 24 hours */
  cacheTtlMs: 24 * 60 * 60 * 1000,
} as const;

export const AMF_CONFIG = {
  /** AMF France blacklist CSV (data.gouv.fr) */
  baseUrl: 'https://www.data.gouv.fr/api/1/datasets/r/d2d9df6d-1cd2-41a8-96f5-684cb3057ecb',
  /** Fetch timeout (ms) */
  fetchTimeoutMs: 15_000,
  /** Cache TTL (ms) — 12 hours */
  cacheTtlMs: 12 * 60 * 60 * 1000,
} as const;

/** Government regulatory resource links for manual verification */
export const GOV_RESOURCE_LINKS = [
  { region: 'USA (California)', name: 'DFPI Crypto Scam Tracker', url: 'https://dfpi.ca.gov/consumers/crypto/crypto-scam-tracker/' },
  { region: 'USA', name: 'CFTC RED List', url: 'https://www.cftc.gov/LearnAndProtect/Resources/Check/redlist.htm' },
  { region: 'USA', name: 'SEC Investor Alerts', url: 'https://www.sec.gov/investor/alerts' },
  { region: 'UK', name: 'FCA Warning List', url: 'https://www.fca.org.uk/scamsmart/warning-list' },
  { region: 'Australia', name: 'ASIC MoneySmart', url: 'https://moneysmart.gov.au/check-and-report-scams/investor-alert-list' },
  { region: 'France', name: 'AMF Blacklist', url: 'https://www.amf-france.org/en/listings/black-list' },
  { region: 'Singapore', name: 'MAS Investor Alert', url: 'https://www.mas.gov.sg/investor-alert-list' },
  { region: 'Hong Kong', name: 'SFC Alert List', url: 'https://www.sfc.hk/en/alert-list' },
  { region: 'Germany', name: 'BaFin Unauthorized Companies', url: 'https://www.bafin.de/EN/Verbraucher/Beschwerden/BeschwerdenUnternehmen/beschwerden_unternehmen_node_en.html' },
  { region: 'Canada', name: 'CSA Investor Alerts', url: 'https://www.securities-administrators.ca/investor-tools/investor-warnings/' },
] as const;
