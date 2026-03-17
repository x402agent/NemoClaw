# Transaction Simulation

## Objective

Add transaction simulation capabilities to the SDK — dry-run buys, sells, and token creation before submitting to the network.

## Context

Users want to preview what will happen before signing. This means simulating transactions locally/via RPC to show expected token amounts, SOL costs, fees, and account changes — without actually executing.

**Existing SDK patterns:**
- `src/sdk.ts` — `PumpSdk` returns `TransactionInstruction[]`
- `src/online-sdk.ts` — `OnlinePumpSdk` has RPC connection
- `src/bonding-curve.ts` — Buy/sell math, fee calculation

## Architecture

### New Files

```
src/
├── simulation/
│   ├── index.ts              # Re-exports
│   ├── types.ts              # Simulation result types
│   ├── simulator.ts          # Core simulation engine
│   └── formatters.ts         # Human-readable simulation output
```

### API

```typescript
// Add to OnlinePumpSdk:
class OnlinePumpSdk {
  // Simulate a buy
  async simulateBuy(params: {
    mint: PublicKey;
    buyer: PublicKey;
    solAmount: BN;
    slippageBps?: number;
  }): Promise<SimulationResult>;

  // Simulate a sell
  async simulateSell(params: {
    mint: PublicKey;
    seller: PublicKey;
    tokenAmount: BN;
    slippageBps?: number;
  }): Promise<SimulationResult>;

  // Simulate token creation
  async simulateCreate(params: {
    creator: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    initialBuySol?: BN;
  }): Promise<SimulationResult>;

  // Simulate any set of instructions
  async simulateInstructions(params: {
    instructions: TransactionInstruction[];
    payer: PublicKey;
  }): Promise<SimulationResult>;
}
```

### SimulationResult Type

```typescript
interface SimulationResult {
  success: boolean;
  error?: string;

  // Execution details
  computeUnitsConsumed: number;
  estimatedFee: BN;              // Lamports
  logs: string[];

  // Account changes (before → after)
  accountChanges: AccountChange[];

  // Trade-specific (for buy/sell)
  trade?: {
    tokensIn?: BN;
    tokensOut?: BN;
    solIn?: BN;
    solOut?: BN;
    pricePerToken: BN;
    priceImpact: number;          // Percentage
    fees: {
      platformFee: BN;
      creatorFee: BN;
      totalFee: BN;
    };
    newMarketCap: BN;
    newCurveProgress: number;     // Percentage toward graduation
  };
}

interface AccountChange {
  address: string;
  label?: string;                 // "Buyer", "Bonding Curve", "Fee Vault"
  solBefore: BN;
  solAfter: BN;
  solDelta: BN;
  tokenBefore?: BN;
  tokenAfter?: BN;
  tokenDelta?: BN;
}
```

### Implementation Strategy

1. **Offline simulation (fast, no RPC):**
   - Use bonding curve math from `src/bonding-curve.ts`
   - Calculate expected tokens, fees, price impact purely from math
   - Requires current bonding curve state (pass in or fetch once)

2. **RPC simulation (accurate, requires connection):**
   - Build full transaction from instructions
   - Call `connection.simulateTransaction()` with `replaceRecentBlockhash: true`
   - Parse logs and compute units
   - Diff account balances before/after

3. **Hybrid (recommended):**
   - Use offline math for trade preview (tokens, fees, price impact)
   - Use RPC simulation for execution validation (will it succeed?)
   - Combine both into one `SimulationResult`

## Implementation Rules

1. Never sign or submit transactions — simulation only
2. Use `BN` for all financial amounts
3. Offline simulation should work without RPC (use `PumpSdk`)
4. RPC simulation uses `simulateTransaction` — never `sendTransaction`
5. Include human-readable labels for account changes
6. Fee calculation must match on-chain logic exactly (use existing `BondingCurve` methods)

## Deliverables

1. Complete `src/simulation/` directory
2. `simulateBuy`, `simulateSell`, `simulateCreate` on `OnlinePumpSdk`
3. Offline-only simulation for environments without RPC
4. Human-readable formatted output
5. Tests with mocked RPC responses
6. Export from `src/index.ts`
