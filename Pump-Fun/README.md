<p align="center"> 
  <h1 align="center">🚀 Pump SDK — The Complete PumpFun Ecosystem</h1>
  <p align="center">
    TypeScript SDK + Trading Bots + Telegram Bots + Real-time Monitors + Dashboard<br/>
    <strong>Everything you need to build on PumpFun, open-sourced.</strong>
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nirholas/pump-sdk"><img src="https://img.shields.io/npm/v/@nirholas/pump-sdk.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="#license"><img src="https://img.shields.io/npm/l/@nirholas/pump-sdk.svg?style=flat-square" alt="license" /></a>
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Solana-1.98+-purple?style=flat-square&logo=solana" alt="Solana" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Bots-5+-orange?style=flat-square&logo=telegram" alt="Telegram Bots" />
</p>

---

## 🏗️ What's Inside

This is a **monorepo** containing the full PumpFun developer toolkit — from the core SDK to production-ready Telegram bots, a trading bot swarm, on-chain monitors, and a real-time dashboard. Everything is open-source.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PUMP SDK ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📦 SDK                              🤖 Bots                           │
│  ├── @nirholas/pump-sdk (npm)        ├── telegram-bot (claims + DMs)   │
│  ├── Offline instruction builders    ├── channel-bot (broadcast feed)   │
│  ├── Bonding curve math              ├── outsiders-bot (call tracker)   │
│  ├── Fee sharing + social fees       ├── claim-bot (fee monitoring)     │
│  └── Token incentives                └── swarm-bot (multi-strategy)     │
│                                                                         │
│  📡 PumpKit Framework               🖥️ Dashboard + Infra               │
│  ├── @pumpkit/core (monitors)        ├── dashboard (admin UI)           │
│  ├── @pumpkit/monitor (all-in-one)   ├── websocket-server (real-time)   │
│  ├── @pumpkit/tracker (leaderboard)  ├── mcp-server (AI agents)         │
│  └── @pumpkit/channel (broadcasts)   └── x402 (payment protocol)        │
│                                                                         │
│  📚 Documentation                                                       │
│  ├── 26 tutorials (step-by-step)                                        │
│  ├── 9 protocol specs + IDLs                                            │
│  ├── Full API reference                                                  │
│  └── Architecture guides                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### Install the SDK

```bash
npm install @nirholas/pump-sdk @solana/web3.js bn.js
```

### Your First Trade

```typescript
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { OnlinePumpSdk, getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";
import BN from "bn.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const sdk = new OnlinePumpSdk(connection);

// Fetch token state
const mint = new PublicKey("YourTokenMint...");
const user = wallet.publicKey;

const [buyState, global, feeConfig] = await Promise.all([
  sdk.fetchBuyState(mint, user),
  sdk.fetchGlobal(),
  sdk.fetchFeeConfig(),
]);

// Calculate and build buy instructions for 0.1 SOL
const solAmount = new BN(100_000_000);
const tokenAmount = getBuyTokenAmountFromSolAmount({
  global, feeConfig,
  mintSupply: buyState.bondingCurve.tokenTotalSupply,
  bondingCurve: buyState.bondingCurve,
  amount: solAmount,
});

const instructions = await sdk.buyInstructions({
  ...buyState, mint, user,
  amount: tokenAmount,
  solAmount,
  slippage: 0.05,
});
// → TransactionInstruction[] — compose and send with your wallet
```

---

## 📦 Packages

### Core SDK

| Package | Description | Install |
|---------|-------------|---------|
| **[@nirholas/pump-sdk](src/)** | TypeScript SDK — offline instruction builders, bonding curve math, fee sharing | `npm i @nirholas/pump-sdk` |

### Telegram Bots

| Bot | Description | Quick Start |
|-----|-------------|-------------|
| **[telegram-bot](telegram-bot/)** | Interactive DM bot — `/watch`, `/price`, `/quote`, whale alerts, claim monitoring | `cd telegram-bot && cp .env.example .env && npm i && npm run dev` |
| **[channel-bot](channel-bot/)** | Read-only broadcast — launches, graduations, claims, whales → Telegram channel | `cd channel-bot && cp .env.example .env && npm i && npm run dev` |
| **[outsiders-bot](outsiders-bot/)** | Call tracking — leaderboards, PNL cards, win rate, rankings, hardcore mode | `cd outsiders-bot && cp .env.example .env && npm i && npm run dev` |
| **[claim-bot](claim-bot/)** | Fee claim monitor — tracks creator fee claims by wallet or X handle | `cd claim-bot && cp .env.example .env && npm i && npm run dev` |

### Trading Engine

| Package | Description | Quick Start |
|---------|-------------|-------------|
| **[swarm-bot](swarm-bot/)** | Multi-strategy trading bot swarm — sniper, momentum, graduation, market-maker | `cd swarm-bot && cp .env.example .env && npm i && npm run build && npm start` |
| **[swarm](swarm/)** | Lightweight swarm coordinator | `cd swarm && npm i && npm run dev` |

### PumpKit Framework

| Package | Description |
|---------|-------------|
| **[@pumpkit/core](pumpkit/packages/core/)** | Shared framework — monitors, formatters, health checks, storage, config |
| **[@pumpkit/monitor](pumpkit/packages/monitor/)** | All-in-one monitoring bot (DM + channel + REST API + SSE + webhooks) |
| **[@pumpkit/tracker](pumpkit/packages/tracker/)** | Group call-tracking with leaderboards, PNL cards, rankings |
| **[@pumpkit/channel](pumpkit/packages/channel/)** | Channel broadcast feed bot |
| **[@pumpkit/claim](pumpkit/packages/claim/)** | Fee claim monitor bot |

### Infrastructure

| Package | Description |
|---------|-------------|
| **[dashboard](dashboard/)** | Admin dashboard — bot status, controls, Solana RPC status |
| **[websocket-server](websocket-server/)** | Real-time WebSocket server for live data feeds |
| **[mcp-server](mcp-server/)** | Model Context Protocol server for AI agent integration |
| **[x402](x402/)** | x402 payment protocol integration (USDC, multi-chain) |

---

## 🤖 Bot Features

### Telegram Monitor Bot
- Real-time fee claim detection with enriched notifications
- Token launch monitoring with GitHub/social metadata
- Graduation alerts (bonding curve → AMM migration)
- Whale trade alerts (configurable SOL threshold)
- Creator Takeover (CTO) detection
- REST API + SSE streaming + webhook dispatch
- DM commands: `/watch`, `/unwatch`, `/list`, `/status`, `/price`, `/quote`

### Channel Broadcast Bot
- Auto-posts to Telegram channels: launches, grads, claims, whales
- Configurable feed toggles per event type
- Affiliate link injection (Axiom, GMGN, Padre)
- GitHub + AI enrichment for claim cards

### Outsiders Call Tracker
- Paste any CA → bot tracks performance automatically
- Points system: -1 (rug) to +5 (30x+)
- Win rate tracking and rank tiers: Amateur → Oracle
- Canvas-rendered PNL cards (shareable images)
- Leaderboards: 24h / 7d / 30d / all-time
- Hardcore mode: auto-kick below min win rate
- Multi-chain: Solana, Ethereum, Base, BSC

### Swarm Trading Bot
- **4 built-in strategies**: Sniper, Momentum, Graduation, Market-Maker
- Multi-bot orchestration with independent wallets
- Position tracking with real-time P&L
- PumpKit bridge: WebSocket-first on-chain event detection
- REST API + WebSocket dashboard
- SQLite persistence for positions, trades, P&L snapshots

---

## 📡 PumpKit Architecture

PumpKit provides production-tested building blocks for PumpFun bots:

```
┌───────────────────────────────────────────────────┐
│                  @pumpkit/core                    │
│                                                   │
│  bot/       grammy scaffolding, command router    │
│  monitor/   WebSocket + HTTP event monitors       │
│  solana/    RPC client, program IDs, decoders     │
│  formatter/ HTML message builder (Telegram)       │
│  storage/   File-based + SQLite adapters          │
│  config/    Typed env loader with validation      │
│  health/    HTTP health check server              │
│  logger/    Leveled console logger                │
└──────────┬────────────────────────┬───────────────┘
           │                        │
    ┌──────▼───────┐          ┌──────▼───────┐
    │  @pumpkit/   │          │  @pumpkit/   │
    │   monitor    │          │   tracker    │
    │              │          │              │
    │ DM commands  │          │ Group calls  │
    │ Channel feed │          │ Leaderboards │
    │ REST API     │          │ PNL cards    │
    │ Webhooks     │          │ Rankings     │
    │ SSE stream   │          │ Multi-chain  │
    └──────────────┘          └──────────────┘
```

### On-Chain Monitors

| Monitor | Event | Detection Method |
|---------|-------|-----------------|
| `LaunchMonitor` | New tokens | `Instruction: CreateV2` in program logs |
| `GraduationMonitor` | Curve completion | `CompleteEvent` discriminator |
| `WhaleMonitor` | Large trades | `TradeEvent` + SOL threshold |
| `ClaimMonitor` | Fee claims | Claim instruction discriminators |
| `CTOMonitor` | Creator Takeover | Creator change instructions |
| `FeeDistMonitor` | Fee distributions | Distribute fees events |

All monitors use **WebSocket-first** with **HTTP polling fallback**, heartbeat monitoring, and automatic reconnection.

---

## 📚 Documentation

### Tutorials (26 hands-on guides)

| # | Tutorial | Topic |
|---|----------|-------|
| 01 | [Create Token](tutorials/01-create-token.md) | Launch on bonding curve |
| 02 | [Buy Tokens](tutorials/02-buy-tokens.md) | Purchase via bonding curve |
| 03 | [Sell Tokens](tutorials/03-sell-tokens.md) | Sell back for SOL |
| 04 | [Create & Buy](tutorials/04-create-and-buy.md) | Atomic create + first buy |
| 05 | [Bonding Curve Math](tutorials/05-bonding-curve-math.md) | Price formulas |
| 06 | [Migration](tutorials/06-migration.md) | Graduation to AMM |
| 07 | [Fee Sharing](tutorials/07-fee-sharing.md) | Shareholder setup |
| 08 | [Token Incentives](tutorials/08-token-incentives.md) | Volume rewards |
| 09 | [Fee System](tutorials/09-fee-system.md) | Tiered fee calculations |
| 10 | [PDAs](tutorials/10-working-with-pdas.md) | Program Derived Addresses |
| 11 | [Trading Bot](tutorials/11-trading-bot.md) | Condition-based trading |
| 15 | [Decoding Accounts](tutorials/15-decoding-accounts.md) | Parse on-chain data |
| 16 | [Monitoring Claims](tutorials/16-monitoring-claims.md) | Fee claim architecture |
| 18 | [Telegram Bot](tutorials/18-telegram-bot.md) | Interactive DM bot |
| 20 | [MCP Server](tutorials/20-mcp-server-ai-agents.md) | AI agent integration |
| 21 | [WebSocket Feeds](tutorials/21-websocket-realtime-feeds.md) | Real-time data |
| 22 | [Channel Bot](tutorials/22-channel-bot-setup.md) | Broadcast feed |
| 29 | [Event Parsing](tutorials/29-event-parsing-analytics.md) | On-chain events |
| 33 | [Error Handling](tutorials/33-error-handling-patterns.md) | Validation patterns |
| 37 | [Security Auditing](tutorials/37-security-auditing-verification.md) | Security checklist |
| 39 | [AI Enrichment](tutorials/39-channel-bot-ai-enrichment.md) | AI-powered cards |
| 40 | [First Claim Bot](tutorials/40-your-first-claim-bot.md) | Build from scratch |
| 41 | [Custom Cards](tutorials/41-customizing-claim-cards.md) | HTML formatting |
| 42 | [Channel Feed](tutorials/42-channel-feed-bot.md) | Channel broadcasting |
| 43 | [Understanding Events](tutorials/43-understanding-pumpfun-events.md) | Event types |

### Protocol Reference

- [Protocol Overview](docs/pump-protocol/) — All 9 official specs + IDLs
- [Bonding Curve Math](docs/guides/bonding-curve-math.md)
- [Fee Tiers](docs/guides/fee-tiers.md)
- [Fee Sharing](docs/guides/fee-sharing.md)
- [Mayhem Mode](docs/guides/mayhem-mode.md)
- [Token Incentives](docs/guides/token-incentives.md)
- [Events Reference](docs/guides/events-reference.md) — 20+ event types
- [End-to-End Workflow](docs/guides/end-to-end-workflow.md)

### API Reference

See [docs/api-reference.md](docs/api-reference.md) for the full SDK API with TypeScript signatures.

---

## 🔗 On-Chain Programs

| Program | ID | Purpose |
|---------|----|---------| 
| **Pump** | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve — create, buy, sell, migrate |
| **PumpAMM** | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Post-graduation AMM pools |
| **PumpFees** | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing config + social fee PDAs |

---

## 🛠️ Development

```bash
# Clone
git clone https://github.com/x402agent/pump-fun-sdk.git
cd pump-fun-sdk

# Install (root SDK)
npm install

# Build SDK
npm run build

# Run a bot
cd telegram-bot
cp .env.example .env
# Edit .env with your keys
npm install --install-strategy=nested
npm run dev
```

### Project Structure

```
├── src/                    # Core SDK source
├── telegram-bot/           # Interactive Telegram bot (DMs + API)
├── channel-bot/            # Channel broadcast bot
├── outsiders-bot/          # Call tracking + leaderboards
├── claim-bot/              # Fee claim monitor
├── swarm-bot/              # Multi-strategy trading swarm
├── swarm/                  # Swarm coordinator
├── pumpkit/                # PumpKit framework (Turborepo)
│   └── packages/
│       ├── core/           # Shared monitors, formatters, storage
│       ├── monitor/        # All-in-one monitor bot
│       ├── tracker/        # Call tracking bot
│       ├── channel/        # Channel feed bot
│       ├── claim/          # Claim monitor bot
│       └── web/            # Frontend (WIP)
├── dashboard/              # Admin dashboard
├── websocket-server/       # Real-time WebSocket feeds
├── mcp-server/             # MCP server for AI agents
├── x402/                   # x402 payment protocol
├── docs/                   # Full documentation
├── tutorials/              # 26 step-by-step tutorials
├── tests/                  # Integration tests
├── scripts/                # Build & deploy scripts
└── rust/                   # Rust crate (Anchor IDLs)
```

---

## 🚢 Deployment

| Component | Platform | Est. Cost |
|-----------|----------|-----------|
| Telegram Bots | Railway / Fly.io | ~$5/mo each |
| Dashboard | Vercel | Free |
| WebSocket Server | Railway | ~$5/mo |
| Documentation | Vercel | Free |

Every bot includes a `Dockerfile` and `railway.json` for one-click deploys.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- Branch naming and commit conventions  
- Testing requirements
- PR process

---

## 📄 License

[MIT](LICENSE) — use freely, build boldly.

---

## 🙏 Acknowledgments

- **[Pump.fun](https://pump.fun)** — The protocol
- **[Solana](https://solana.com)** — The blockchain
- **[@nirholas](https://github.com/nirholas)** — SDK creator
- **[grammy](https://grammy.dev/)** — Telegram bot framework
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — Database
- **[bn.js](https://github.com/indutny/bn.js)** — Arbitrary precision math

---

<p align="center">
  <sub>Built with ❤️ for the Solana ecosystem</sub>
</p>
