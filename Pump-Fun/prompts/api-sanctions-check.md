# API Endpoints — Sanctions Check

## Objective

Implement the 1 stub API endpoint in `packages/plugin.delivery/api/sanctions-check/` with real functionality.

## Context

Vercel Edge Function for checking if a blockchain address appears on sanctions lists (OFAC SDN, EU sanctions).

## Endpoint to Implement

### `check-address.ts` — Check Address Against Sanctions Lists

**File:** `packages/plugin.delivery/api/sanctions-check/check-address.ts`

**Input:** `{ address: string, chain?: string }` — Blockchain address to check

**Implementation:**
- Fetch and cache the OFAC SDN list digital currency addresses:
  - Source: `https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.xml` or the simpler CSV
  - Alternative: Use Chainalysis free sanctions oracle contract on Ethereum (`0x40C57923924B5c5c5455c48D93317139ADDaC8fb`)
- Maintain a static list of known sanctioned addresses (Tornado Cash contracts, OFAC-listed wallets)
- Check both exact match and (for Ethereum) contract addresses associated with sanctioned entities
- Auto-detect chain from address format

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "chain": "ethereum",
    "sanctioned": false,
    "lists_checked": ["OFAC SDN", "EU Sanctions"],
    "timestamp": "2026-03-06T12:00:00Z",
    "disclaimer": "This check is informational only. Always verify with official sources."
  }
}
```

**Sanctioned response:**
```json
{
  "success": true,
  "data": {
    "address": "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
    "chain": "ethereum",
    "sanctioned": true,
    "lists_checked": ["OFAC SDN"],
    "matches": [
      {
        "list": "OFAC SDN",
        "entity": "Tornado Cash",
        "type": "Smart Contract",
        "dateAdded": "2022-08-08"
      }
    ],
    "disclaimer": "This check is informational only. Always verify with official sources."
  }
}
```

## Rules

- **ALWAYS include a legal disclaimer** — this is informational, not legal advice
- Use a static known-sanctions list for v1 (no API keys)
- Include well-known sanctioned addresses: Tornado Cash contracts, OFAC-listed wallets
- Cache sanctions list data for 24 hours
- Validate address format before checking
- Return `sanctioned: false` with confidence note if address not found (absence ≠ clearance)
- Never store or log the addresses being checked (privacy)
