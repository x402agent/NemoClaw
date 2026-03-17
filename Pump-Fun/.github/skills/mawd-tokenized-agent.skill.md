---
applyTo: "src/mayhem-bridge.ts,agent-app/**,mcp-server/**,pumpkit/**,telegram-bot/**,swarm-bot/**"
---
# MawdBot Tokenized Agent

## Skill Description

Build and deploy MawdBot — an autonomous Solana trading agent tokenized with $MAWD (5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump). Use this skill when building tokenized AI agents, autonomous trading systems with revenue sharing, token-gated agent infrastructure, sentiment-driven trading bots, buyback-and-burn mechanics, MAWD holder staking systems, or any project connecting MawdBot's OODA loop to on-chain token economics. Also triggers on mentions of MawdBot, $MAWD, MAWD token, tokenized agent, agent tokenomics, ClawVault, mawdbot.com, lobster bot, autonomous Solana agent, or holder-gated DeFi agents. Even if the user doesn't say "tokenized agent" explicitly — if they want to build a Solana trading bot with token economics, staking, revenue distribution, or holder-gating, this is the skill.

## Token Reference

| Key | Value |
|-----|-------|
| Token | $MAWD |
| Mint | `5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump` |
| Chain | Solana mainnet-beta |
| Hub | mawdbot.com / terminal.mawdbot.com / lobster.mawdbot.com |

## Architecture Overview

```
+--------------------------------------------------------------------+
|                    MAWD TOKENIZED AGENT SYSTEM                     |
+--------------------------------------------------------------------+
|                                                                    |
|  SENTINEL --> STRATEGIST --> EXECUTOR --> ACCOUNTANT                |
|  (Observe)    (Orient)       (Act)       (Distribute)              |
|     |            |             |              |                    |
|     v            v             v              v                    |
|  +------------------------------------------------------------+   |
|  |              CLAWVAULT MEMORY (Supabase)                    |   |
|  |  Episodes | Strategies | Positions | Revenue | Holders      |   |
|  +------------------------------------------------------------+   |
|     |            |             |              |                    |
|     v            v             v              v                    |
|  +------------------------------------------------------------+   |
|  |              TOKEN ECONOMICS LAYER                          |   |
|  |  Gating | Staking | Buyback/Burn | Revenue Share            |   |
|  +------------------------------------------------------------+   |
|                                                                    |
+--------------------------------------------------------------------+
```

The system follows the OODA loop (Observe, Orient, Decide, Act) mapped to four agent roles, with a token economics layer governing access and revenue distribution.

## Phase 1: Requirements Gathering

Before generating code, interview the user. Ask 3-5 questions covering:

### Agent Configuration

- Which trading pairs? (MAWD/SOL, MAWD/USDC, broader Solana pairs, or all?)
- RSI/EMA parameters — use defaults (RSI-14, EMA-9/21) or custom?
- Sentiment sources — X/Twitter scraping, news APIs, on-chain whale tracking?
- Risk parameters — max position size, daily loss limit, max drawdown before shutdown?

### Token Economics

- Holder tier thresholds — how much MAWD to reach each tier?
- Revenue split — what % goes to buyback/burn vs holder distribution vs treasury?
- Staking mechanics — time-locked? Variable APY based on agent performance?
- NFT integration — which collection? What extra access does NFT + MAWD grant?

### Infrastructure

- RPC provider — Helius tier? Dedicated nodes?
- Database — Supabase (existing ClawVault) or fresh instance?
- Deployment target — VPS specs, region, monitoring setup?
- Existing systems to integrate with? (MawdBot Discord, dashboards, etc.)

Reflect all requirements back before proceeding.

## Phase 2: System Modules

The agent is composed of 6 core modules. Generate all of them as complete TypeScript files.

### Module 1: Sentinel (Data Ingestion)

```
sentinel/
  price-feed.ts      -- Birdeye/Jupiter WebSocket price streams
  sentiment-feed.ts  -- X API scraper + news aggregation
  chain-watcher.ts   -- Helius webhooks for MAWD on-chain events
  whale-tracker.ts   -- Large holder movement detection
  index.ts           -- Unified event bus (EventEmitter)
```

Key behaviors:

- All feeds emit typed events to a central bus
- Heartbeat monitoring — if a feed goes silent for >30s, restart it
- Deduplication layer — same signal from multiple sources counted once
- Rate limit awareness per provider

### Module 2: Strategist (Signal Processing)

```
strategist/
  rsi-ema-engine.ts   -- Core RSI/EMA crossover strategy
  sentiment-scorer.ts -- NLP sentiment to numeric signal
  confluence-engine.ts -- Multi-signal confluence detector
  risk-gate.ts        -- Pre-trade risk validation
  index.ts            -- Strategy orchestrator
```

Key behaviors:

- Confluence scoring: trade only when >=2 independent signals align
- Risk gate checks BEFORE strategy output reaches executor
- Configurable strategy weights via environment or on-chain governance
- Backtestable — same engine runs against historical data

Signal formula:

```
TRADE_SIGNAL = (RSI_WEIGHT * rsi_signal)
             + (EMA_WEIGHT * ema_signal)
             + (SENTIMENT_WEIGHT * sentiment_score)
             + (WHALE_WEIGHT * whale_signal)

IF TRADE_SIGNAL > THRESHOLD AND risk_gate.approve():
    emit TradeIntent
```

### Module 3: Executor (Trade Execution)

```
executor/
  swap-engine.ts      -- Jupiter v6 swap construction
  jito-bundler.ts     -- Jito bundle submission for MEV protection
  position-manager.ts -- Open position tracking, trailing stops
  slippage-guard.ts   -- Dynamic slippage based on liquidity
  index.ts            -- Execution coordinator
```

Key behaviors:

- ALL swaps simulated before submission
- Dynamic priority fees via Helius priority fee API
- Value transactions through Jito bundles (never naked)
- Position manager tracks entry/exit/PnL per trade
- Trailing stop-loss with configurable distance
- Circuit breaker: 3 failed TXs in a row, pause 5 minutes

### Module 4: Accountant (Revenue & Token Economics)

```
accountant/
  revenue-tracker.ts  -- PnL aggregation, fee collection
  buyback-engine.ts   -- Automated MAWD buyback from profits
  burn-engine.ts      -- Token burn execution
  distribution.ts     -- Revenue distribution to stakers
  treasury.ts         -- Treasury management and reporting
  index.ts            -- Economics coordinator
```

Revenue flow (defaults, configurable via .env):

```
Agent Profit
  +-- 40% --> Buyback & Burn (MAWD purchased from DEX, burned)
  +-- 35% --> Staker Revenue Pool (distributed pro-rata)
  +-- 15% --> Treasury (operational runway)
  +-- 10% --> Dev Fund (8BIT Labs)
```

Buyback mechanics:

- Triggered when accumulated profit exceeds MIN_BUYBACK_THRESHOLD
- Uses Jupiter for best route, Jito for MEV protection
- Burns sent to Solana burn address (closing the token account)
- All burns logged on-chain with memo instruction for transparency

### Module 5: Gatekeeper (Token-Gated Access)

```
gatekeeper/
  holder-verifier.ts  -- On-chain MAWD balance check
  staking-registry.ts -- Staked positions and lock periods
  nft-verifier.ts     -- NFT collection ownership check
  tier-engine.ts      -- Access tier computation
  api-middleware.ts   -- Express/Fastify auth middleware
  index.ts            -- Unified access control
```

Tier system:

| Tier | Requirement | Access |
|------|-------------|--------|
| Observer | 0 MAWD | Public dashboard, delayed data |
| Holder | 10K MAWD | Real-time signals, basic alerts |
| Staker | 50K MAWD staked | Revenue share, priority signals |
| Lobster | 100K + NFT | Full agent control, custom strat |
| ClawdGut | Multisig signer | Governance, parameter changes |

Thresholds configurable via environment variables.

Verification flow:

1. User connects wallet (Phantom/Solflare via @solana/wallet-adapter)
2. Gatekeeper reads MAWD token account balance on-chain
3. Gatekeeper checks staking registry (Supabase or on-chain PDA)
4. Gatekeeper checks NFT ownership if applicable
5. Tier computed, JWT issued with tier claim, middleware enforces

### Module 6: ClawVault Memory (Persistence)

```
clawvault/
  episode-store.ts    -- Trading episode logging
  strategy-memory.ts  -- Strategy performance history
  holder-registry.ts  -- Holder snapshots and tier history
  revenue-ledger.ts   -- Complete revenue/distribution history
  state-machine.ts    -- Agent state persistence & recovery
  index.ts            -- Supabase client + migration runner
```

Key behaviors:

- Epistemological memory — agent learns from past trades
- Full audit trail for all revenue distributions
- State checkpointing every 60s — crash recovery in <5s
- Holder snapshot before every distribution cycle

## Phase 3: Infrastructure Scaffolding

Generate the following project structure:

```
mawd-agent/
  src/
    sentinel/        -- Module 1
    strategist/      -- Module 2
    executor/        -- Module 3
    accountant/      -- Module 4
    gatekeeper/      -- Module 5
    clawvault/       -- Module 6
    shared/
      types.ts       -- Global type definitions
      config.ts      -- Environment config loader
      logger.ts      -- Structured logging (pino)
      rpc.ts         -- RPC client with retry wrapper
      errors.ts      -- Typed error hierarchy
      circuit-breaker.ts
    api/
      server.ts      -- Fastify API server
      routes/        -- REST endpoints per module
      ws/            -- WebSocket feeds for dashboard
    agent.ts         -- Main OODA loop orchestrator
    index.ts         -- Entry point
  supabase/
    migrations/      -- Database schema
  dashboard/         -- Cyberpunk terminal UI (optional)
  .env.example
  tsconfig.json
  package.json
  Dockerfile
```

## Environment Configuration

```bash
# === RPC & Chain ===
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=your_helius_key
HELIUS_WEBHOOK_SECRET=your_webhook_secret

# === Token ===
MAWD_MINT=5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump
AGENT_WALLET_PRIVATE_KEY=base58_encoded

# === Data Feeds ===
BIRDEYE_API_KEY=your_birdeye_key
TWITTER_BEARER_TOKEN=your_twitter_bearer

# === Execution ===
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_TIP_LAMPORTS=10000
MAX_SLIPPAGE_BPS=300

# === Strategy ===
RSI_PERIOD=14
RSI_OVERSOLD=30
RSI_OVERBOUGHT=70
EMA_SHORT=9
EMA_LONG=21
CONFLUENCE_THRESHOLD=0.65
MAX_POSITION_SOL=1.0
DAILY_LOSS_LIMIT_SOL=3.0

# === Token Economics ===
BUYBACK_BURN_PCT=40
STAKER_REVENUE_PCT=35
TREASURY_PCT=15
DEV_FUND_PCT=10
MIN_BUYBACK_THRESHOLD_SOL=0.5

# === Gating Tiers (token amounts, raw with decimals) ===
TIER_HOLDER_MIN=10000000000
TIER_STAKER_MIN=50000000000
TIER_LOBSTER_MIN=100000000000
NFT_COLLECTION_ADDRESS=your_nft_collection

# === Database ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# === Server ===
API_PORT=3000
WS_PORT=3001
NODE_ENV=production
```

## Phase 4: Code Generation Constraints

Apply these to ALL generated code:

- TypeScript strict mode, no `any` types
- All RPC calls through shared/rpc.ts retry wrapper (3 retries, exponential backoff)
- All transactions simulated before sending
- Dynamic priority fees via Helius
- Jito bundles for all value transactions
- Explicit timeouts (5s default, configurable)
- Graceful shutdown (SIGINT/SIGTERM) with position cleanup
- Structured logging via pino with correlation IDs
- Circuit breakers for cascading failures
- Full error taxonomy — no generic throws
- State machines for all async flows (xstate or manual)
- Pure functions where possible
- Event-driven architecture — modules communicate via typed EventEmitter
- Complete files — no placeholders, no truncation, no "// TODO"

## Phase 5: Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY supabase/ ./supabase/
ENV NODE_ENV=production
EXPOSE 3000 3001
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

### Health Checks

The `/health` endpoint returns:

```json
{
  "status": "operational",
  "uptime": 3600,
  "modules": {
    "sentinel": { "status": "ok", "lastEvent": "2025-01-01T00:00:00Z" },
    "strategist": { "status": "ok", "signalsProcessed": 142 },
    "executor": { "status": "ok", "openPositions": 2 },
    "accountant": { "status": "ok", "totalRevenue": "4.2 SOL" },
    "gatekeeper": { "status": "ok", "activeSessions": 18 }
  },
  "mawd": {
    "mint": "5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump",
    "agentBalance": "150000 MAWD",
    "totalBurned": "25000 MAWD",
    "totalDistributed": "3.1 SOL"
  }
}
```

## Quick Reference

```
NEVER SHIP WITHOUT:
  - Retry logic on all RPC calls
  - Transaction simulation before send
  - Dynamic priority fees via Helius
  - Jito bundles for value transactions
  - Explicit timeouts on network ops
  - Graceful shutdown / position cleanup
  - On-chain MAWD balance verification (not cached)
  - Revenue distribution audit trail
  - Burn transactions with memo for transparency
  - Holder snapshot before every distribution
  - Circuit breakers on all external dependencies
  - Rate limiting on gatekeeper verification
```

## Reference Files

- `references/sentinel-spec.md` — Event schemas, feed configurations, reconnection logic
- `references/tokenomics-spec.md` — Revenue formulas, distribution algorithms, burn mechanics
- `references/gating-spec.md` — Tier verification, staking mechanics, NFT check flow
- `references/supabase-schema.md` — Complete database schema and migrations
