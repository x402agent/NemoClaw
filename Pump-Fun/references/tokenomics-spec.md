# Tokenomics Spec — Revenue, Distribution & Burn Mechanics

## Table of Contents

1. Revenue Collection
2. Distribution Algorithm
3. Buyback Engine
4. Burn Mechanics
5. Staking System
6. Treasury Management
7. On-Chain Transparency

---

## 1. Revenue Collection

### Profit Calculation

```typescript
interface TradePnL {
  tradeId: string;
  entrySignature: string;
  exitSignature: string;
  pair: string;               // e.g. "MAWD/SOL"
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  sizeInSol: number;
  grossPnlSol: number;        // Raw profit/loss
  feesPayedSol: number;       // TX fees + priority fees + Jito tips
  netPnlSol: number;          // grossPnl - fees
  timestamp: number;
}

// Net PnL formula:
// netPnl = (exitPrice - entryPrice) * positionSize - totalFees
// Only POSITIVE netPnl enters the distribution pipeline
```

### Revenue Accumulator

```typescript
interface RevenueAccumulator {
  periodStart: number;          // Unix timestamp
  periodEnd: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  grossRevenueSol: number;      // Sum of positive PnLs
  grossLossSol: number;         // Sum of negative PnLs (absolute)
  netRevenueSol: number;        // gross - loss
  totalFeesPayedSol: number;
  distributableSol: number;     // Net revenue available for distribution
}

// Distribution is triggered when:
// 1. distributableSol >= MIN_BUYBACK_THRESHOLD_SOL (from .env)
// 2. OR manual trigger by ClawdGut tier (multisig)
// 3. OR scheduled (e.g., every 24h if balance > 0)
```

---

## 2. Distribution Algorithm

### Revenue Split

```typescript
interface DistributionConfig {
  buybackBurnPct: number;       // Default 40 (from BUYBACK_BURN_PCT)
  stakerRevenuePct: number;     // Default 35 (from STAKER_REVENUE_PCT)
  treasuryPct: number;          // Default 15 (from TREASURY_PCT)
  devFundPct: number;           // Default 10 (from DEV_FUND_PCT)
}

// Validation: sum must equal 100
function validateDistributionConfig(config: DistributionConfig): void {
  const sum = config.buybackBurnPct + config.stakerRevenuePct
            + config.treasuryPct + config.devFundPct;
  if (sum !== 100) {
    throw new DistributionConfigError(`Split sums to ${sum}, must be 100`);
  }
}
```

### Distribution Execution Flow

```
1. Snapshot distributable balance
2. Validate distribution config
3. Calculate each bucket's allocation
4. Execute in order:
   a. Treasury transfer (simplest, do first)
   b. Dev fund transfer
   c. Staker distribution (complex, see below)
   d. Buyback & burn (market operation, do last)
5. Log distribution record to ClawVault
6. Emit distribution event for dashboard
```

### Staker Revenue Distribution

Pro-rata distribution based on staked MAWD balance.

```typescript
interface StakerDistribution {
  totalPool: number;            // SOL allocated to stakers
  totalStakedMawd: bigint;      // Sum of all staked MAWD
  stakersCount: number;
  distributions: StakerPayout[];
}

interface StakerPayout {
  wallet: string;
  stakedMawd: bigint;
  sharePercent: number;         // (stakedMawd / totalStaked) * 100
  payoutSol: number;            // totalPool * sharePercent
  signature: string;            // Transfer TX signature
}

// Formula per staker:
// payout = (stakerBalance / totalStaked) * stakerPool
//
// Minimum payout: 0.001 SOL (below this, accumulate to next cycle)
// Dust amounts are carried forward, never lost

// Distribution is batched:
// - Up to 5 transfers per transaction (Solana TX size limit)
// - Jito bundle for atomicity
// - If any transfer fails, entire batch retries
```

### Holder Snapshot

Before every distribution, take a snapshot of all stakers:

```typescript
interface HolderSnapshot {
  snapshotId: string;
  timestamp: number;
  blockSlot: number;
  totalStakers: number;
  totalStakedMawd: bigint;
  stakers: Array<{
    wallet: string;
    stakedMawd: bigint;
    stakeSince: number;          // When they first staked
    tier: AccessTier;
  }>;
}

// Snapshot is stored in ClawVault for audit trail
// Distribution MUST reference a snapshot ID
```

---

## 3. Buyback Engine

### Buyback Execution

```typescript
interface BuybackConfig {
  minThresholdSol: number;      // MIN_BUYBACK_THRESHOLD_SOL
  maxSingleBuybackSol: number;  // Cap per execution (prevent price impact)
  maxSlippageBps: number;       // MAX_SLIPPAGE_BPS
  cooldownMs: number;           // Min time between buybacks (prevent spam)
  useDca: boolean;              // Split large buybacks into DCA
  dcaIntervalMs: number;        // Time between DCA chunks
  dcaChunks: number;            // Number of DCA splits
}

// Buyback flow:
// 1. Check accumulated buyback allocation >= minThreshold
// 2. If allocation > maxSingleBuyback, use DCA strategy
// 3. Get Jupiter quote for SOL -> MAWD
// 4. Verify price impact < acceptable threshold
// 5. Build swap TX with Jito bundle
// 6. Simulate TX
// 7. Submit via Jito
// 8. Confirm TX
// 9. Purchased MAWD sent to burn step
// 10. Log buyback to ClawVault
```

### Price Impact Protection

```typescript
// Don't execute buyback if:
// - Price impact > 5% (configurable)
// - MAWD liquidity < 2x buyback amount
// - Price pumped >10% in last hour (avoid buying the top)
// Instead: defer to next cycle or split into smaller DCA chunks

interface BuybackGuard {
  maxPriceImpactPct: number;     // 5.0
  minLiquidityMultiple: number;  // 2.0
  maxRecentPumpPct: number;      // 10.0
  recentPumpWindowMs: number;    // 3600000 (1 hour)
}
```

---

## 4. Burn Mechanics

### Token Burn Execution

```typescript
// Solana SPL token burn:
// - Uses burnChecked instruction from @solana/spl-token
// - Requires token account authority
// - Permanently reduces total supply

interface BurnRecord {
  burnId: string;
  signature: string;
  mint: string;                  // MAWD mint
  amount: bigint;
  amountUi: number;
  burnedFrom: string;            // Agent's token account
  memo: string;                  // "MAWD Agent Buyback Burn #N"
  previousSupply: bigint;
  newSupply: bigint;
  percentOfSupply: number;
  timestamp: number;
  triggerType: 'SCHEDULED' | 'THRESHOLD' | 'MANUAL';
}

// Burn transaction structure:
// Instruction 1: Memo program -- "MAWD Agent Buyback Burn #{burnCount}"
// Instruction 2: burnChecked(tokenAccount, mint, authority, amount, decimals)
// Wrapped in Jito bundle for confirmation
```

### Burn Transparency

Every burn must include a Memo instruction so it's human-readable on any explorer. The memo format:

```
MAWD-BURN|v1|{burnCount}|{amountUi}|{triggerType}|{distributionId}
```

Example: `MAWD-BURN|v1|42|25000.5|SCHEDULED|dist-2025-01-15-001`

---

## 5. Staking System

### Stake/Unstake Mechanics

```typescript
interface StakePosition {
  id: string;
  wallet: string;
  amountMawd: bigint;
  stakedAt: number;              // Unix timestamp
  lockUntil: number | null;      // Null = no lock (flexible)
  lockTier: 'FLEX' | '30D' | '90D' | '180D';
  multiplier: number;            // Lock bonus multiplier
  claimedRevenueSol: number;     // Total claimed so far
  pendingRevenueSol: number;     // Unclaimed
}

// Lock multipliers:
// FLEX:  1.0x (no lock, withdraw anytime)
// 30D:   1.25x
// 90D:   1.5x
// 180D:  2.0x

// Effective stake for distribution:
// effectiveStake = stakedAmount * multiplier
// This means locked stakers earn proportionally more
```

### Staking Storage

**Option A: Supabase (off-chain, simpler)**
- Staking data stored in ClawVault
- Faster to implement, no program deployment
- Trust model: users trust the agent operator
- Good for MVP/initial launch

**Option B: On-chain PDA (trustless)**
- Anchor program with stake/unstake instructions
- PDA per staker derived from wallet + MAWD mint
- Fully trustless but requires program deployment
- Better for long-term decentralization

---

## 6. Treasury Management

```typescript
interface TreasuryState {
  balanceSol: number;
  balanceMawd: bigint;
  totalReceivedSol: number;
  totalSpentSol: number;
  allocations: TreasuryAllocation[];
}

interface TreasuryAllocation {
  purpose: 'RPC_COSTS' | 'HOSTING' | 'API_KEYS' | 'EMERGENCY' | 'GROWTH';
  budgetSol: number;
  spentSol: number;
}

// Treasury rules:
// - 50% of treasury is "emergency reserve" (untouchable unless agent is unprofitable)
// - 30% for operational costs (RPC, hosting, API keys)
// - 20% for growth (marketing, partnerships, new features)
// - All spends require ClawdGut tier approval (multisig)
```

---

## 7. On-Chain Transparency

### Public Reporting

All financial operations are verifiable:

1. **Burn transactions** — Searchable on Solscan/Birdeye by memo prefix `MAWD-BURN`
2. **Distribution transactions** — Logged with memo `MAWD-DIST|{distributionId}`
3. **Buyback transactions** — Logged with memo `MAWD-BUY|{buybackId}`
4. **Treasury operations** — Logged with memo `MAWD-TREASURY|{operationType}`

### Dashboard Metrics (exposed via API)

```typescript
interface PublicMetrics {
  totalBurnedMawd: bigint;
  totalDistributedSol: number;
  totalBuybackVolumeSol: number;
  currentApy: number;            // Annualized based on last 30 days
  totalStakedMawd: bigint;
  stakerCount: number;
  agentPnl24h: number;
  agentPnl7d: number;
  agentPnl30d: number;
  agentWinRate: number;
  lastBurnTimestamp: number;
  lastDistributionTimestamp: number;
  nextDistributionEstimate: number;
}
```
