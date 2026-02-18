# ChainShield — Next Steps Roadmap

> Last updated: February 2026
> Reference this doc at the start of each session.

---

## Phase 1: Close Critical Safety Gaps

These tasks directly prevent users from being harmed by false SAFE ratings.

---

### 1.1 Honeypot Detection for Tokens

**Why**: A token with $100k liquidity and 5 days of age passes all current checks as SAFE — but could be a honeypot (can buy, can't sell). This is the #1 rug-pull mechanism.

**Approach**: Integrate the free GoPlus Security API (`https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses={address}`).

**Data points to extract**:
- `is_honeypot` — boolean → if true: danger finding, "Token is a honeypot — cannot be sold"
- `buy_tax` / `sell_tax` — percentage → if sell_tax > 10%: high finding; > 50%: danger
- `is_mintable` — boolean → if true: medium finding, "Token supply can be increased by owner"
- `is_proxy` — boolean → if true: medium finding, "Contract is upgradeable (proxy pattern)"
- `owner_address` — if not renounced: low finding, "Contract owner has not renounced ownership"
- `holder_count` — if < 50: medium finding
- `is_open_source` — if false: medium finding, "Contract source code is not verified"

**Chain ID mapping** (GoPlus uses numeric IDs):
- Ethereum: 1
- BSC: 56
- Polygon: 137
- Arbitrum: 42161

**Implementation**:
- File: `src/lib/scanners/scanToken.ts`
- Add `fetchGoPlusData(address, chainId)` helper
- Call after DexScreener data (use chainId from DexScreener response)
- If GoPlus API fails, degrade gracefully — add LOW confidence note, don't block report
- Add findings to existing findings array before `calculateRisk()`
- Timeout: 8 seconds
- New metadata fields: `isHoneypot`, `buyTax`, `sellTax`, `isMintable`, `isProxy`, `isOpenSource`, `ownerAddress`, `holderCount`

**New config entries** (in `rules.ts`):
```
GOPLUS_API_BASE: 'https://api.gopluslabs.io/api/v1'
GOPLUS_TIMEOUT: 8000
SELL_TAX_WARNING: 10    // percentage
SELL_TAX_DANGER: 50
MIN_HOLDER_COUNT: 50
```

**Tests to write**:
- Honeypot token → DANGEROUS, danger finding
- High sell tax (30%) → high finding
- Mintable + proxy → two medium findings
- GoPlus API timeout → graceful degradation, confidence drops
- GoPlus returns no data → skip honeypot checks, note in confidence reason
- Clean token (no honeypot, low tax, renounced, verified) → no additional findings

**Display in ReportCard**: Add honeypot findings to existing findings list. Add new metadata cells: "Honeypot", "Sell Tax", "Contract Verified", "Owner Renounced" in the token metadata grid.

**Estimated scope**: ~200 lines scanner code, ~50 lines config, ~300 lines tests, ~30 lines UI.

---

### 1.2 Known Scam Address Blocklist

**Why**: A known drainer address currently shows as "format valid" with LOW risk. Users who received a "send funds here" message get no warning.

**Approach**: Two layers —
1. **Static blocklist**: Ship a curated list of top known drainer/scam addresses (start with ~500 addresses from public sources). Store in `src/config/blocklist.ts`.
2. **Optional API check**: If time permits, add ChainAbuse API lookup as secondary source.

**Static blocklist format**:
```typescript
interface BlocklistEntry {
  address: string;       // lowercase, checksummed not required
  label: string;         // "Known drainer", "Phishing contract", etc.
  source: string;        // "chainabuse", "etherscan-labels", "community"
  chains?: string[];     // optional chain specificity
}
```

**Implementation**:
- New file: `src/config/blocklist.ts` — export `BLOCKED_ADDRESSES: BlocklistEntry[]`
- New helper: `src/lib/scanners/checkBlocklist.ts` — `checkBlocklist(address: string): BlocklistEntry | null`
- Integrate into: `scanWallet.ts`, `scanToken.ts`, `scanBtcWallet.ts`
- If match found: danger finding, "This address is flagged as: {label} (source: {source})"
- Score override: +60 (danger)
- Confidence: HIGH when blocklist match

**Blocklist sources to curate from**:
- Etherscan labeled addresses (public page)
- ChainAbuse top reported addresses
- ScamSniffer public feeds
- Known bridge exploit addresses

**URL blocklist** (separate):
- Add `BLOCKED_DOMAINS: string[]` to `src/config/blocklist.ts`
- Check in `scanUrl.ts` before structural analysis
- If domain matches: danger finding, skip other checks, return DANGEROUS immediately

**Tests**:
- Known scam address → DANGEROUS, HIGH confidence
- Partial match (similar but not exact) → no match (exact only)
- Case insensitive matching
- Unknown address → no blocklist findings
- URL domain on blocklist → DANGEROUS

**Estimated scope**: ~100 lines blocklist data (initial), ~60 lines checker, ~40 lines integration, ~150 lines tests.

---

### 1.3 Contract Verification Check (Etherscan)

**Why**: Unverified contracts are a major red flag. Legitimate projects almost always verify their source code.

**Approach**: Use Etherscan's free API (no key needed for basic checks, or use a free-tier key for higher rate limits).

**API**: `https://api.etherscan.io/api?module=contract&action=getabi&address={address}`
- If result is "Contract source code not verified" → unverified
- If result returns ABI → verified

**Multi-chain**: Also check BSCScan, PolygonScan, Arbiscan with same API format.

**Implementation**:
- Add to `scanToken.ts` after DexScreener chain detection
- Only check the detected chain's explorer (don't hit all 4)
- If unverified: medium finding, "Contract source code is not verified on {explorer}"
- If verified: info finding (positive signal)
- Timeout: 5 seconds
- Graceful degradation: if API fails, skip check

**Config**:
```
EXPLORER_API_URLS: {
  ethereum: 'https://api.etherscan.io/api',
  bsc: 'https://api.bscscan.com/api',
  polygon: 'https://api.polygonscan.com/api',
  arbitrum: 'https://api.arbiscan.io/api',
}
```

**Tests**:
- Verified contract → info finding
- Unverified contract → medium finding
- API timeout → skip, no finding
- Unknown chain → skip check

**Estimated scope**: ~80 lines scanner code, ~20 lines config, ~120 lines tests.

---

## Phase 2: Improve Weak Scanners

These tasks make the tx hash and wallet scanners actually useful.

---

### 2.1 Transaction Approval Decoder

**Why**: The tx scanner currently only validates format. It can't tell the user "this transaction approved unlimited USDT spending" — which is the most common wallet-draining transaction.

**Approach**: Parse the transaction input data for known function signatures without making on-chain calls.

**Function signatures to detect**:
```
approve(address,uint256)          → 0x095ea7b3
setApprovalForAll(address,bool)   → 0xa22cb465
transfer(address,uint256)         → 0xa9059cbb
transferFrom(address,address,uint256) → 0x23b872dd
```

**Implementation**:
- New file: `src/lib/scanners/decodeTx.ts`
- This is informational — we can't fetch the actual tx data without an RPC endpoint
- Instead, add a "Common approval patterns" section to the report explaining what to look for
- If user provides an Etherscan/BscScan link in the future (Phase 3), we could scrape tx input data

**Simpler v1 approach**:
- Enhance the tx scanner recommendations to be more specific and educational
- Add a "What to check" section with visual guide:
  - "Look for `approve` in the transaction method"
  - "If spender is unknown, revoke at revoke.cash"
  - "Check the token being approved and the amount"
- Add chain-specific explorer link (use detected chain, not all 4)

**Tests**: Update existing tx hash tests with new recommendation content.

**Estimated scope**: ~60 lines scanner updates, ~50 lines tests.

---

### 2.2 Wallet Scanner Enhancement

**Why**: Currently returns "format valid" + 4 explorer links. Nearly useless.

**Approach**:
1. Show only the detected/relevant chain explorer (not all 4)
2. Add blocklist check (from 1.2)
3. Add token contract detection (already exists) with better messaging
4. Add a clear "what we checked" explanation

**Implementation**:
- In `scanWallet.ts`, after format validation:
  - Check blocklist (from 1.2)
  - Keep existing DexScreener token-contract detection
  - Improve the "also a token contract" finding with link to token report
- Change confidence reason to explain what was and wasn't checked
- Reduce explorer links to most relevant (Etherscan + one more)

**Estimated scope**: ~40 lines scanner updates, ~30 lines tests.

---

### 2.3 Improve Single-Explorer Detection for Tx/Wallet

**Why**: Showing 4 explorer links when we detected the chain is Ethereum is confusing. Show the right one.

**Implementation**:
- In `scanTxHash.ts`: If chain detected, put detected chain's explorer first, others in a "Other explorers" collapsible
- In `scanWallet.ts`: Same treatment
- In ReportCard metadata display: Primary explorer link prominent, others secondary

**Estimated scope**: ~30 lines scanner, ~20 lines UI.

---

## Phase 3: Expand Chain Coverage

---

### 3.1 Solana Token Support

**Why**: Solana accounts for ~40% of retail crypto scam volume. Without it, ChainShield misses a huge audience.

**Detection**: Solana addresses are Base58-encoded, 32-44 characters, no `0x` prefix. Similar to Bitcoin but different character set context.

**Approach**:
- Add `solanaWallet` and `solanaToken` to `InputType`
- Use `@solana/web3.js` for address validation
- Use Jupiter API (`https://price.jup.ag/v4/price?ids={mint}`) or DexScreener (already supports Solana) for token data
- Use Birdeye API as backup data source

**Input detection update**:
- Base58 string, 32-44 chars, NOT starting with `1`/`3`/`bc1` → possible Solana address
- Check if valid Solana public key → route to Solana scanner

**New files**:
- `src/lib/scanners/scanSolanaToken.ts`
- Update `detectInput.ts` with Solana detection

**Estimated scope**: ~300 lines scanner, ~200 lines tests, ~20 lines detection.

---

### 3.2 Base Chain Support

**Why**: Base is the fastest-growing L2 with heavy retail activity.

**Approach**: Base is EVM-compatible, so existing token/wallet scanners work. Just need:
- Add BaseScan explorer URL to wallet/tx metadata
- Add Base chain ID mapping (8453) to DexScreener chain resolution
- Add BaseScan to chain detection HEAD requests

**Estimated scope**: ~30 lines across existing files.

---

## Phase 4: UX Improvements

---

### 4.1 Explain Baseline Score

**Why**: Beginners see "5/100" for microsoft.com and worry.

**Implementation**:
- In the score explainer section, add: "All scans start with a small baseline score (5). A score of 5 means no risk signals were detected beyond the baseline."
- Alternatively, show "0 risk signals found" more prominently than the number 5.

**Estimated scope**: ~10 lines UI.

---

### 4.2 Contextual "What Should I Do?" Guidance

**Why**: Beginners need a clear decision, not just signals.

**Implementation**:
- Add a `verdict` field to SafetyReport (or enhance `summary`):
  - SAFE: "No risk signals found. Proceed with normal caution."
  - SUSPICIOUS: "Potential risks detected. We recommend NOT interacting until you verify independently."
  - DANGEROUS: "High-risk signals detected. DO NOT interact, send funds, or connect your wallet."
- Display prominently in the summary banner with appropriate urgency.

**Estimated scope**: ~30 lines across scanner/UI.

---

### 4.3 Scan History (Local Storage, Opt-in)

**Why**: Users want to re-check or compare scans.

**Implementation**:
- Store last 20 scans in `localStorage` (opt-in via settings toggle)
- Show "Recent Scans" section on home page
- Each entry: input value (truncated), risk level badge, timestamp
- Clear all button
- No server storage — privacy intact

**Estimated scope**: ~150 lines new component + localStorage logic.

---

### 4.4 Mobile-First Polish

**Why**: Many crypto users are mobile-first (checking links from Telegram/Discord on phone).

**Tasks**:
- Test all views at 375px width
- Ensure scan form input is large enough for thumb tapping
- Score ring should not overflow on small screens
- Metadata grid should stack to single column on mobile
- Share button should use native share sheet (already implemented)

**Estimated scope**: ~50 lines CSS tweaks.

---

### 4.5 Hide +0 Score Items from Beginner View

**Why**: "+0" items in the score breakdown confuse beginners.

**Implementation**:
- In the "Why this score?" collapsible, only show items with `scoreImpact > 0` by default
- Add a "Show all" toggle to reveal +0 items
- Or: separate into "Contributing factors" (>0) and "Passed checks" (0)

**Estimated scope**: ~20 lines UI.

---

## Phase 5: Long-Term

| Feature | Description |
|---------|-------------|
| Browser extension | Right-click "Check with ChainShield." Intercept wallet connection prompts. |
| Community reporting | Anonymous scam flagging → crowdsourced blocklist |
| Real-time monitoring | "Watch this token" → alert if liquidity drops >50% |
| Multi-language | Spanish + Chinese covers huge victim populations |
| ML scoring | Train on labeled scam/legit data for dynamic weighting |

---

## Implementation Order (Recommended)

```
Week 1:  1.1 Honeypot Detection (biggest safety gap)
Week 1:  1.2 Scam Blocklist (quick wins for wallet/token)
Week 2:  1.3 Contract Verification Check
Week 2:  4.1 Explain Baseline Score
Week 2:  4.2 Contextual Verdict Guidance
Week 3:  2.1 Tx Approval Education
Week 3:  2.2 Wallet Scanner Enhancement
Week 3:  2.3 Single Explorer Detection
Week 4:  3.2 Base Chain Support (quick, EVM-compatible)
Week 4:  4.5 Hide +0 Items
Week 5:  3.1 Solana Support (larger effort)
Week 5:  4.3 Scan History
Week 6:  4.4 Mobile Polish + Full QA Pass
```

---

## Testing Strategy for Each Phase

Every new feature must include:
1. Unit tests for all scanner logic (happy path + edge cases + API failures)
2. TypeScript type safety (no `any` types)
3. Build verification (`tsc --noEmit` + `next build`)
4. Visual QA with Playwright (screenshot key states)
5. Mobile viewport check (375px)

---

## Files Likely Touched Per Phase

| Phase | Files |
|-------|-------|
| 1.1 | `scanToken.ts`, `rules.ts`, `types/index.ts`, `ReportCard.tsx`, `scanToken.test.ts` |
| 1.2 | NEW `blocklist.ts`, NEW `checkBlocklist.ts`, `scanWallet.ts`, `scanToken.ts`, `scanBtcWallet.ts`, `scanUrl.ts` |
| 1.3 | `scanToken.ts`, `rules.ts`, `scanToken.test.ts` |
| 2.1 | `scanTxHash.ts`, `scanTxHash.test.ts` |
| 2.2 | `scanWallet.ts`, `scanWallet.test.ts` |
| 3.1 | NEW `scanSolanaToken.ts`, `detectInput.ts`, `types/index.ts`, `ReportCard.tsx` |
| 3.2 | `scanTxHash.ts`, `scanWallet.ts`, `rules.ts` |
| 4.x | `ReportCard.tsx`, `page.tsx`, `globals.css` |
