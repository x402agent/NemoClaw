# Supabase Schema — ClawVault Database

## Table of Contents

1. Migration Strategy
2. Core Tables
3. Indexes
4. Row-Level Security
5. Functions & Triggers

---

## 1. Migration Strategy

Migrations live in `supabase/migrations/` with timestamped filenames:

```
001_create_episodes.sql
002_create_positions.sql
003_create_stakes.sql
004_create_revenue.sql
005_create_holders.sql
006_create_agent_state.sql
007_create_governance.sql
```

Run via: `npx supabase db push` or programmatically on agent startup.

---

## 2. Core Tables

### 1. Trading Episodes

```sql
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,

  -- Signal data
  signal_type TEXT NOT NULL,           -- 'RSI_EMA' | 'SENTIMENT' | 'WHALE' | 'CONFLUENCE'
  signal_score NUMERIC(6,4) NOT NULL,  -- -1.0 to 1.0
  signal_sources JSONB NOT NULL,       -- Array of contributing signals

  -- Trade data
  pair TEXT NOT NULL,                  -- e.g. 'MAWD/SOL'
  side TEXT NOT NULL,                  -- 'LONG' | 'SHORT'
  entry_price NUMERIC(20,10),
  exit_price NUMERIC(20,10),
  size_sol NUMERIC(12,6),
  size_mawd NUMERIC(20,6),

  -- Execution data
  entry_signature TEXT,
  exit_signature TEXT,
  entry_slot BIGINT,
  exit_slot BIGINT,
  slippage_bps INTEGER,
  priority_fee_lamports BIGINT,
  jito_tip_lamports BIGINT,

  -- Result
  status TEXT NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED' | 'CANCELLED'
  gross_pnl_sol NUMERIC(12,6),
  fees_sol NUMERIC(12,6),
  net_pnl_sol NUMERIC(12,6),

  -- Metadata
  strategy_version TEXT NOT NULL,
  error_message TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Open Positions

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id),

  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC(20,10) NOT NULL,
  current_price NUMERIC(20,10),
  size_sol NUMERIC(12,6) NOT NULL,

  -- Stop/Take profit
  stop_loss_price NUMERIC(20,10),
  take_profit_price NUMERIC(20,10),
  trailing_stop_pct NUMERIC(6,4),
  trailing_stop_active BOOLEAN DEFAULT FALSE,
  highest_price NUMERIC(20,10),        -- For trailing stop calculation

  -- Status
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'CLOSING' | 'CLOSED'
  unrealized_pnl_sol NUMERIC(12,6),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3. Staking Positions

```sql
CREATE TABLE stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,

  amount_raw TEXT NOT NULL,              -- bigint as string (MAWD with decimals)
  amount_ui NUMERIC(20,6) NOT NULL,      -- Human-readable MAWD
  lock_tier TEXT NOT NULL DEFAULT 'FLEX', -- 'FLEX' | '30D' | '90D' | '180D'
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  effective_amount TEXT NOT NULL,         -- amount_raw * multiplier (as string)

  staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lock_until TIMESTAMPTZ,                -- NULL for FLEX
  unstaked_at TIMESTAMPTZ,               -- NULL while active

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Revenue tracking per stake
  total_claimed_sol NUMERIC(12,6) NOT NULL DEFAULT 0,
  pending_revenue_sol NUMERIC(12,6) NOT NULL DEFAULT 0,
  last_claim_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one active stake per wallet per lock tier
CREATE UNIQUE INDEX idx_stakes_active_wallet_tier
  ON stakes(wallet, lock_tier)
  WHERE is_active = TRUE;
```

### 4. Revenue & Distributions

```sql
CREATE TABLE distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_trades INTEGER NOT NULL,
  winning_trades INTEGER NOT NULL,
  gross_revenue_sol NUMERIC(12,6) NOT NULL,
  net_revenue_sol NUMERIC(12,6) NOT NULL,

  -- Allocation
  buyback_sol NUMERIC(12,6) NOT NULL,
  staker_pool_sol NUMERIC(12,6) NOT NULL,
  treasury_sol NUMERIC(12,6) NOT NULL,
  dev_fund_sol NUMERIC(12,6) NOT NULL,

  -- Execution
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
  snapshot_id UUID,                       -- Reference to holder_snapshots

  -- Signatures
  treasury_signature TEXT,
  dev_fund_signature TEXT,
  buyback_signatures TEXT[],
  burn_signatures TEXT[],

  -- Metadata
  config_snapshot JSONB NOT NULL,          -- Distribution percentages at time of execution
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE staker_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES distributions(id),

  wallet TEXT NOT NULL,
  staked_mawd TEXT NOT NULL,               -- bigint as string
  effective_mawd TEXT NOT NULL,            -- With multiplier
  share_percent NUMERIC(8,4) NOT NULL,
  payout_sol NUMERIC(12,6) NOT NULL,

  signature TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED'
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE burns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID REFERENCES distributions(id),

  amount_raw TEXT NOT NULL,
  amount_ui NUMERIC(20,6) NOT NULL,
  signature TEXT NOT NULL,
  memo TEXT NOT NULL,

  previous_supply TEXT,
  trigger_type TEXT NOT NULL,              -- 'SCHEDULED' | 'THRESHOLD' | 'MANUAL'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. Holder Snapshots

```sql
CREATE TABLE holder_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  block_slot BIGINT NOT NULL,
  total_stakers INTEGER NOT NULL,
  total_staked_raw TEXT NOT NULL,           -- bigint as string
  total_effective_raw TEXT NOT NULL,        -- With multipliers

  stakers JSONB NOT NULL,                  -- Array of {wallet, amount, multiplier, tier}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6. Agent State

```sql
CREATE TABLE agent_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',  -- Only one row

  status TEXT NOT NULL DEFAULT 'STOPPED',   -- 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR'
  started_at TIMESTAMPTZ,

  -- Module health
  sentinel_status TEXT NOT NULL DEFAULT 'STOPPED',
  strategist_status TEXT NOT NULL DEFAULT 'STOPPED',
  executor_status TEXT NOT NULL DEFAULT 'STOPPED',
  accountant_status TEXT NOT NULL DEFAULT 'STOPPED',
  gatekeeper_status TEXT NOT NULL DEFAULT 'STOPPED',

  -- Counters (for crash recovery)
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_revenue_sol NUMERIC(12,6) NOT NULL DEFAULT 0,
  total_burned_mawd TEXT NOT NULL DEFAULT '0',
  total_distributed_sol NUMERIC(12,6) NOT NULL DEFAULT 0,

  -- Strategy state
  current_rsi NUMERIC(6,4),
  current_ema_short NUMERIC(20,10),
  current_ema_long NUMERIC(20,10),
  last_signal_score NUMERIC(6,4),

  -- Risk state
  daily_pnl_sol NUMERIC(12,6) NOT NULL DEFAULT 0,
  daily_trade_count INTEGER NOT NULL DEFAULT 0,
  circuit_breaker_active BOOLEAN NOT NULL DEFAULT FALSE,
  circuit_breaker_until TIMESTAMPTZ,

  -- Checkpoint
  last_checkpoint_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkpoint_data JSONB,                   -- Full state snapshot for recovery

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize singleton
INSERT INTO agent_state (id) VALUES ('singleton') ON CONFLICT DO NOTHING;
```

### 7. Governance Actions

```sql
CREATE TABLE governance_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  action_type TEXT NOT NULL,               -- 'PARAM_CHANGE' | 'EMERGENCY_STOP' | 'DISTRIBUTION_TRIGGER' | 'STRATEGY_UPDATE'
  proposed_by TEXT NOT NULL,               -- Wallet address

  -- Params
  param_key TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,

  -- Approval (Squads V4 multisig)
  multisig_tx TEXT,                        -- Squads transaction address
  approvals INTEGER NOT NULL DEFAULT 0,
  required_approvals INTEGER NOT NULL DEFAULT 2,

  status TEXT NOT NULL DEFAULT 'PROPOSED', -- 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'REJECTED'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);
```

---

## 3. Indexes

```sql
-- Episodes: query by status, pair, time range
CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_episodes_pair_time ON episodes(pair, created_at DESC);
CREATE INDEX idx_episodes_correlation ON episodes(correlation_id);

-- Positions: active positions lookup
CREATE INDEX idx_positions_status ON positions(status) WHERE status = 'OPEN';

-- Stakes: active stakes by wallet
CREATE INDEX idx_stakes_wallet ON stakes(wallet) WHERE is_active = TRUE;

-- Distributions: by status and time
CREATE INDEX idx_distributions_status ON distributions(status);
CREATE INDEX idx_distributions_time ON distributions(created_at DESC);

-- Staker payouts: by distribution and wallet
CREATE INDEX idx_payouts_distribution ON staker_payouts(distribution_id);
CREATE INDEX idx_payouts_wallet ON staker_payouts(wallet);

-- Burns: by time
CREATE INDEX idx_burns_time ON burns(created_at DESC);

-- Governance: active proposals
CREATE INDEX idx_governance_active ON governance_actions(status)
  WHERE status IN ('PROPOSED', 'APPROVED');
```

---

## 4. Row-Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staker_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE burns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_actions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (agent backend uses service key)
CREATE POLICY "Service role full access" ON episodes
  FOR ALL USING (auth.role() = 'service_role');

-- Repeat for all tables...

-- Public read access for transparency tables
CREATE POLICY "Public read burns" ON burns
  FOR SELECT USING (true);

CREATE POLICY "Public read distributions" ON distributions
  FOR SELECT USING (true);

-- Stakes: users can only see their own
CREATE POLICY "Users see own stakes" ON stakes
  FOR SELECT USING (wallet = auth.jwt()->>'sub');

-- Staker payouts: users can only see their own
CREATE POLICY "Users see own payouts" ON staker_payouts
  FOR SELECT USING (wallet = auth.jwt()->>'sub');
```

---

## 5. Functions & Triggers

```sql
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_episodes_updated_at
  BEFORE UPDATE ON episodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stakes_updated_at
  BEFORE UPDATE ON stakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_state_updated_at
  BEFORE UPDATE ON agent_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime: enable for dashboard subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE episodes;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_state;
ALTER PUBLICATION supabase_realtime ADD TABLE burns;
ALTER PUBLICATION supabase_realtime ADD TABLE distributions;
```
