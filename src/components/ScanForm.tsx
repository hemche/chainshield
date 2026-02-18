'use client';

import { useState, useMemo } from 'react';
import { SafetyReport } from '@/types';

function detectInputHint(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return 'URL detected';
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(t) && !t.startsWith('0x')) return 'URL detected';
  if (/^0x[a-fA-F0-9]{64}$/.test(t)) return 'Transaction hash detected';
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return 'Token / wallet address detected';
  if (/^0x[a-fA-F0-9]+$/.test(t)) return t.length < 42 ? 'Typing hex address...' : 'Hex address detected';
  if (/^(bc1|[13])[a-zA-Z0-9]{24,}$/.test(t)) return 'Bitcoin address detected';
  if (/^[2-9A-HJ-NP-Za-km-z][1-9A-HJ-NP-Za-km-z]{31,43}$/.test(t)) return 'Solana address detected';
  if (t.length > 5) return 'Unknown format';
  return null;
}

interface ScanFormProps {
  onScanComplete: (report: SafetyReport) => void;
  onScanStart: () => void;
}

export default function ScanForm({ onScanComplete, onScanStart }: ScanFormProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputHint = useMemo(() => detectInputHint(input), [input]);

  const handleScan = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a URL, contract address, transaction hash, or wallet address');
      return;
    }

    setError('');
    setLoading(true);
    onScanStart();

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Scan failed');
      }

      const report: SafetyReport = await response.json();
      onScanComplete(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleScan();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-3">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Paste a URL, contract address, tx hash, or wallet address..."
            className="w-full px-5 py-4.5 bg-gray-900 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 text-base transition-all font-mono tracking-tight"
            disabled={loading}
            autoFocus
          />
          {input && !loading && (
            <button
              onClick={() => { setInput(''); setError(''); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
              aria-label="Clear input"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={loading || !input.trim()}
          className="btn-scan px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:border text-white font-semibold rounded-2xl transition-all text-base flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Now
            </>
          )}
        </button>
      </div>

      {inputHint && !error && !loading && (
        <p className="mt-2 text-xs text-blue-400/70 text-center font-mono">{inputHint}</p>
      )}

      {error && (
        <p className="mt-3 text-red-400 text-sm text-center" role="alert">{error}</p>
      )}

      {/* Supported types hint */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {['URLs', 'Token Contracts', 'Tx Hashes', 'Wallets', 'BTC Addresses', 'Solana Tokens'].map((type) => (
          <span key={type} className="text-[11px] text-gray-500 px-2.5 py-1 rounded-full border border-gray-800 bg-gray-900/50">
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}
