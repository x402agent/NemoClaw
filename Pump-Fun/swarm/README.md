# PumpFun Swarm — Bot Orchestration & Dashboard

> Unified control center for all PumpFun bots — real-time monitoring, cross-bot event routing, admin dashboard, and fleet management.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    PumpFun Swarm Orchestrator                  │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Event Bus   │  │ Bot Manager │  │   REST API + WS      │ │
│  │  (pub/sub)   │◄─│  (lifecycle)│  │   (dashboard)        │ │
│  └──────┬───────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │                 │                     │             │
│    ┌────┴────────────────┴─────────────────────┘             │
│    │                                                          │
│    ▼                                                          │
│  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐ │
│  │telegram  │ │outsiders     │ │channel    │ │websocket   │ │
│  │  -bot    │ │  -bot        │ │  -bot     │ │  -server   │ │
│  │(fees,    │ │(calls,       │ │(feed,     │ │(relay,     │ │
│  │ alerts)  │ │ leaderboards)│ │ broadcast)│ │ launches)  │ │
│  └──────────┘ └──────────────┘ └───────────┘ └────────────┘ │
└───────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    ┌──────────┐                      ┌──────────────┐
    │ Telegram │                      │ Browser      │
    │ Users    │                      │ Dashboard    │
    └──────────┘                      └──────────────┘
```

## Features

### Bot Fleet Management
- **Start / Stop / Restart** any bot from the dashboard or API
- **Auto-start** configured bots on swarm launch
- **Build** bots (TypeScript compilation) from the dashboard
- **Health monitoring** with configurable intervals
- **Log aggregation** — view any bot's stdout/stderr in real-time

### Cross-Bot Event Bus
- In-process pub/sub with typed events
- Route whale alerts, token launches, fee claims across bots
- Sliding-window events/minute metrics
- Circular buffer (configurable, default 5000 events)
- Upgradeable to Redis pub/sub for multi-instance deployments

### Admin Dashboard
- Real-time WebSocket updates (no polling)
- Bot fleet overview with status, uptime, restarts, event counts
- Live event feed with type filtering
- Aggregate metrics: launches, trades, fees, calls, errors
- Log viewer modal for each bot
- Dark theme with glassmorphism design
- Fully responsive (desktop, tablet, mobile)

### REST API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Swarm health check |
| GET | `/api/v1/bots` | List all bots + health |
| GET | `/api/v1/bots/:id` | Single bot details |
| POST | `/api/v1/bots/:id/start` | Start a bot |
| POST | `/api/v1/bots/:id/stop` | Stop a bot |
| POST | `/api/v1/bots/:id/restart` | Restart a bot |
| POST | `/api/v1/bots/:id/build` | Build a bot |
| GET | `/api/v1/bots/:id/logs` | Bot log buffer |
| GET | `/api/v1/events` | Recent events (filterable) |
| GET | `/api/v1/metrics` | Aggregate metrics |

### WebSocket (`/ws`)
Connects to the event bus. Receives:
- `init` — Full dashboard state on connect
- `SwarmEvent` — Real-time events as they happen

Sends:
- `{ action: "start", botId: "..." }` — Start a bot
- `{ action: "stop", botId: "..." }` — Stop a bot
- `{ action: "restart", botId: "..." }` — Restart a bot
- `{ action: "status" }` — Request full state refresh

## Quick Start

```bash
cd swarm
npm install
npm run dev
```

Dashboard: http://localhost:4000

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `SWARM_PORT` | `4000` | HTTP + WebSocket port |
| `SWARM_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `SWARM_HEALTH_INTERVAL` | `10000` | Health check interval (ms) |
| `SWARM_MAX_EVENTS` | `5000` | Max events in circular buffer |
| `SWARM_API_KEY` | — | API key for REST endpoints (optional) |
| `SWARM_AUTO_START` | — | Comma-separated bot IDs to auto-start |
| `SWARM_CORS_ORIGINS` | `*` | CORS allowed origins |

## Bot Fleet

| Bot ID | Name | What It Does |
|--------|------|-------------|
| `telegram-bot` | Fee Monitor | Creator fees, CTO alerts, whale trades, REST API |
| `outsiders-bot` | Call Tracker | Call tracking, leaderboards, PNL cards, hardcore mode |
| `channel-bot` | Channel Feed | Read-only feed: launches, graduations, whales |
| `websocket-server` | WS Relay | Token launch WebSocket broadcasts |

Each bot must be **built** before it can be started. Use the dashboard's Build button or:

```bash
# Build all bots
cd ../telegram-bot && npm run build
cd ../outsiders-bot && npm run build
cd ../channel-bot && npm run build
cd ../websocket-server && npm run build
```

## Event Types

| Event | Source | Description |
|-------|--------|-------------|
| `bot:started` | Any bot | Bot process spawned |
| `bot:stopped` | Any bot | Bot process exited |
| `bot:error` | Any bot | Fatal or recoverable error |
| `bot:health` | Orchestrator | Periodic health snapshot |
| `bot:log` | Any bot | Stdout/stderr line |
| `token:launch` | websocket-server | New token created |
| `token:graduation` | channel-bot | Token graduated to AMM |
| `trade:buy` | channel-bot | Buy trade detected |
| `trade:sell` | channel-bot | Sell trade detected |
| `trade:whale` | channel-bot | Whale trade (≥5 SOL) |
| `fee:claim` | telegram-bot | Creator fee claimed |
| `fee:distribution` | telegram-bot | Fee distribution event |
| `call:new` | outsiders-bot | New call registered |
| `call:result` | outsiders-bot | Call outcome (ATH update) |
| `alert:cto` | telegram-bot | CTO (Creator Took Over) |
| `alert:whale` | Multiple | Whale movement detected |
| `system:metric` | Orchestrator | Internal metrics snapshot |

## Project Structure

```
swarm/
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript config
├── README.md             # This file
└── src/
    ├── index.ts          # Entry point — initializes event bus, bot manager, API
    ├── config.ts         # Environment config loader (SwarmConfig)
    ├── logger.ts         # Leveled logger with timestamps
    ├── types.ts          # All TypeScript types (BotId, SwarmEvent, DashboardState, etc.)
    ├── event-bus.ts      # In-process pub/sub with circular buffer
    ├── bot-manager.ts    # Bot lifecycle — spawn, stop, restart, health check
    ├── api.ts            # REST API + WebSocket server + embedded dashboard
    └── dashboard.ts      # HTML/CSS/JS SPA renderer (glassmorphism theme)
```

## Type System

The swarm uses a strongly-typed event system. Key types:

```typescript
// Bot identity — only known bots are allowed
type BotId = 'telegram-bot' | 'outsiders-bot' | 'channel-bot' | 'websocket-server' | 'swarm-bot';

// Event envelope — every event has a type, source, and timestamp
interface SwarmEvent<T = unknown> {
  id: string;
  type: SwarmEventType;
  source: BotId | 'orchestrator';
  timestamp: string;
  data: T;
}

// Dashboard state — full snapshot sent on WS connect
interface DashboardState {
  bots: Record<BotId, BotHealth>;
  events: SwarmEvent[];
  metrics: SwarmMetrics;
  uptime: number;
  startedAt: string;
}
```

See `src/types.ts` for the complete type definitions including `BotHealth`, `BotMetrics`, `SwarmMetrics`, trade/fee/call event payloads, and API response types.

## Event Bus Details

The cross-bot event bus is the heart of the swarm:

```typescript
// Subscribe to specific event types
eventBus.on('token:launch', (event) => {
  console.log(`New token: ${event.data.name} (${event.data.symbol})`);
});

// Subscribe to all events
eventBus.on('*', (event) => {
  metrics.totalEvents++;
});

// Emit from any bot
eventBus.emit({
  type: 'trade:whale',
  source: 'channel-bot',
  data: { mint, trader, solAmount: 50, isWhale: true },
});
```

**Buffer management:**
- Events stored in a fixed-size circular buffer (default: 5,000)
- Oldest events are evicted when buffer is full
- `eventsPerMinute` calculated via sliding window
- Buffer size configurable via `SWARM_MAX_EVENTS`

**Upgrade path:** The event bus interface is designed to swap in Redis pub/sub for multi-instance deployments without changing event consumers.

## Deployment

### Docker

```bash
# Build from repository root
docker build -f swarm/Dockerfile -t pump-swarm .

# Run
docker run -d \
  --name pump-swarm \
  -p 4000:4000 \
  --env-file swarm/.env \
  pump-swarm
```

### Railway

1. Connect your GitHub repository
2. Set root directory to `swarm/`
3. Add environment variables from `.env.example`
4. Deploy — Railway auto-detects the `start` script

### Production Checklist

- [ ] Set `SWARM_API_KEY` to prevent unauthorized bot control
- [ ] Set `SWARM_CORS_ORIGINS` to your dashboard domain (not `*`)
- [ ] Set `SWARM_LOG_LEVEL` to `warn` for reduced log volume
- [ ] Build all bots before starting the swarm
- [ ] Use `SWARM_AUTO_START` for bots that should launch on startup
- [ ] Mount persistent storage if you need event history across restarts
- [ ] Place behind a reverse proxy (nginx/Caddy) with TLS for public access

## Monitoring

### Health Check

```bash
curl http://localhost:4000/health
# { "status": "ok", "uptime": 3600, "activeBots": 3, "totalEvents": 12345 }
```

### Metrics

```bash
curl http://localhost:4000/api/v1/metrics
# {
#   "totalEvents": 12345,
#   "eventsPerMinute": 42,
#   "totalTokenLaunches": 890,
#   "totalTrades": 5432,
#   "totalFeeClaims": 234,
#   "totalCalls": 567,
#   "totalErrors": 3,
#   "activeBots": 3,
#   "peakMemory": 134217728
# }
```

### Bot Logs

```bash
# View last 100 log lines for a specific bot
curl http://localhost:4000/api/v1/bots/telegram-bot/logs
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `dotenv` | Environment variable loading |
| `ws` | WebSocket server for dashboard + bot control |

Dev-only: `@types/node`, `@types/ws`, `tsx`, `typescript`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with tsx hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run typecheck` | Type-check without emitting |

## License

MIT — Part of [pump-fun-sdk](https://github.com/nirholas/pump-fun-sdk)
