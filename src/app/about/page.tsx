import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-10 inline-flex items-center gap-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Scanner
      </Link>

      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-3">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h1 className="text-2xl font-bold text-white tracking-tight">About ChainShield</h1>
        </div>
        <p className="text-gray-500 text-sm">Crypto safety checks without tracking.</p>
      </div>

      <div className="space-y-10 text-gray-300 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">What Is This?</h2>
          <p className="text-gray-400">
            A free, privacy-first tool that helps you check whether a crypto link, token contract,
            transaction, or wallet address looks safe&mdash;before you connect your wallet or send funds.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">How It Works</h2>
          <ol className="space-y-3 text-gray-400">
            {[
              'Paste any URL, contract address (ETH/BSC/Polygon/Arbitrum), transaction hash, or wallet address into the input box.',
              'The app auto-detects what you pasted and runs the appropriate scanner.',
              'You get an instant Safety Report with a risk score, findings, and clear recommendations.',
              'Nothing is stored. Your scan is processed and immediately discarded.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-blue-400/60 font-mono text-sm font-bold mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">What We Scan For</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: 'URL Scanner',
                items: ['Suspicious TLDs (.xyz, .top, .click)', 'Scam keywords', 'Unicode/homoglyph attacks', 'Subdomain spoofing', 'IP-based URLs', 'HTTPS verification', 'Redirect chains', 'Phishing database check (GoPlus)'],
              },
              {
                title: 'Token Scanner',
                items: ['Liquidity analysis (DexScreener)', '24h volume checks', 'Price pump/dump detection', 'Pair age analysis', 'FDV-to-liquidity ratio', 'Honeypot detection (GoPlus)', 'Buy/sell tax analysis', 'Contract verification (Sourcify)', 'Multi-chain support'],
              },
              {
                title: 'Transaction Scanner',
                items: ['Hash format validation', 'Auto chain detection', 'Multi-chain explorer links', 'Approval safety guidance'],
              },
              {
                title: 'Wallet Scanner',
                items: ['Address checksum validation', 'EVM + BTC support', 'Malicious activity detection (GoPlus)', 'Multi-chain explorer links (6 chains)'],
              },
            ].map((scanner) => (
              <div key={scanner.title} className="glass-card rounded-xl p-4">
                <h3 className="text-white font-medium text-sm mb-2.5">{scanner.title}</h3>
                <ul className="text-xs text-gray-500 space-y-1.5">
                  {scanner.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Privacy Principles</h2>
          <ul className="space-y-2 text-gray-400">
            {['No wallet connect required', 'No scan data stored', 'No analytics or tracking', 'No cookies', 'No login or account needed'].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <svg className="w-3.5 h-3.5 text-emerald-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-gray-500 text-sm">
            Read our full <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link> for details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Limitations</h2>
          <p className="text-gray-400">
            This tool provides <strong className="text-white">risk signals</strong>, not guarantees.
            A &ldquo;SAFE&rdquo; rating does not mean a project is legitimate&mdash;it means we did not detect known scam patterns.
            Always do your own research (DYOR) before interacting with any smart contract or sending funds.
          </p>
        </section>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs">
            This tool provides risk signals, not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
