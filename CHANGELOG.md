# Changelog

All notable changes to ChainShield will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-19

### Added

- **ENS (.eth) name resolution** — Paste any ENS name (e.g., `vitalik.eth`) and get a wallet risk assessment. Resolves via public Ethereum RPC (Cloudflare + LlamaRPC fallback), 1h in-memory cache, negative caching for unresolvable names. ENS metadata card shows resolved address, resolution status, and explorer links.
- **Mobile layout fixes** — Fixed content overflow on 375px viewports: `overflow-x-hidden` on body, `min-w-0` on flex containers, `break-words` on recommendations.
- **Shorter gov resource recommendations** — Replaced long inline URLs with concise "Cross-check with government scam databases (DFPI, CFTC, SEC, FCA, ASIC, AMF)" text.
- **516 total tests** across 18 test files.

## [1.0.0] - 2026-02-18

### Added

- **Solana token scanner** — DexScreener-based analysis with liquidity, volume, pair age, and price checks. Solscan + DexScreener links.
- **Static scam blocklist** — 56 curated addresses across sanctioned (OFAC), exploits, drainers, phishing, rugpulls, and BTC scams. O(1) Map lookup integrated into wallet, token, and BTC scanners.
- **GoPlus Security API** — Honeypot detection, buy/sell tax analysis, proxy/selfdestruct detection, ownership checks for tokens. Phishing URL database. Wallet malicious activity flags.
- **Sourcify integration** — Smart contract source code verification across Ethereum, BSC, Polygon, Arbitrum.
- **Government regulatory databases** — ASIC Australia (JSON, 24h cache) and AMF France (CSV, 12h cache) scam lists with O(1) Set lookup, lazy loading, and stale-while-revalidate fallback.
- **OG image generation** — Dynamic 1200x630 PNG at `/api/og` with score ring, risk level badge, and input preview (edge runtime).
- **Open Graph + Twitter Card metadata** — Per-page metadata for homepage, about, and privacy pages.
- **JSON-LD structured data** — WebApplication schema for search engine understanding.
- **Error boundary** — React error boundary wrapping main content with friendly error UI and retry button.
- **Loading states** — Pulse-animated skeleton UI during scans and `report/loading.tsx` for route transitions.
- **Accessibility improvements** — `aria-expanded` on collapsibles, `aria-live` for scan results, `aria-hidden` on decorative SVGs, `role="alert"` on errors, `role="img"` on risk score.
- **Score breakdown UX** — Contributing factors shown by default, +0 passed checks hidden behind a toggle.
- **Scan history** — SessionStorage-based recent scans (last 5) shown as clickable chips on homepage.
- **Base chain support** — BaseScan added to tx/wallet explorers and chain detection endpoints.
- **Tx approval education** — Enhanced recommendations covering approve/setApprovalForAll, unlimited approvals, revoke.cash, and spender verification.
- **Component tests** — ScanForm (17 tests) and ReportCard (25 tests) using `@testing-library/react` + `happy-dom`.
- **API route tests** — 9 tests covering validation, error handling, and IP extraction.
- **Scanner tests** — detectInput (50), scanInput (19), Solana (23), blocklist (9) tests.
- **479 total tests** across 16 test files.

### Security

- CSP hardened: `unsafe-eval` removed from production, kept only for dev.
- SSRF protection: blocks redirects to private/reserved IPs, localhost, and cloud metadata endpoints.
- Rate limiting: in-memory sliding window (30 req/60s per IP).
- Input length capped at 2000 characters.
- All clipboard operations have error handlers.

## [0.1.0] - 2026-02-01

### Added

- Initial release with URL, token, transaction hash, wallet, and BTC address scanning.
- Risk scoring system (0-100) with SAFE/SUSPICIOUS/DANGEROUS levels.
- DexScreener integration for token analysis.
- EVM + BTC address checksum validation.
- Privacy-first design: no tracking, no cookies, no data stored.
- Responsive dark-mode UI with Tailwind CSS v4.
- Shareable report page.
