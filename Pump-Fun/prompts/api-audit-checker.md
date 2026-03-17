# API Endpoints — Audit Checker

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/audit-checker/` with real functionality.

## Context

Vercel Edge Functions. Currently return stub responses. Accept POST with JSON body.

## Endpoints to Implement

### 1. `get-audits.ts` — Get Audits for a Protocol

**File:** `packages/plugin.delivery/api/audit-checker/get-audits.ts`

**Input:** `{ protocol: string }` — Protocol name (e.g., "PumpFun", "Uniswap")

**Implementation:**
- Query [DeFi Safety API](https://defisafety.com/) or maintain a curated registry of known audits
- For PumpFun specifically: reference `security/` directory audit files
- Return audit firm, date, scope, findings summary, and link

**Response:**
```json
{
  "success": true,
  "data": {
    "protocol": "PumpFun",
    "audits": [
      {
        "firm": "Internal",
        "date": "2026-03-06",
        "scope": "CLI, Rust vanity generator, TypeScript vanity generator",
        "findings": { "critical": 0, "high": 0, "medium": 2, "low": 5 },
        "reportUrl": "https://github.com/nirholas/pump-fun-sdk/tree/main/security"
      }
    ],
    "riskScore": "medium",
    "lastAuditAge": "0 days"
  }
}
```

### 2. `search-audits.ts` — Search Audit Database

**File:** `packages/plugin.delivery/api/audit-checker/search-audits.ts`

**Input:** `{ query: string, chain?: string, firm?: string }` — Search criteria

**Implementation:**
- Search the curated audit registry by protocol name, chain, or audit firm
- Return matching audits sorted by date (newest first)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "solana defi",
    "results": [
      {
        "protocol": "PumpFun",
        "chain": "solana",
        "auditCount": 3,
        "latestAudit": "2026-03-06",
        "firms": ["Internal"]
      }
    ]
  }
}
```

## Rules

- Keep existing edge runtime config and error handling
- Validate input: return 400 if required fields missing
- Maintain a hardcoded curated registry for v1 — no external API key required
- Include at minimum: PumpFun, Jupiter, Raydium, Marinade, Orca, Solend
