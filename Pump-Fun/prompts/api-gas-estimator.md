# API Endpoints — Gas Estimator

## Objective

Implement the 2 stub API endpoints in `packages/plugin.delivery/api/gas-estimator/` with real functionality.

## Context

Vercel Edge Functions for estimating transaction costs. Focus on Solana (priority fees + compute units) with Ethereum support.

## Endpoints to Implement

### 1. `estimate-gas.ts` — Estimate Transaction Cost

**File:** `packages/plugin.delivery/api/gas-estimator/estimate-gas.ts`

**Input:**
```json
{
  "chain": "solana",
  "transactionType": "swap",
  "priority": "medium"
}
```

**Implementation:**
- **Solana:** Fetch recent priority fees via `getRecentPrioritizationFees` RPC
  - Calculate p25/p50/p75/p99 from recent fees
  - Base fee: 5000 lamports (signature) + compute unit price × compute units
  - Map priority levels: low (p25), medium (p50), high (p75), urgent (p99)
  - Estimate compute units by transaction type (transfer: 200, swap: 300K, create token: 400K)
- **Ethereum:** Fetch `eth_gasPrice` + `eth_maxPriorityFeePerGas` from public RPC

**Response:**
```json
{
  "success": true,
  "data": {
    "chain": "solana",
    "estimates": {
      "low":    { "fee": 0.000005, "unit": "SOL", "usd": 0.0008, "priorityFee": 1000 },
      "medium": { "fee": 0.000025, "unit": "SOL", "usd": 0.004, "priorityFee": 50000 },
      "high":   { "fee": 0.0005, "unit": "SOL", "usd": 0.08, "priorityFee": 1000000 },
      "urgent": { "fee": 0.005, "unit": "SOL", "usd": 0.80, "priorityFee": 10000000 }
    },
    "baseFee": 0.000005,
    "computeUnits": 300000,
    "timestamp": "2026-03-06T12:00:00Z"
  }
}
```

### 2. `simulate-transaction.ts` — Simulate Transaction

**File:** `packages/plugin.delivery/api/gas-estimator/simulate-transaction.ts`

**Input:**
```json
{
  "transaction": "base64-encoded-transaction",
  "chain": "solana"
}
```

**Implementation:**
- **Solana:** Use `simulateTransaction` RPC method
  - Decode base64 transaction
  - Call `simulateTransaction` with `replaceRecentBlockhash: true`
  - Return compute units consumed, logs, and success/failure
- Return error details if simulation fails (insufficient funds, invalid accounts, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "chain": "solana",
    "simulation": {
      "success": true,
      "computeUnitsConsumed": 245000,
      "estimatedFee": 0.000025,
      "estimatedFeeUsd": 0.004,
      "logs": ["Program 6EF8r... invoke [1]", "Program log: Instruction: Buy", "..."],
      "accountChanges": [
        { "address": "...", "solChange": -0.1, "tokenChange": 50000 }
      ]
    }
  }
}
```

## Rules

- Use `SOLANA_RPC_URL` env var (fallback to public mainnet-beta)
- For ETH: use `https://eth.llamarpc.com` as free public RPC
- Fetch SOL/USD from Jupiter for USD conversion
- Validate base64 transaction before simulation
- Never execute transactions — simulation only
- Cache priority fee data for 10 seconds
