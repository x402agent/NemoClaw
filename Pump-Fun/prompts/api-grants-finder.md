# API Endpoints — Grants Finder

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/grants-finder/` with real functionality.

## Context

Vercel Edge Functions for discovering active crypto/DeFi grants and funding opportunities.

## Endpoints to Implement

### 1. `get-active-grants.ts` — List Active Grants

**File:** `packages/plugin.delivery/api/grants-finder/get-active-grants.ts`

**Input:** `{ chain?: string, category?: string, limit?: number }` — Optional filters

**Implementation:**
- Maintain a curated JSON registry of active grant programs
- Include at minimum:
  - **Solana Foundation Grants** — Infrastructure, DeFi, developer tooling
  - **Superteam Bounties** — Solana ecosystem tasks
  - **Gitcoin Grants** — Open source public goods
  - **Ethereum Foundation** — Research, client teams, L2
  - **Optimism RPGF** — Retroactive public goods funding
  - **Arbitrum DAO** — Ecosystem grants
  - **Uniswap Grants** — DeFi innovation
- Filter by chain and category
- Sort by deadline (soonest first), then by amount (highest first)

**Response:**
```json
{
  "success": true,
  "data": {
    "grants": [
      {
        "name": "Solana Foundation Developer Grant",
        "organization": "Solana Foundation",
        "chain": "solana",
        "category": "developer-tooling",
        "amount": { "min": 5000, "max": 250000, "currency": "USD" },
        "deadline": "2026-06-30",
        "status": "open",
        "url": "https://solana.org/grants",
        "description": "Grants for developer tools, SDKs, and infrastructure"
      }
    ],
    "total": 15,
    "filters": { "chain": null, "category": null }
  }
}
```

### 2. `search-grants.ts` — Search Grants

**File:** `packages/plugin.delivery/api/grants-finder/search-grants.ts`

**Input:** `{ query: string, chain?: string }` — Free-text search

**Implementation:**
- Search grant name, organization, description, and category
- Case-insensitive partial matching
- Rank by relevance (exact match > partial name > description match)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "solana sdk",
    "results": [
      {
        "name": "Solana Foundation Developer Grant",
        "relevance": 0.95,
        "chain": "solana",
        "amount": "$5K-$250K",
        "deadline": "2026-06-30"
      }
    ]
  }
}
```

## Rules

- No API keys — curated static registry for v1
- Keep registry in a separate `grants-registry.json` or inline const
- Include 15-20 well-known grant programs
- Validate limit param (max 50)
- Return 200 with empty array if no matches (not 404)
