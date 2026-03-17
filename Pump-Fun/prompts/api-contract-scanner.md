# API Endpoints — Contract Scanner

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/contract-scanner/` with real functionality.

## Context

Vercel Edge Functions for scanning Solana token contracts for red flags.

## Endpoints to Implement

### 1. `scan-token.ts` — Scan Token for Red Flags

**File:** `packages/plugin.delivery/api/contract-scanner/scan-token.ts`

**Input:** `{ mint: string, chain?: string }` — Token mint address

**Implementation:**
- For Solana tokens: fetch token account via RPC (`getAccountInfo`)
- Check: mint authority (should be null for safe tokens), freeze authority, supply, decimals
- For PumpFun tokens: fetch bonding curve state — check `complete` status, virtual reserves
- Check if metadata is mutable (red flag)
- Check token program (Token vs Token-2022)

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "...",
    "chain": "solana",
    "riskLevel": "low",
    "checks": {
      "mintAuthority": { "status": "pass", "detail": "Mint authority revoked" },
      "freezeAuthority": { "status": "pass", "detail": "No freeze authority" },
      "mutableMetadata": { "status": "warn", "detail": "Metadata is mutable" },
      "supply": { "status": "pass", "detail": "1,000,000,000 tokens" },
      "program": { "status": "info", "detail": "SPL Token Program" },
      "bondingCurve": { "status": "info", "detail": "45% filled, not graduated" }
    },
    "score": 85,
    "flags": ["mutable_metadata"]
  }
}
```

### 2. `check-honeypot.ts` — Check for Honeypot

**File:** `packages/plugin.delivery/api/contract-scanner/check-honeypot.ts`

**Input:** `{ mint: string, chain?: string }` — Token mint address

**Implementation:**
- Fetch token mint info: if freeze authority exists → high risk
- Check if token has any sell transactions (via PumpFun trades API)
- If only buys and no sells → potential honeypot
- For PumpFun tokens: bonding curve tokens are inherently sellable (not honeypots) — note this
- Check top holder concentration

**Response:**
```json
{
  "success": true,
  "data": {
    "mint": "...",
    "isHoneypot": false,
    "confidence": "high",
    "reason": "PumpFun bonding curve — sells are guaranteed by AMM",
    "checks": {
      "freezeAuthority": false,
      "sellsExist": true,
      "topHolderConcentration": 12.5,
      "bondingCurveActive": true
    }
  }
}
```

## Rules

- Use `SOLANA_RPC_URL` env var for RPC calls (fallback to public endpoint)
- Validate mint is valid base58
- PumpFun-specific: use bonding curve PDA derivation to check if token is a Pump token
- Return 404 if mint doesn't exist on-chain
