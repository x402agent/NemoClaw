# PumpFun Swarm Bot — Multi-Strategy Trading Bot Manager

> Multi-strategy Solana trading bot with real-time web dashboard, SQLite persistence, and configurable risk management.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                       Swarm Bot Manager                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐│
│  │  Bot Manager  │  │  Token Feed  │  │  REST API + WS      ││
│  │  (lifecycle)  │  │  (new mints) │  │  (dashboard)        ││
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘│
│         │                 │                      │           │
│         ▼                 ▼                      ▼           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐│
│  │  Strategies   │  │  Price Feed  │  │  SQLite Database    ││
│  │  (pluggable)  │  │  (real-time) │  │  (positions/trades) ││
│  └──────────────┘  └──────────────┘  └─────────────────────┘│
└───────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ Solana   │                      │ Browser      │
    │ Mainnet  │                      │ Dashboard    │
    └──────────┘                      └──────────────┘
```

## Features

- **Multi-strategy bot engine** — Run multiple bots with independent strategies, each with isolated position tracking
- **Token feed** — Detect new PumpFun token launches in real-time
- **Price feed** — Continuous price monitoring for open positions
- **SQLite persistence** — All positions, trades, and bot state persisted to disk
- **Risk management** — Per-bot and global SOL position limits, configurable slippage
- **Web dashboard** — Real-time admin interface via REST API + WebSocket
- **Docker-ready** — Multi-stage Dockerfile with tini init and persistent volumes

## Quick Start

```bash
# Install dependencies
cd swarm-bot
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your RPC URL and settings

# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

Dashboard: http://localhost:3100

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC HTTP endpoint |
| `SOLANA_WS_URL` | Auto-derived from RPC URL | Solana WebSocket endpoint |
| `PORT` | `3100` | Dashboard HTTP + WS port |
| `DB_PATH` | `./data/swarm.db` | SQLite database file path |
| `DEFAULT_SLIPPAGE_BPS` | `500` | Default slippage tolerance (500 = 5%) |
| `MAX_POSITION_SOL_PER_BOT` | `5` | Max SOL a single bot can hold |
| `MAX_TOTAL_POSITION_SOL` | `50` | Global max SOL across all bots |
| `POLL_INTERVAL_MS` | `5000` | Price polling interval (ms) |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## Project Structure

```
swarm-bot/
├── Dockerfile           # Multi-stage Docker build
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript config
└── src/
    ├── index.ts         # Entry point — initializes all components
    ├── config.ts        # Environment config loader
    ├── logger.ts        # Leveled logger
    ├── api/
    │   └── server.ts    # REST API + WebSocket server
    ├── dashboard/
    │   └── ...          # Embedded web dashboard UI
    ├── engine/
    │   └── bot-manager.ts  # Bot lifecycle management
    ├── market/
    │   ├── token-feed.ts   # New token detection
    │   └── price-feed.ts   # Price monitoring
    ├── store/
    │   └── db.ts        # SQLite storage layer
    └── strategies/
        └── ...          # Pluggable trading strategies
```

## Strategies

### Sniper

Buys new token launches instantly, sells at profit target or stop-loss.

| Parameter | Description |
|-----------|-------------|
| `maxAgeSec` | Maximum age of launch to consider |
| `maxMarketCapSol` | Maximum market cap (SOL) to enter |
| `takeProfitMultiple` | Sell when price reaches this multiple of entry |
| `stopLossPercent` | Sell when price drops by this percentage |

### Momentum

Buys tokens with rising market cap velocity, rides the wave.

| Parameter | Description |
|-----------|-------------|
| `minMcapSol` / `maxMcapSol` | Market cap range to consider |
| `entryVelocityPctPerSec` | Required mcap growth rate to enter |
| `exitVelocityPctPerSec` | Mcap decline rate triggering exit |
| `takeProfitPct` / `stopLossPct` | Profit target and stop loss |
| `windowSec` | Lookback window for velocity calculation |

### Graduation

Accumulates tokens approaching graduation, sells into AMM liquidity.

| Parameter | Description |
|-----------|-------------|
| `minProgressBps` | Minimum graduation progress to monitor |
| `entryProgressBps` | Progress threshold to start buying |
| `maxEntrySol` | Maximum SOL to spend on entry |
| `entryTranches` | Number of buy tranches |
| `holdAfterGradMs` | Hold duration after graduation (ms) |
| `takeProfitPct` / `stopLossPct` | Profit target and stop loss |

### Market Maker

Grid-style buy/sell around the bonding curve midpoint.

| Parameter | Description |
|-----------|-------------|
| `targetPositionSol` | Target position size in SOL |
| `gridSpreadPct` | Spread between grid levels |
| `rebalanceThresholdPct` | Deviation threshold to rebalance |
| `minMcapSol` / `maxMcapSol` | Market cap operating range |
| `maxInventoryDeviationPct` | Maximum inventory imbalance |

## API Reference

All endpoints are prefixed with `/api/`. The server also serves the dashboard at `/` and WebSocket at `/ws`.

### Bot Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bots` | List all bots |
| `POST` | `/api/bots` | Create a new bot |
| `GET` | `/api/bots/:id` | Get bot details + open positions |
| `DELETE` | `/api/bots/:id` | Delete a bot |

### Bot Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bots/:id/start` | Start a bot |
| `POST` | `/api/bots/:id/pause` | Pause a running bot |
| `POST` | `/api/bots/:id/resume` | Resume a paused bot |
| `POST` | `/api/bots/:id/stop` | Stop a bot |
| `POST` | `/api/bots/:id/emergency-exit` | Sell all positions immediately |

### Mint Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bots/:id/mints` | Add a mint to track |
| `DELETE` | `/api/bots/:id/mints/:mint` | Remove a tracked mint |

### Swarm Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/swarm/start-all` | Start all bots |
| `POST` | `/api/swarm/stop-all` | Stop all bots |
| `POST` | `/api/swarm/emergency-shutdown` | Emergency exit all bots |

### Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Global swarm statistics |
| `GET` | `/api/strategies` | List available strategies with params |
| `GET` | `/api/health` | Health check |

### Create Bot Example

```bash
curl -X POST http://localhost:3100/api/bots \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "alpha-sniper",
    "strategy": "sniper",
    "maxBuySol": 1,
    "maxPositions": 5,
    "slippageBps": 500,
    "params": {
      "maxAgeSec": 30,
      "maxMarketCapSol": 100,
      "takeProfitMultiple": 3,
      "stopLossPercent": 30
    }
  }'
```

### WebSocket

Connect to `ws://localhost:3100/ws` for real-time streaming of bot status changes, trade executions, token launches, price updates, and graduation events.

## Dashboard

The embedded web dashboard is served at `http://localhost:3100` and provides:

- **Bot Fleet Overview** — status, strategy, wallet, and position count per bot
- **Real-Time Events** — token launches, trades, and graduations
- **Position Tracking** — open positions with entry price, current price, and unrealized PnL
- **Strategy Controls** — create, start, pause, resume, and stop bots
- **Global Stats** — total SOL deployed, active bots, and tokens tracked

## Docker

```bash
# Build
docker build -f swarm-bot/Dockerfile -t pump-swarm-bot .

# Run with persistent data
docker run -d \
  --name swarm-bot \
  -p 3100:3100 \
  -v swarm-data:/app/data \
  -e SOLANA_RPC_URL=https://your-rpc.com \
  -e MAX_POSITION_SOL_PER_BOT=2 \
  -e MAX_TOTAL_POSITION_SOL=20 \
  pump-swarm-bot
```

The Docker image uses:
- **node:22-alpine** — Minimal Node.js runtime
- **tini** — Proper PID 1 init for signal handling
- **Multi-stage build** — Build artifacts only in production image
- **Persistent volume** at `/app/data` for SQLite database

## Development

### Adding a Strategy

1. Create `src/strategies/my-strategy.ts` implementing the `Strategy` interface:

```typescript
import type { Strategy, TradeSignal, TokenSnapshot, StrategyConfig } from './types.js';

export class MyStrategy implements Strategy {
  name = 'my-strategy';

  init(config: StrategyConfig): void {
    // Initialize with user params
  }

  evaluate(snapshot: TokenSnapshot): TradeSignal {
    return { action: 'hold', mint: snapshot.mint, reason: 'waiting', urgency: 0 };
  }
}
```

2. Register in `src/strategies/index.ts`:

```typescript
export const STRATEGY_REGISTRY: Record<string, () => Strategy> = {
  // ...existing
  'my-strategy': () => new MyStrategy(),
};
```

3. The strategy is immediately available via the API and dashboard.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nirholas/pump-sdk` | Pump protocol instruction builders |
| `@solana/web3.js` | Solana RPC client |
| `@solana/spl-token` | SPL token operations |
| `better-sqlite3` | SQLite database |
| `bn.js` | Big number math for token amounts |
| `ws` | WebSocket server for dashboard |
| `dotenv` | Environment variable loading |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with tsx hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type-check without emitting |

## Security Notes

- Never commit `.env` files or private keys
- Use dedicated wallets with limited SOL for bot operations
- Set `MAX_POSITION_SOL_PER_BOT` and `MAX_TOTAL_POSITION_SOL` conservatively
- Monitor the dashboard for unexpected position sizes
- SQLite database contains trade history — protect file permissions

## Related Components

| Component | Directory | Description |
|-----------|-----------|-------------|
| Swarm Orchestrator | `swarm/` | Higher-level fleet orchestration + event bus |
| Telegram Bot | `telegram-bot/` | PumpFun monitoring Telegram bot |
| Dashboard | `dashboard/` | Standalone multi-service dashboard |
| Pump SDK | `src/` | Core SDK for PumpFun instructions |

## License

MIT — Part of [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk)
