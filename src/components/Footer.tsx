import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 mt-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand + Disclaimer */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-semibold text-gray-300">ChainShield</span>
              <span className="text-[10px] text-gray-600 font-mono">v1.2.0</span>
            </div>
            <p className="text-xs text-gray-500">
              Risk signals only — not financial advice.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-xs">
            <Link href="/about" className="text-gray-500 hover:text-gray-300 transition-colors">
              About
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors">
              Privacy
            </Link>
            <span className="text-gray-600 hidden sm:inline">
              No tracking. No cookies. No data stored.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
