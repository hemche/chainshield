import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — ChainShield',
  description: 'ChainShield privacy policy. Zero tracking, zero cookies, zero data stored. Your scans are processed and immediately discarded.',
  openGraph: {
    title: 'Privacy Policy — ChainShield',
    description: 'Zero tracking, zero cookies, zero data stored. Your scans are processed and immediately discarded.',
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-10 inline-flex items-center gap-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Scanner
      </Link>

      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: February 2026</p>
      </div>

      <div className="space-y-10 text-gray-300 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Our Privacy Commitment</h2>
          <p className="text-gray-400">
            ChainShield is built with privacy as a core principle, not an afterthought.
            We believe you should be able to check if something is a scam without becoming a target yourself.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">What We Do NOT Collect</h2>
          <ul className="space-y-2.5 text-gray-400">
            {[
              ['store your scan inputs', '(URLs, addresses, hashes)'],
              ['log your IP address', ''],
              ['use cookies', 'for tracking'],
              ['use Google Analytics', 'or any third-party trackers'],
              ['store scan results', 'in any database'],
              ['require wallet connection', ''],
              ['require login', 'or account creation'],
              ['build user profiles', ''],
              ['sell or share any data', 'with third parties'],
            ].map(([main, detail]) => (
              <li key={main} className="flex items-start gap-2.5">
                <svg className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>We do <strong className="text-white">not</strong> {main}{detail ? ` ${detail}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">How Scans Work</h2>
          <p className="text-gray-400 mb-4">
            When you submit a scan, here is exactly what happens:
          </p>
          <ol className="space-y-2.5 text-gray-400">
            {[
              'Your input is sent to our server for processing',
              'We analyze the input using public, free APIs (DexScreener, GoPlus Security, Sourcify)',
              'We generate a safety report based on the analysis',
              'The report is sent back to your browser',
              ['Your input and the report are ', <strong key="b" className="text-white">immediately discarded</strong>, ' — nothing is saved'],
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-blue-400/60 font-mono text-sm font-bold mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Third-Party Services</h2>
          <p className="text-gray-400 mb-4">
            To generate scan reports, we may query the following public APIs:
          </p>
          <ul className="space-y-2.5 text-gray-400">
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">DexScreener API</strong> — for token trading pair data (public, no authentication required)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">GoPlus Security API</strong> — for phishing URL detection, token security audits, and malicious wallet checks (public, no authentication required)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">Sourcify</strong> — for smart contract source code verification (public, no authentication required)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">Public block explorers</strong> — we provide links but do not make API calls on your behalf</span>
            </li>
          </ul>
          <p className="mt-4 text-gray-500 text-sm">
            These services have their own privacy policies. We do not send any identifying information about you to these services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Shareable Reports</h2>
          <p className="text-gray-400">
            When you use the &quot;Share Link&quot; feature, the report data is encoded in the URL itself using query parameters.
            No data is stored on our servers. Anyone with the link can see the report, but we have no record of it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Session Storage</h2>
          <p className="text-gray-400">
            This application uses browser session storage for two purposes only:
          </p>
          <ul className="mt-3 space-y-2 text-gray-400">
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">Recent scans</strong> — your last 5 scan inputs are stored so you can quickly re-scan them during the same session</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">Banner dismissal</strong> — remembers if you dismissed the privacy banner so it stays hidden during navigation</span>
            </li>
          </ul>
          <p className="mt-3 text-gray-400">
            Session storage is automatically cleared when you close your browser tab. No data is stored in local storage, IndexedDB, or any persistent storage.
            No scan results or report data are ever saved.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Open Source</h2>
          <p className="text-gray-400">
            This tool is designed to be transparent. You can inspect the source code to verify
            that we do exactly what we claim — no hidden tracking, no secret data collection.
          </p>
        </section>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs">
            If you have questions about this privacy policy, you can review the source code directly.
            We believe in transparency through code, not just words.
          </p>
        </div>
      </div>
    </div>
  );
}
