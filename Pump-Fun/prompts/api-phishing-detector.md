# API Endpoints — Phishing Detector

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/phishing-detector/` with real functionality.

## Context

Vercel Edge Functions for detecting phishing URLs and malicious contracts.

## Endpoints to Implement

### 1. `check-url.ts` — Check URL for Phishing

**File:** `packages/plugin.delivery/api/phishing-detector/check-url.ts`

**Input:** `{ url: string }` — URL to check

**Implementation:**
- Maintain a blocklist of known phishing domains (common DeFi phishing patterns)
- Check against patterns:
  - Typosquatting of major protocols (e.g., "pumpp.fun", "uni5wap.org", "jup1ter.ag")
  - Known phishing TLDs and suspicious patterns
  - Homoglyph detection (Cyrillic lookalikes: а→a, е→e, о→o)
  - URL shorteners wrapping suspicious domains
- Check against [MetaMask's eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect) blocklist (fetch the raw JSON)
- Whitelist known-good domains (pump.fun, jup.ag, raydium.io, dexscreener.com, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://pumpp.fun/token/abc",
    "isPhishing": true,
    "confidence": "high",
    "reason": "Typosquat of pump.fun (double 'p')",
    "checks": {
      "blocklist": false,
      "typosquat": true,
      "homoglyph": false,
      "suspiciousTld": false,
      "whitelisted": false
    },
    "legitimateDomain": "pump.fun"
  }
}
```

### 2. `check-contract.ts` — Check Contract Address

**File:** `packages/plugin.delivery/api/phishing-detector/check-contract.ts`

**Input:** `{ address: string, chain?: string }` — Contract/program address

**Implementation:**
- Check against known malicious address lists
- For Solana: verify if the program is verified/audited via known program IDs
- Check if address mimics a known program (first/last characters match but middle differs)
- Flag addresses that appear in phishing transaction patterns
- Whitelist known-good programs (SPL Token, Pump, PumpAMM, Jupiter, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    "chain": "solana",
    "isMalicious": false,
    "confidence": "high",
    "label": "PumpFun: Pump Program",
    "verified": true,
    "checks": {
      "blocklist": false,
      "addressMimicry": false,
      "knownProgram": true
    }
  }
}
```

## Rules

- No external API keys required for v1 — use static blocklists + pattern matching
- Fetch MetaMask blocklist at runtime (cache 1 hour)
- NEVER return false negatives on whitelisted domains — if it's known-good, say so
- Validate URL format before checking
- Auto-detect chain from address format (0x = ETH, base58 = Solana)
- Maintain whitelists for at minimum: pump.fun, jup.ag, raydium.io, orca.so, marinade.finance, dexscreener.com, birdeye.so, solscan.io, explorer.solana.com
