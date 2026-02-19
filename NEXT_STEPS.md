# ChainShield — Next Steps Roadmap

> Last updated: February 2026
> Reference this doc at the start of each session.

---

## Phase 1: Close Critical Safety Gaps ✅ COMPLETE

All Phase 1 items have been implemented.

- **1.1 Honeypot Detection** ✅ — GoPlus Security API integrated (`src/lib/apis/goplus.ts`). Checks honeypot, buy/sell tax, mintable, proxy, selfdestruct, blacklist, ownership. 83 token scanner tests.
- **1.2 Known Scam Blocklist** ✅ — 56 curated addresses in `src/data/blocklist.ts` (sanctioned, exploit, drainer, phishing, rugpull, scam). O(1) Map lookup in `src/lib/scanners/checkBlocklist.ts`. Integrated into wallet, token, and BTC scanners.
- **1.3 Contract Verification** ✅ — Sourcify integration (`src/lib/apis/sourcify.ts`). Checks contract verification status on Ethereum, BSC, Polygon, Arbitrum.

---

## Phase 2: Improve Weak Scanners — MOSTLY COMPLETE

- **2.1 Transaction Approval Education** ✅ — Enhanced tx scanner recommendations with specific guidance on `approve`/`setApprovalForAll`, unlimited approvals, revoke.cash, and spender verification.
- **2.2 Wallet Scanner Enhancement** ✅ — Blocklist check integrated, GoPlus `fetchAddressSecurity()` for malicious activity detection, multi-chain explorer links, token/wallet fallback logic.
- **2.3 Single Explorer Detection** ✅ — Detected chain's explorer highlighted with blue badge + "Detected" label in ReportCard. Detected explorer sorted first.

---

## Phase 3: Expand Chain Coverage ✅ COMPLETE

- **3.1 Solana Token Support** ✅ — Full DexScreener-based scanner (`src/lib/scanners/scanSolanaToken.ts`), `isSolanaAddress()` detection, Solscan links, 23 tests. Prefers Solana pairs, same risk thresholds as EVM.
- **3.2 Base Chain Support** ✅ — BaseScan added to TX_EXPLORERS, CHAIN_DETECT_ENDPOINTS, and WALLET_EXPLORERS. Base chain ID (8453) already in CHAIN_ID_MAP.

---

## Phase 4: UX Improvements ✅ COMPLETE

- **4.1 Explain Baseline Score** ✅ — "Why this score?" always visible with baseline floor entry. Score explainer shows 0-30/31-60/61-100 ranges.
- **4.2 Contextual Verdict Guidance** ✅ — Summary field provides contextual guidance per risk level. Next step recommendations tailored to input type and risk.
- **4.3 Scan History** ✅ — sessionStorage-based recent scans (last 5) shown as clickable chips on homepage.
- **4.4 Mobile-First Polish** ✅ — Responsive grid, native share sheet, overflow-x-hidden on body, min-w-0 on flex containers, break-words on recommendations. Verified at 375px viewport.
- **4.5 Hide +0 Score Items** ✅ — Score breakdown shows only contributing factors by default. "+N passed checks with no score impact" toggle reveals +0 items.

---

## Additional Improvements Completed

- **Government Regulatory Databases** ✅ — ASIC Australia (JSON, 24h cache) + AMF France (CSV, 12h cache) in `src/lib/apis/govlists.ts`. O(1) Set lookup, lazy-loaded, stale-while-revalidate. GOV_RESOURCE_LINKS (10 entries) for recommendations.
- **OG Metadata** ✅ — Open Graph + Twitter Card metadata in layout.tsx, per-page metadata for about/privacy.
- **OG Image Generation** ✅ — `/api/og` route with edge runtime, dynamic 1200x630 PNG.
- **JSON-LD Structured Data** ✅ — WebApplication schema in layout.tsx.
- **Error Boundary** ✅ — React error boundary in `src/components/ErrorBoundary.tsx`, wraps main content.
- **Loading States** ✅ — Loading skeleton on homepage + `report/loading.tsx` for Next.js route transitions.
- **Accessibility** ✅ — `aria-expanded` on collapsibles, `aria-live` for scan results, `aria-hidden` on decorative SVGs, `role="alert"` on errors, `role="img"` on risk score.
- **CSP Hardening** ✅ — `unsafe-eval` removed from production. Connect-src includes all API domains.
- **SSRF Protection** ✅ — Blocks redirects to private/reserved IPs, localhost, metadata endpoints.
- **Security Headers** ✅ — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Rate Limiting** ✅ — In-memory sliding window (30 req/60s per IP) in API route.

---

## Testing Coverage

- **549 tests** across 19 test files
- Scanner tests: URL (99), Token (83), detectInput (65), addressValidation (43), ReportCard (31), BTC (30), Solana (23), NFT (22), scanInput (23), GoPlus (20), govlists (19), ScanForm (18), TxHash (17), Wallet (15), API route (9), ENS (8), Sourcify (7), Blocklist (9)
- Build: clean, all pages generating correctly
- CI/CD: GitHub Actions with lint + test + build

---

## Phase 5: Remaining / Future Work

| Feature | Status | Description |
|---------|--------|-------------|
| ENS / .eth resolution | Complete | Resolve .eth names via public RPC, scan underlying wallet, ENS metadata card |
| Browser extension | Not started | Right-click "Check with ChainShield", intercept wallet prompts |
| Telegram / Discord bot | Not started | Scan links shared in group chats |
| Bulk scan API | Not started | Scan multiple addresses/URLs in single request |
| NFT contract scanner | Complete | GoPlus NFT security API, malicious/selfdestruct/approval/proxy/minting detection, ERC-721/1155, Sourcify, 22 tests |
| Historical risk tracking | Not started | Show risk score changes over time |
| Community threat feed | Not started | Crowdsourced scam reports |
| Multi-language (i18n) | Not started | Spanish + Chinese covers huge victim populations |
| PWA support | Not started | Installable progressive web app |
| ML scoring | Not started | Train on labeled scam/legit data for dynamic weighting |
| Nonce-based CSP | Deferred | Requires middleware.ts, forces all pages to dynamic rendering |
| Mobile visual QA | Complete | Full Playwright screenshot testing at 375px — overflow fixes applied |
