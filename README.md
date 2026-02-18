# ChainShield

Privacy-first crypto safety scanner. Paste a URL, token contract, transaction hash, or wallet address and get an instant risk assessment — no tracking, no cookies, no data stored.

**Live demo:** [chainshield-gray.vercel.app](https://chainshield-gray.vercel.app/)

## What It Does

ChainShield analyzes crypto-related inputs for known scam patterns and risk signals using multiple security databases:

- **URL Scanner** — Suspicious TLDs, scam keywords, unicode/homoglyph attacks, subdomain spoofing, IP-based URLs, HTTPS verification, redirect chain analysis, SSRF protection, and phishing database check (GoPlus)
- **Token Scanner** — Liquidity analysis (DexScreener), 24h volume, price volatility, pair age, FDV-to-liquidity ratio, honeypot detection, buy/sell tax analysis, contract verification (Sourcify), proxy/selfdestruct detection (GoPlus)
- **Transaction Scanner** — Hash format validation, auto chain detection across 4 networks, multi-chain explorer links, approval safety guidance
- **Wallet Scanner** — EVM + BTC address checksum validation, malicious activity detection across ETH + BSC (GoPlus), multi-chain explorer links (6 networks)

## Risk Scoring

Every scan produces a score from 0-100:

| Score | Level | Meaning |
|-------|-------|---------|
| 0-30 | SAFE | No known scam patterns detected |
| 31-60 | SUSPICIOUS | Some risk signals found — proceed with caution |
| 61-100 | DANGEROUS | Strong scam indicators detected — avoid |

Severity override: any `danger` finding forces at least SUSPICIOUS. A danger finding with score >= 60 forces DANGEROUS.

## External APIs

All APIs are free, public, and require no authentication:

| API | Used For | Rate Limit |
|-----|----------|------------|
| [DexScreener](https://dexscreener.com) | Token trading pairs, liquidity, volume | None |
| [GoPlus Security](https://gopluslabs.io) | Phishing URLs, token honeypots, malicious wallets | 30 req/min |
| [Sourcify](https://sourcify.dev) | Smart contract source code verification | None |

All API calls are non-blocking. If any API fails, the scanner returns a valid report with reduced confidence (graceful degradation).

## Privacy

- No wallet connection required
- No scan data stored on any server
- No analytics or tracking
- No cookies
- No login or account needed
- Session storage used only for recent scan history (cleared when tab closes)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test          # run all 301 tests
npm run test:watch # watch mode
```

## Project Structure

```
src/
  app/
    api/scan/       — POST endpoint with rate limiting
    about/          — About page
    privacy/        — Privacy policy
    report/         — Shareable report page
    not-found.tsx   — Custom 404
    sitemap.ts      — Dynamic sitemap
  components/       — React components (ScanForm, ReportCard, RiskScore, etc.)
  config/rules.ts   — All thresholds, TLD lists, explorer configs
  lib/
    apis/           — GoPlus + Sourcify API clients with caching
    riskScoring/    — Score calculation + risk level determination
    scanners/       — URL, Token, TxHash, Wallet, BTC scanners
    validation/     — EVM + BTC address checksum validation
  types/index.ts    — All TypeScript interfaces
```

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS v4
- [Vitest](https://vitest.dev) 2.x
- [ethers.js](https://docs.ethers.org) — EVM address validation
- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib) — BTC address validation

## Security

- SSRF protection: blocks redirects to private/reserved IPs, localhost, and cloud metadata endpoints (IPv4 + IPv6)
- Redirect loop detection via visited URL tracking
- Rate limiting: in-memory sliding window (30 requests per 60 seconds per IP)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Input length capped at 2000 characters
- No user input logged server-side
- All clipboard operations have `.catch()` error handlers

## Roadmap

Upcoming features and improvements:

- **Multi-chain token scanning** — Expand GoPlus coverage to Solana, Avalanche, and Base
- **NFT contract scanner** — Detect fake mints, honeypot NFTs, and malicious approval patterns
- **ENS / domain resolution** — Resolve .eth names and scan the underlying address
- **Browser extension** — One-click scan from any dApp or DEX page
- **Bulk scan API** — Scan multiple addresses/URLs in a single request
- **Historical risk tracking** — Show how a token's risk score changes over time
- **Community threat feed** — Crowdsourced scam reports integrated into scoring
- **Telegram / Discord bot** — Scan links shared in group chats automatically

## Disclaimer

This tool provides **risk signals**, not guarantees. A "SAFE" rating does not mean a project is legitimate — it means no known scam patterns were detected. Always do your own research (DYOR) before interacting with any smart contract or sending funds. This is not financial advice.

## License

[MIT](LICENSE)
