# AGENTS.md — ChainShield

> Instructions for AI agents working on this codebase.

## Project Overview

ChainShield is a **privacy-first crypto safety scanner**. Users paste a URL, token contract address, transaction hash, or wallet address and get an instant risk assessment. No data is stored, logged, or tracked.

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Runtime:** Node.js 20
- **Testing:** Vitest 2.x (do NOT upgrade to Vitest 4.x — incompatible with Node 20.11)
- **Deployment:** Vercel
- **Analytics:** `@vercel/analytics` (page views only, no custom events)

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint (must pass with zero warnings)
npm test           # Vitest — run all tests once
npm run test:watch # Vitest — watch mode
```

**All three gates must pass before any PR:** `npm run lint`, `npm test`, `npm run build`.

## Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── api/scan/route.ts         # POST /api/scan — single API endpoint
│   ├── page.tsx                  # Homepage (scan form + report)
│   ├── about/page.tsx            # About page
│   ├── privacy/page.tsx          # Privacy policy page
│   ├── report/page.tsx           # Shareable report page
│   ├── layout.tsx                # Root layout (fonts, footer, analytics)
│   ├── not-found.tsx             # 404 page
│   ├── sitemap.ts                # Dynamic sitemap
│   └── globals.css               # Global styles + Tailwind v4
│
├── components/                   # React components (all client-side)
│   ├── ScanForm.tsx              # Input form with validation
│   ├── ReportCard.tsx            # Full risk report display
│   ├── RiskScore.tsx             # Animated circular score ring
│   ├── RiskBadge.tsx             # SAFE / SUSPICIOUS / DANGEROUS badge
│   ├── PrivacyBanner.tsx         # Dismissable privacy banner
│   └── Footer.tsx                # Site footer with nav links
│
├── config/
│   └── rules.ts                  # ALL thresholds, constants, and config
│
├── lib/
│   ├── apis/                     # External API clients
│   │   ├── goplus.ts             # GoPlus Security API (phishing, token, wallet)
│   │   ├── govlists.ts           # ASIC (Australia) + AMF (France) scam databases
│   │   └── sourcify.ts           # Sourcify contract verification
│   │
│   ├── riskScoring/
│   │   └── index.ts              # calculateRisk() — score + level + breakdown
│   │
│   ├── scanners/                 # Core scanning logic
│   │   ├── index.ts              # scanInput() — routes input to correct scanner
│   │   ├── detectInput.ts        # detectInputType() — URL/token/txHash/wallet/btcWallet
│   │   ├── scanUrl.ts            # URL scanner (structural + reachability + GoPlus + gov DBs)
│   │   ├── scanToken.ts          # Token scanner (DexScreener + GoPlus + Sourcify)
│   │   ├── scanTxHash.ts         # Transaction hash scanner (format + chain detection)
│   │   ├── scanWallet.ts         # EVM wallet scanner (format + GoPlus address security)
│   │   ├── scanBtcWallet.ts      # Bitcoin wallet scanner (format + explorer links)
│   │   └── scanInvalidAddress.ts # Invalid address handler (checksum failures)
│   │
│   └── validation/
│       └── addressValidation.ts  # EVM (EIP-55) + BTC (Base58Check/Bech32) validation
│
└── types/
    └── index.ts                  # All TypeScript types (SafetyReport, Finding, etc.)
```

## Architecture

### Data Flow

```
User Input → ScanForm → POST /api/scan → scanInput()
                                            ├── detectInputType()
                                            └── scanUrl() / scanToken() / scanTxHash() / scanWallet() / scanBtcWallet()
                                                  ├── Structural checks
                                                  ├── External API calls (parallel, non-blocking)
                                                  ├── calculateRisk(findings) → { score, level, breakdown }
                                                  └── SafetyReport
```

### Risk Scoring System

Severity scores (in `src/lib/riskScoring/index.ts`):

| Severity | Default Score | Notes |
|----------|--------------|-------|
| `info`   | 0            | Informational, no risk impact |
| `low`    | 8            | Minor concern |
| `medium` | 15           | Moderate concern |
| `high`   | 25           | Significant concern |
| `danger` | 60           | Critical — forces at least SUSPICIOUS |

Any finding can override its default score via `scoreOverride`.

Risk levels (score clamped 0-100):

| Range  | Level        |
|--------|-------------|
| 0-30   | `SAFE`       |
| 31-60  | `SUSPICIOUS` |
| 61-100 | `DANGEROUS`  |

**Severity override rule:** If any finding has `severity: 'danger'`, the risk level cannot be `SAFE`. If danger + score >= 60, it's `DANGEROUS`; otherwise `SUSPICIOUS`.

**Baseline floor:** URL and token scans enforce a minimum score of 5 (no scan returns 0).

### SafetyReport Type

Every scanner returns a `SafetyReport` (defined in `src/types/index.ts`):

```typescript
interface SafetyReport {
  inputType: InputType;         // 'url' | 'token' | 'txHash' | 'wallet' | 'btcWallet' | ...
  inputValue: string;
  riskScore: number;            // 0-100
  riskLevel: RiskLevel;         // 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'
  confidence: ConfidenceLevel;  // 'LOW' | 'MEDIUM' | 'HIGH'
  confidenceReason: string;
  summary: string;
  findings: Finding[];
  recommendations: string[];
  scoreBreakdown: ScoreBreakdownItem[];
  nextStep?: string;
  checksPerformed?: CheckItem[];
  metadata?: ReportMetadata;
  timestamp: string;            // ISO 8601
}
```

## Config & Constants

**All thresholds and constants live in `src/config/rules.ts`.** Never hardcode thresholds in scanner files. If you need a new constant, add it to rules.ts.

Key configs:
- `SUSPICIOUS_TLDS` — domain extensions commonly used in scams
- `SCAM_KEYWORDS` / `MILD_KEYWORDS` — URL keyword detection
- `TRUSTED_DOMAINS` — allowlisted domains (skip structural checks)
- `SPOOFED_BRANDS` — brand names to check for subdomain spoofing
- `URL_THRESHOLDS` — domain length, hyphen count, fetch timeout
- `TOKEN_THRESHOLDS` — liquidity, volume, price change, pair age limits
- `GOPLUS_CONFIG` — API base URL, timeout, tax thresholds, cache TTL
- `SOURCIFY_CONFIG` — API base URL, timeout
- `ASIC_CONFIG` / `AMF_CONFIG` — government database URLs, timeouts, cache TTLs
- `GOV_RESOURCE_LINKS` — 10 government regulatory resource links (static)
- `CHAIN_ID_MAP` — DexScreener chain string → GoPlus/Sourcify numeric chain ID
- `TX_EXPLORERS`, `WALLET_EXPLORERS`, `BTC_EXPLORERS` — block explorer links

## External APIs

All external API calls are **non-blocking** and **gracefully degrade** — if an API fails, no finding is added and the scan continues without it.

| API | File | Auth | Cache | Used By |
|-----|------|------|-------|---------|
| GoPlus Security | `goplus.ts` | None | 5 min in-memory | scanUrl, scanToken, scanWallet |
| Sourcify | `sourcify.ts` | None | None | scanToken |
| ASIC MoneySmart | `govlists.ts` | None | 24h in-memory | scanUrl |
| AMF France | `govlists.ts` | None | 12h in-memory | scanUrl |
| DexScreener | inline in scanToken | None | None | scanToken, scanWallet |

**GoPlus values are strings `"0"`/`"1"`, not booleans.** Always compare with `=== '1'`.

## Testing Conventions

- **Test files live next to source:** `scanUrl.ts` → `scanUrl.test.ts`
- **Mock fetch globally:** Use `vi.stubGlobal('fetch', vi.fn().mockRejectedValue(...))` in `beforeEach`
- **Mock API modules:** Use `vi.mock('@/lib/apis/goplus')` and `vi.mock('@/lib/apis/govlists')` to prevent API clients from consuming the global fetch mock
- **Reset mocks in beforeEach:** Always reset mock return values to prevent test bleed
- **327 tests currently pass** — never submit code that reduces this count

When modifying a finding's severity or adding/removing findings:
1. Recalculate all affected test score assertions
2. Check if risk level expectations change (SAFE/SUSPICIOUS/DANGEROUS)
3. Update check count assertions if adding new check items

### Test Patterns

```typescript
// Mock fetch for reachability
vi.mocked(fetch).mockResolvedValueOnce(make200());

// Mock GoPlus for phishing check
vi.mocked(fetchPhishingSite).mockResolvedValueOnce({ phishing: 1, error: null });

// Mock govlists for government database check
vi.mocked(checkDomainAgainstGovLists).mockResolvedValueOnce({
  found: true, source: 'ASIC MoneySmart (Australia)',
  entityName: 'Scam Corp', category: 'Crypto', error: null,
});
```

## Security

- **SSRF protection:** `isPrivateOrReservedHost()` blocks redirects to private IPs, localhost, metadata endpoints, and all IPv6 literals
- **Redirect loop detection:** `visitedUrls` Set tracks visited URLs during redirect following
- **Rate limiting:** In-memory sliding window (30 requests/60s per IP) in the API route
- **Input validation:** Max 2000 characters, type checking on API input
- **No logging of user input:** Privacy-first — the API route does not log scan input or results
- **Clipboard API:** All `.writeText()` calls have `.catch()` handlers

## Styling

- Tailwind CSS v4 — **not v3**
- **Gotcha:** `bg-[var(--css-prop)]` does not work in Tailwind v4. Use standard utility classes.
- Dark theme (gray-950 background) — no light mode
- Glass-card effect via `glass-card` class in globals.css
- Components are all `'use client'` since they use React hooks

## Common Pitfalls

1. **Vitest version:** Stay on Vitest 2.x. Version 4.x requires Node 20.19+ and the project uses 20.11.
2. **Score assertions:** When changing a finding's severity, you must update every test that asserts on `riskScore`, `riskLevel`, or `scoreBreakdown`.
3. **Response.redirected / Response.url:** These are read-only in real Response objects. Use `Object.defineProperty` in test mocks.
4. **TypeError vs Error in fetch:** `TypeError` = DNS/network failure. `DOMException('AbortError')` = timeout. A plain `new Error()` falls to the 'unknown' error branch.
5. **Trusted subdomain matching:** `isTrusted` check uses `.some(td => domain === td || domain.endsWith('.' + td))` so `app.binance.com` matches `binance.com`.
6. **Token vs wallet ambiguity:** Both are `0x` + 40 hex chars. `scanInput()` tries token first, falls back to wallet if DexScreener returns no pairs.
7. **npm install:** Use `--legacy-peer-deps` if you hit peer dependency conflicts (vite version mismatch between Vitest and @vercel/analytics).

## CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`): lint → test → build (build depends on lint + test passing)
- **Dependabot** (`.github/dependabot.yml`): weekly npm + GitHub Actions updates
- **Vercel:** Auto-deploys on push to main

## Adding a New Scanner

1. Create `src/lib/scanners/scanNewType.ts` following the existing pattern
2. Add the input type to `InputType` in `src/types/index.ts`
3. Add detection logic to `detectInput.ts`
4. Add routing in `scanInput()` in `src/lib/scanners/index.ts`
5. Add tests in `scanNewType.test.ts`
6. If it needs a new API, create a client in `src/lib/apis/` with caching and graceful degradation

## Adding a New External API

1. Create the client in `src/lib/apis/newapi.ts`
2. Add config constants to `src/config/rules.ts`
3. Add tests in `src/lib/apis/newapi.test.ts`
4. Integrate in the relevant scanner — fire the promise early, await after structural checks
5. Add `vi.mock('@/lib/apis/newapi')` in scanner test files to prevent fetch mock consumption
6. All API calls must be non-blocking with graceful degradation (failure = no finding added)
