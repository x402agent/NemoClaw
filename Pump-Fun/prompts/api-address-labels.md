# API Endpoints — Address Labels

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/address-labels/` with real functionality.

## Context

These are Vercel Edge Function endpoints (`export const config = { runtime: 'edge' }`). They currently return stub `{ success: true, data: null, message: 'implementation pending' }` responses. Each accepts a POST request with a JSON body.

**Existing pattern** (see `api/pump-fun-sdk/bonding-curve.ts` for a working example):
- Validate input from `req.json()`
- Call external API or RPC
- Process and return structured response
- Handle errors with appropriate HTTP status codes

## Endpoints to Implement

### 1. `get-label.ts` — Get Label for Address

**File:** `packages/plugin.delivery/api/address-labels/get-label.ts`

**Input:** `{ address: string }` — Blockchain address (Ethereum or Solana)

**Implementation:**
- Use [Etherscan Labels API](https://etherscan.io/labelcloud) or Arkham Intelligence public labels
- For Solana: check known program IDs (Pump, PumpAMM, PumpFees, Jupiter, Raydium, etc.)
- Maintain a hardcoded map of well-known addresses for both chains
- Fall back to "Unknown" if no label found

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    "label": "PumpFun: Pump Program",
    "entity": "PumpFun",
    "tags": ["defi", "token-launchpad", "solana"],
    "chain": "solana"
  }
}
```

### 2. `search-entity.ts` — Search Entities by Name

**File:** `packages/plugin.delivery/api/address-labels/search-entity.ts`

**Input:** `{ query: string, chain?: string }` — Entity name to search

**Implementation:**
- Search the hardcoded known-labels map by entity name
- Return all matching addresses for that entity
- Support partial matching (case-insensitive)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "PumpFun",
    "results": [
      { "address": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", "label": "Pump Program", "chain": "solana" },
      { "address": "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", "label": "PumpAMM Program", "chain": "solana" },
      { "address": "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", "label": "PumpFees Program", "chain": "solana" }
    ]
  }
}
```

## Rules

- Keep the existing `export const config = { runtime: 'edge' }` and error handling pattern
- Validate input: return 400 if `address` or `query` is missing
- No external API keys required for v1 — use hardcoded known-label maps
- Include at minimum: Pump programs, Jupiter, Raydium, Orca, Marinade, Serum, Token Program, System Program
