'use client';

import { useState } from 'react';
import { SafetyReport, TokenMetadata, UrlMetadata, TxMetadata, WalletMetadata, SolanaMetadata, CheckItem } from '@/types';
import RiskScore from './RiskScore';
import RiskBadge from './RiskBadge';

interface ReportCardProps {
  report: SafetyReport;
  onCopyReport: () => void;
  onNewScan: () => void;
}

const inputTypeLabels: Record<string, string> = {
  url: 'Website URL',
  token: 'Token Contract',
  txHash: 'Transaction Hash',
  wallet: 'Wallet Address',
  btcWallet: 'Bitcoin Address',
  solanaToken: 'Solana Token',
  invalidAddress: 'Invalid Address',
  unknown: 'Unknown Input',
};

const severityColors: Record<string, string> = {
  info: 'text-gray-400',
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
  danger: 'text-red-500',
};

const severityBgColors: Record<string, string> = {
  info: 'bg-gray-500/10 border-gray-500/10',
  low: 'bg-blue-500/10 border-blue-500/10',
  medium: 'bg-yellow-500/10 border-yellow-500/10',
  high: 'bg-red-500/10 border-red-500/10',
  danger: 'bg-red-500/15 border-red-500/15',
};

const severityIcons: Record<string, React.ReactNode> = {
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  low: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  medium: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  high: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  danger: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
};

const confidenceColors = {
  LOW: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  HIGH: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function shortenValue(value: string, type: string): string {
  if (type === 'txHash' && value.length > 20) {
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
  }
  if ((type === 'wallet' || type === 'token' || type === 'btcWallet' || type === 'invalidAddress') && value.length > 20) {
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
  }
  return value;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard API unavailable (e.g., insecure context)
      });
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded-md hover:bg-gray-800 transition-colors group"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

/* ── Metadata sub-components ────────────────────────────── */

function MetadataCell({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-800/50 border border-gray-700/50 rounded-xl p-3.5 ${className ?? ''}`}>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="text-sm text-gray-200 font-medium">{value}</div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-xl text-sm text-blue-400 hover:text-blue-300 transition-colors"
    >
      {children}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function TokenMetadataCard({ metadata }: { metadata: TokenMetadata }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {metadata.name && (
          <MetadataCell label="Token" value={`${metadata.name} (${metadata.symbol})`} />
        )}
        {metadata.priceUsd && (
          <MetadataCell label="Price" value={`$${metadata.priceUsd}`} />
        )}
        {metadata.chain && (
          <MetadataCell label="Chain" value={metadata.chain} />
        )}
        {metadata.dex && (
          <MetadataCell label="DEX" value={metadata.dex} />
        )}
        {metadata.liquidityUsd !== undefined && (
          <MetadataCell label="Liquidity" value={`$${metadata.liquidityUsd.toLocaleString()}`} />
        )}
        {metadata.fdv !== undefined && (
          <MetadataCell label="FDV" value={`$${metadata.fdv.toLocaleString()}`} />
        )}
        {metadata.volume24h !== undefined && (
          <MetadataCell label="24h Volume" value={`$${metadata.volume24h.toLocaleString()}`} />
        )}
        {metadata.priceChange24h !== undefined && (
          <MetadataCell
            label="24h Change"
            value={
              <span className={metadata.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {metadata.priceChange24h >= 0 ? '+' : ''}{metadata.priceChange24h.toFixed(2)}%
              </span>
            }
          />
        )}
        {metadata.pairAge && (
          <MetadataCell label="Pair Age" value={metadata.pairAge} />
        )}
      </div>
      {metadata.dexscreenerUrl && (
        <ExternalLink href={metadata.dexscreenerUrl}>View on DexScreener</ExternalLink>
      )}
    </div>
  );
}

function SolanaMetadataCard({ metadata }: { metadata: SolanaMetadata }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {metadata.name && (
          <MetadataCell label="Token" value={`${metadata.name} (${metadata.symbol})`} />
        )}
        {metadata.priceUsd && (
          <MetadataCell label="Price" value={`$${metadata.priceUsd}`} />
        )}
        <MetadataCell label="Chain" value="Solana" />
        {metadata.dex && (
          <MetadataCell label="DEX" value={metadata.dex} />
        )}
        {metadata.liquidityUsd !== undefined && (
          <MetadataCell label="Liquidity" value={`$${metadata.liquidityUsd.toLocaleString()}`} />
        )}
        {metadata.fdv !== undefined && (
          <MetadataCell label="FDV" value={`$${metadata.fdv.toLocaleString()}`} />
        )}
        {metadata.volume24h !== undefined && (
          <MetadataCell label="24h Volume" value={`$${metadata.volume24h.toLocaleString()}`} />
        )}
        {metadata.priceChange24h !== undefined && (
          <MetadataCell
            label="24h Change"
            value={
              <span className={metadata.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {metadata.priceChange24h >= 0 ? '+' : ''}{metadata.priceChange24h.toFixed(2)}%
              </span>
            }
          />
        )}
        {metadata.pairAge && (
          <MetadataCell label="Pair Age" value={metadata.pairAge} />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {metadata.dexscreenerUrl && (
          <ExternalLink href={metadata.dexscreenerUrl}>View on DexScreener</ExternalLink>
        )}
        {metadata.mintAddress && (
          <ExternalLink href={`https://solscan.io/token/${metadata.mintAddress}`}>View on Solscan</ExternalLink>
        )}
      </div>
    </div>
  );
}

function UrlMetadataCard({ metadata }: { metadata: UrlMetadata }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {metadata.hostname && (
        <MetadataCell
          label="Host"
          value={
            <span className="break-all">
              <span className="text-gray-500">{metadata.protocol}://</span>{metadata.hostname}
            </span>
          }
          className="col-span-2"
        />
      )}
      <MetadataCell
        label="HTTPS"
        value={
          <span className={metadata.isHttps ? 'text-emerald-400' : 'text-red-400'}>
            {metadata.isHttps ? 'Yes' : 'No'}
          </span>
        }
      />
      {metadata.urlReachable !== undefined && (
        <MetadataCell
          label="Reachable"
          value={
            <span className={
              metadata.urlReachable
                ? (metadata.errorType === 'blocked' ? 'text-yellow-400' : 'text-emerald-400')
                : 'text-red-400'
            }>
              {metadata.urlReachable
                ? (metadata.statusCode ? `Yes (${metadata.statusCode})` : 'Yes')
                : (metadata.errorType === 'timeout' ? 'No (timeout)'
                  : metadata.errorType === 'dns' ? 'No (DNS failed)'
                  : 'No')}
            </span>
          }
        />
      )}
      {metadata.redirectCount !== undefined && metadata.redirectCount > 0 && (
        <MetadataCell label="Redirects" value={<span className="text-yellow-400">{metadata.redirectCount}</span>} />
      )}
      {metadata.finalUrl && (
        <MetadataCell label="Redirects To" value={<span className="break-all">{metadata.finalUrl}</span>} className="col-span-2" />
      )}
    </div>
  );
}

function WalletMetadataCard({ metadata }: { metadata: WalletMetadata }) {
  if (!metadata.explorerUrls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {metadata.explorerUrls.map((explorer) => (
        <ExternalLink key={explorer.name} href={explorer.url}>{explorer.name}</ExternalLink>
      ))}
    </div>
  );
}

const chainToExplorer: Record<string, string> = {
  Ethereum: 'Etherscan',
  BSC: 'BscScan',
  Polygon: 'PolygonScan',
  Arbitrum: 'Arbiscan',
};

function TxMetadataCard({ metadata, hash }: { metadata: TxMetadata; hash: string }) {
  const explorers = [
    { name: 'Etherscan', url: `https://etherscan.io/tx/${hash}` },
    { name: 'BscScan', url: `https://bscscan.com/tx/${hash}` },
    { name: 'PolygonScan', url: `https://polygonscan.com/tx/${hash}` },
    { name: 'Arbiscan', url: `https://arbiscan.io/tx/${hash}` },
  ];

  const detectedExplorer = metadata.detectedChain ? chainToExplorer[metadata.detectedChain] : null;

  // Put detected chain's explorer first
  const sortedExplorers = detectedExplorer
    ? [...explorers].sort((a, b) => (a.name === detectedExplorer ? -1 : b.name === detectedExplorer ? 1 : 0))
    : explorers;

  return (
    <div className="space-y-3">
      {metadata.chain && (
        <MetadataCell
          label="Chain"
          value={
            <span className="inline-flex items-center gap-1.5">
              {metadata.detectedChain && (
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {metadata.chain}
            </span>
          }
        />
      )}
      <div className="flex flex-wrap gap-2">
        {sortedExplorers.map((explorer) => (
          <a
            key={explorer.name}
            href={explorer.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-sm transition-colors ${
              explorer.name === detectedExplorer
                ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30 text-blue-400 hover:text-blue-300 font-semibold'
                : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700 text-blue-400 hover:text-blue-300'
            }`}
          >
            {explorer.name}
            {explorer.name === detectedExplorer && (
              <span className="text-[10px] text-blue-400/70 font-normal ml-0.5">Detected</span>
            )}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────── */

function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card rounded-2xl p-5 sm:p-6 ${className ?? ''}`}>
      {title && (
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}

/* ── Collapsible ────────────────────────────────────────── */

function Collapsible({ title, children, open, onToggle, id }: { title: string; children: React.ReactNode; open: boolean; onToggle: () => void; id: string }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        className="w-full px-5 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div id={`${id}-content`} role="region" aria-label={title} className="px-5 sm:px-6 pb-5 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Main ReportCard ────────────────────────────────────── */

export default function ReportCard({ report, onCopyReport, onNewScan }: ReportCardProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [showAllBreakdown, setShowAllBreakdown] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/report?input=${encodeURIComponent(report.inputValue)}`
    : '';

  const needsShortening = ['txHash', 'wallet', 'token', 'btcWallet', 'invalidAddress'].includes(report.inputType);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 stagger-children">

      {/* ── Score Header ──────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="relative flex-shrink-0">
            <RiskScore score={report.riskScore} level={report.riskLevel} />
            <button
              onClick={() => setExplainerOpen(!explainerOpen)}
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              title="What does this score mean?"
              aria-label="What does this score mean?"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex items-center gap-2.5 justify-center sm:justify-start mb-3">
              <RiskBadge level={report.riskLevel} size="lg" />
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${confidenceColors[report.confidence]}`}>
                {report.confidence} confidence
              </span>
            </div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1.5">
              {inputTypeLabels[report.inputType]}
            </p>
            <div className="flex items-center justify-center sm:justify-start min-w-0">
              <p className="text-gray-300 text-sm break-all font-mono tracking-tight truncate" title={report.inputValue}>
                {needsShortening ? shortenValue(report.inputValue, report.inputType) : report.inputValue}
              </p>
              {needsShortening && <CopyButton text={report.inputValue} />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Score Explainer ────────────────────────────── */}
      {explainerOpen && (
        <Section title="What does this score mean?">
          <div className="space-y-3">
            {[
              { range: '0-30', level: 'SAFE', color: 'text-emerald-400', desc: 'Low-risk signals. No guarantee of safety.' },
              { range: '31-60', level: 'SUSPICIOUS', color: 'text-yellow-400', desc: 'Potential scam or manipulation signals detected.' },
              { range: '61-100', level: 'DANGEROUS', color: 'text-red-400', desc: 'High-risk signals detected. Avoid interaction.' },
            ].map((item) => (
              <div key={item.level} className="flex items-start gap-3 py-1">
                <span className={`${item.color} font-mono text-sm font-bold whitespace-nowrap w-12`}>{item.range}</span>
                <div>
                  <span className={`${item.color} font-semibold text-sm`}>{item.level}</span>
                  <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-[11px] mt-4 pt-3 border-t border-gray-800">Scores are heuristic-based and not financial advice.</p>
        </Section>
      )}

      {/* ── Invalid Address Warning ────────────────────── */}
      {report.inputType === 'invalidAddress' && (
        <div className="rounded-2xl p-4 border bg-red-950/40 border-red-800/40">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-red-400 text-sm font-semibold">Invalid address — checksum failed</p>
          </div>
        </div>
      )}

      {/* ── Summary Verdict ────────────────────────────── */}
      {report.summary && (
        <div className={`rounded-2xl p-4 sm:p-5 border ${
          report.riskLevel === 'SAFE'
            ? 'bg-emerald-950/25 border-emerald-800/30'
            : report.riskLevel === 'SUSPICIOUS'
            ? 'bg-yellow-950/25 border-yellow-800/30'
            : 'bg-red-950/25 border-red-800/30'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 flex-shrink-0 ${
              report.riskLevel === 'SAFE' ? 'text-emerald-400' : report.riskLevel === 'SUSPICIOUS' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {report.riskLevel === 'SAFE' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-relaxed">{report.summary}</p>
              <p className="text-gray-500 text-xs mt-1.5">{report.confidenceReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommended Next Step ──────────────────────── */}
      {report.nextStep && (
        <Section>
          <div className="flex items-start gap-3.5">
            <svg className="w-5 h-5 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div>
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-widest mb-1.5">Recommended Next Step</p>
              <p className="text-gray-200 text-sm leading-relaxed">{report.nextStep}</p>
            </div>
          </div>
        </Section>
      )}

      {/* ── Metadata Details ───────────────────────────── */}
      {report.metadata && (
        <Section title="Details">
          {report.inputType === 'token' && <TokenMetadataCard metadata={report.metadata as TokenMetadata} />}
          {report.inputType === 'solanaToken' && <SolanaMetadataCard metadata={report.metadata as SolanaMetadata} />}
          {report.inputType === 'url' && <UrlMetadataCard metadata={report.metadata as UrlMetadata} />}
          {(report.inputType === 'wallet' || report.inputType === 'btcWallet') && <WalletMetadataCard metadata={report.metadata as WalletMetadata} />}
          {report.inputType === 'txHash' && <TxMetadataCard metadata={report.metadata as TxMetadata} hash={report.inputValue} />}
        </Section>
      )}

      {/* ── Findings ───────────────────────────────────── */}
      <Section title="Findings">
        {report.findings.length === 0 ? (
          <div className="flex items-center gap-2.5 py-1">
            <span className="flex-shrink-0 text-emerald-400">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <span className="text-emerald-400 text-sm font-medium">All checks passed — no issues detected.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {report.findings.map((finding, index) => (
              <li key={index} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 border ${severityBgColors[finding.severity]}`}>
                <span className={`mt-0.5 flex-shrink-0 ${severityColors[finding.severity]}`}>
                  {severityIcons[finding.severity]}
                </span>
                <span className="text-gray-200 text-sm leading-relaxed">{finding.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Checks Performed ───────────────────────────── */}
      {report.checksPerformed && report.checksPerformed.length > 0 && (
        <Collapsible
          title={`Checks Performed (${report.checksPerformed.filter((c: CheckItem) => c.passed).length}/${report.checksPerformed.length} passed)`}
          open={checksOpen}
          onToggle={() => setChecksOpen(!checksOpen)}
          id="checks-performed"
        >
          {report.checksPerformed.map((check: CheckItem, index: number) => (
            <div key={index} className="flex items-center gap-3 text-sm py-0.5">
              <span className={`flex-shrink-0 ${check.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                {check.passed ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <span className="text-gray-300">{check.label}</span>
              {check.detail && (
                <span className="text-gray-600 text-xs ml-auto font-mono">{check.detail}</span>
              )}
            </div>
          ))}
        </Collapsible>
      )}

      {/* ── Score Breakdown ────────────────────────────── */}
      {report.scoreBreakdown && report.scoreBreakdown.length > 0 && (
        <Collapsible
          title="Why this score?"
          open={breakdownOpen}
          onToggle={() => setBreakdownOpen(!breakdownOpen)}
          id="score-breakdown"
        >
          {(() => {
            const contributing = report.scoreBreakdown.filter(i => i.scoreImpact > 0);
            const passed = report.scoreBreakdown.filter(i => i.scoreImpact === 0);
            const items = showAllBreakdown ? report.scoreBreakdown : contributing.length > 0 ? contributing : report.scoreBreakdown;
            return (
              <>
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-gray-400 truncate mr-4">{item.label}</span>
                    <span className={`font-mono font-semibold flex-shrink-0 ${
                      item.scoreImpact >= 60 ? 'text-red-500' : item.scoreImpact >= 25 ? 'text-red-400' : item.scoreImpact >= 15 ? 'text-yellow-400' : item.scoreImpact > 0 ? 'text-blue-400' : 'text-gray-600'
                    }`}>
                      +{item.scoreImpact}
                    </span>
                  </div>
                ))}
                {!showAllBreakdown && passed.length > 0 && contributing.length > 0 && (
                  <button
                    onClick={() => setShowAllBreakdown(true)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-1"
                  >
                    + {passed.length} passed check{passed.length !== 1 ? 's' : ''} with no score impact
                  </button>
                )}
              </>
            );
          })()}
          <div className="flex items-center justify-between text-sm pt-3 mt-1 border-t border-gray-700">
            <span className="text-white font-medium">Total Risk Score</span>
            <span className="font-mono font-bold text-white">{report.riskScore}/100</span>
          </div>
        </Collapsible>
      )}

      {/* ── Recommendations ────────────────────────────── */}
      <Section title="Recommendations">
        <ul className="space-y-2.5">
          {report.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-2.5">
              <svg className="w-4 h-4 mt-0.5 text-blue-400/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-300 text-sm leading-relaxed">{rec}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Action Buttons ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2.5 justify-center pt-2">
        <button
          onClick={() => {
            onCopyReport();
            setCopiedReport(true);
            setTimeout(() => setCopiedReport(false), 2000);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
        >
          {copiedReport ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
          {copiedReport ? 'Copied!' : 'Copy Report'}
        </button>
        <button
          onClick={async () => {
            if (!shareUrl) return;
            if (navigator.share) {
              try {
                await navigator.share({
                  title: `ChainShield Report — ${report.inputValue}`,
                  text: `Risk Score: ${report.riskScore}/100 (${report.riskLevel})`,
                  url: shareUrl,
                });
              } catch {
                // User cancelled share dialog — ignore
              }
            } else {
              navigator.clipboard.writeText(shareUrl)
                .then(() => {
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                })
                .catch(() => {
                  // Clipboard API unavailable
                });
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
        >
          {copiedShare ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
          {copiedShare ? 'Copied!' : 'Share Link'}
        </button>
        <button
          onClick={onNewScan}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          New Scan
        </button>
      </div>
    </div>
  );
}
