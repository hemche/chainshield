export type InputType = 'url' | 'token' | 'txHash' | 'wallet' | 'btcWallet' | 'solanaToken' | 'invalidAddress' | 'unknown';

export type RiskLevel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Finding {
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'danger';
  scoreOverride?: number;
}

export interface ScoreBreakdownItem {
  label: string;
  scoreImpact: number;
}

export interface CheckItem {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  chain?: string;
  chainId?: string;
  dex?: string;
  liquidityUsd?: number;
  fdv?: number;
  volume24h?: number;
  priceUsd?: string;
  priceChange24h?: number;
  pairAge?: string;
  pairAddress?: string;
  dexscreenerUrl?: string;
  pairCreatedAt?: number;
  // GoPlus token security fields
  isHoneypot?: boolean;
  isOpenSource?: boolean;
  isMintable?: boolean;
  buyTax?: number;
  sellTax?: number;
  hasHiddenOwner?: boolean;
  isProxy?: boolean;
  canSelfDestruct?: boolean;
  isBlacklisted?: boolean;
  transferPausable?: boolean;
  slippageModifiable?: boolean;
  ownerAddress?: string;
  holderCount?: number;
  sourcifyVerified?: boolean;
  goPlusChecked?: boolean;
}

export interface UrlMetadata {
  finalUrl?: string;
  redirectCount?: number;
  isHttps?: boolean;
  domainAge?: string;
  urlReachable?: boolean;
  statusCode?: number;
  redirectedTo?: string;
  errorType?: 'timeout' | 'dns' | 'blocked' | 'unknown';
  hostname?: string;
  protocol?: string;
  goPlusPhishing?: boolean;
  goPlusChecked?: boolean;
  govChecked?: boolean;
  govFlaggedAsic?: boolean;
  govFlaggedAmf?: boolean;
  govSource?: string;
}

export interface TxMetadata {
  chain?: string;
  detectedChain?: string;
  explorerUrl?: string;
}

export interface WalletMetadata {
  chain?: string;
  explorerUrls?: { name: string; url: string }[];
  goPlusFlags?: string[];
  goPlusChecked?: boolean;
  isFlagged?: boolean;
}

export interface SolanaMetadata {
  name?: string;
  symbol?: string;
  chain?: string;
  dex?: string;
  liquidityUsd?: number;
  fdv?: number;
  volume24h?: number;
  priceUsd?: string;
  priceChange24h?: number;
  pairAge?: string;
  pairAddress?: string;
  dexscreenerUrl?: string;
  pairCreatedAt?: number;
  mintAddress?: string;
}

export type ReportMetadata = TokenMetadata | UrlMetadata | TxMetadata | WalletMetadata | SolanaMetadata;

export interface SafetyReport {
  inputType: InputType;
  inputValue: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  summary: string;
  findings: Finding[];
  recommendations: string[];
  scoreBreakdown: ScoreBreakdownItem[];
  nextStep?: string;
  checksPerformed?: CheckItem[];
  metadata?: ReportMetadata;
  timestamp: string;
}
