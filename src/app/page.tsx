'use client';

import { useState, useEffect } from 'react';
import { SafetyReport } from '@/types';
import ScanForm from '@/components/ScanForm';
import ReportCard from '@/components/ReportCard';
import PrivacyBanner from '@/components/PrivacyBanner';

const HISTORY_KEY = 'chainshield_recent_scans';
const MAX_HISTORY = 5;

function getHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(input: string) {
  try {
    const prev = getHistory().filter((h) => h !== input);
    const next = [input, ...prev].slice(0, MAX_HISTORY);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage unavailable
  }
}

function LoadingSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Score ring */}
      <div className="glass-card rounded-2xl p-8 flex items-center gap-8">
        <div className="skeleton w-[140px] h-[140px] rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
      </div>
      {/* Summary */}
      <div className="skeleton h-24 w-full rounded-2xl" />
      {/* Findings */}
      <div className="glass-card rounded-2xl p-6 space-y-3">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-10 w-5/6 rounded-xl" />
      </div>
    </div>
  );
}

export default function Home() {
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleScanComplete = (r: SafetyReport) => {
    setReport(r);
    setLoading(false);
    saveHistory(r.inputValue);
    setHistory(getHistory());
  };

  const handleScanStart = () => {
    setReport(null);
    setLoading(true);
  };

  const handleNewScan = () => {
    setReport(null);
    setLoading(false);
  };

  const handleCopyReport = () => {
    if (!report) return;
    const text = [
      `ChainShield Report`,
      `Input: ${report.inputValue}`,
      `Type: ${report.inputType}`,
      `Risk Score: ${report.riskScore}/100 (${report.riskLevel})`,
      `Confidence: ${report.confidence}`,
      `Summary: ${report.summary}`,
      '',
      'Findings:',
      ...report.findings.map((f) => `  [${f.severity.toUpperCase()}] ${f.message}`),
      '',
      'Recommendations:',
      ...report.recommendations.map((r) => `  - ${r}`),
    ].join('\n');

    navigator.clipboard.writeText(text).catch(() => {
      // Clipboard API unavailable
    });
  };

  return (
    <>
      <PrivacyBanner />
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        {!report && !loading && (
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2.5 mb-5">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                ChainShield
              </h1>
            </div>
            <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
              Paste any crypto URL, contract address, transaction hash, or wallet address to scan for risk signals.
            </p>
          </div>
        )}

        {/* Scan Form */}
        {!report && !loading && (
          <>
            <ScanForm onScanComplete={handleScanComplete} onScanStart={handleScanStart} />

            {/* Recent scans */}
            {history.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-gray-600 mr-1">Recent:</span>
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      const input = document.querySelector<HTMLInputElement>('input[type="text"]');
                      if (input) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                          window.HTMLInputElement.prototype, 'value'
                        )?.set;
                        nativeInputValueSetter?.call(input, h);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2.5 py-1 rounded-full border border-gray-800 hover:border-gray-600 bg-gray-900/50 hover:bg-gray-800/50 transition-colors truncate max-w-[200px] font-mono"
                    title={h}
                  >
                    {h.length > 24 ? `${h.slice(0, 10)}...${h.slice(-8)}` : h}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Loading skeleton */}
        {loading && <LoadingSkeleton />}

        {/* Report */}
        {report && (
          <ReportCard
            report={report}
            onCopyReport={handleCopyReport}
            onNewScan={handleNewScan}
          />
        )}
      </main>
    </>
  );
}
