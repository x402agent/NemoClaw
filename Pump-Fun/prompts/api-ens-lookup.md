# API Endpoints — ENS Lookup

## Objective

Implement the 3 stub API endpoints in `packages/plugin.delivery/api/ens-lookup/` with real functionality.

## Context

Vercel Edge Functions for Ethereum Name Service resolution. Also support Solana Name Service (.sol domains) and Bonfida SNS.

## Endpoints to Implement

### 1. `resolve-ens.ts` — Resolve Name to Address

**File:** `packages/plugin.delivery/api/ens-lookup/resolve-ens.ts`

**Input:** `{ name: string }` — ENS name (e.g., "vitalik.eth") or SNS name (e.g., "toly.sol")

**Implementation:**
- For `.eth` names: use Ethereum public RPC to call ENS resolver contract
  - ENS Registry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
  - Call `resolver(namehash)` then `addr(namehash)`
- For `.sol` names: use Bonfida SNS API (`https://sns-sdk-proxy.bonfida.workers.dev/resolve/{name}`)
- Return resolved address and chain

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "vitalik.eth",
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "chain": "ethereum",
    "resolver": "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41"
  }
}
```

### 2. `reverse-resolve.ts` — Resolve Address to Name

**File:** `packages/plugin.delivery/api/ens-lookup/reverse-resolve.ts`

**Input:** `{ address: string }` — Blockchain address

**Implementation:**
- For Ethereum (0x prefix): ENS reverse resolution via `addr.reverse` → `name()`
- For Solana (base58): Bonfida reverse lookup (`https://sns-sdk-proxy.bonfida.workers.dev/favorite-domain/{address}`)
- Auto-detect chain from address format

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "name": "vitalik.eth",
    "chain": "ethereum"
  }
}
```

### 3. `check-availability.ts` — Check Name Availability

**File:** `packages/plugin.delivery/api/ens-lookup/check-availability.ts`

**Input:** `{ name: string }` — Name to check (without .eth/.sol suffix)

**Implementation:**
- Check both `.eth` and `.sol` availability
- For ENS: resolve — if no address returned, it's available
- For SNS: Bonfida resolve — if error/null, it's available

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "coolname",
    "availability": {
      "eth": { "available": true, "fullName": "coolname.eth" },
      "sol": { "available": false, "fullName": "coolname.sol", "owner": "..." }
    }
  }
}
```

## Rules

- No API keys required — use public RPC endpoints and Bonfida's public proxy
- Validate name format (alphanumeric + hyphens only for ENS)
- Handle CCIP-read for wildcard ENS names
- Cache results for 5 minutes using `Cache-Control` headers
