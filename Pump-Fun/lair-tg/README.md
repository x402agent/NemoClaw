# Lair-TG — Unified Telegram Bot for DeFi Intelligence

A unified Telegram bot platform that aggregates data from multiple DeFi sources and provides real-time market intelligence, wallet tracking, token analytics, and AI-powered DeFi assistance on Solana.

## Features

- **Token Lookups** — Fetch token info from DexScreener (more sources planned)
- **Price Checks** — Quick price queries for any Solana token
- **Wallet Balance** — Check SOL and SPL token balances via Solana RPC
- **Price Alerts** — Set above/below price alerts with automatic polling
- **AI Assistant** — Natural language DeFi queries via OpenRouter (Grok, Claude, etc.)
- **42 DeFi Agent Specialists** — Auto-routed AI agents for yield, security, governance, and more
- **Modular Architecture** — Enable/disable modules via environment variables
- **Health Endpoint** — `/health` for Docker/Railway probes
- **Extensible Data Sources** — Add new DeFi APIs by implementing the `DataSource` interface

### Planned

- **Token Launch** — Deploy tokens via bonding curves
- **MCP Integration** — Model Context Protocol for AI agent access

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env

# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick reference |
| `/help` | Full command list |
| `/token <address>` | Full token info card |
| `/price <address>` | Quick price check |
| `/wallet <address>` | Check wallet SOL and token balances |
| `/alert <address> above\|below <price>` | Set a price alert |
| `/alerts` | List active price alerts |
| `/cancelalert <id>` | Cancel a price alert |
| `/ask <question>` | Ask a DeFi question (AI-powered) |
| `/agents` | Browse all DeFi agent specialists |
| `/agent <id> <question>` | Query a specific DeFi agent |

## Configuration

All configuration is via environment variables. See [.env.example](.env.example) for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from @BotFather |
| `SOLANA_RPC_URL` | Yes | — | Solana RPC endpoint |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `HEALTH_PORT` | No | `3000` | Health check server port |
| `MODULE_WALLET` | No | `true` | Enable wallet module |
| `MODULE_MARKET` | No | `true` | Enable market data module |
| `MODULE_LAUNCH` | No | `true` | Enable token launch module |
| `MODULE_ALERTS` | No | `true` | Enable price alerts module |
| `MODULE_AI` | No | `true` | Enable AI assistant module |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key for AI features |
| `OPENROUTER_MODEL` | No | `x-ai/grok-4-0820` | AI model (Grok 4 default) |
| `DEFI_AGENTS_URL` | No | `https://sperax.click/index.json` | DeFi Agents API endpoint |

## Project Structure

```
lair-tg/
├── src/
│   ├── index.ts              # Entry point — startup, shutdown, health
│   ├── bot.ts                # Grammy bot setup & command handlers
│   ├── config.ts             # Environment config loader
│   ├── data-sources.ts       # DeFi data aggregator (DexScreener, etc.)
│   ├── openrouter-client.ts  # OpenRouter AI chat completions
│   ├── defi-agents.ts        # DeFi Agents registry & auto-routing
│   ├── wallet.ts             # Wallet balance via Solana RPC
│   ├── alerts.ts             # Price alert manager with polling
│   ├── formatters.ts         # Telegram HTML message formatters
│   ├── health.ts             # HTTP health check server
│   ├── logger.ts             # Structured logger
│   └── types.ts              # Shared TypeScript types
├── Dockerfile                # Multi-stage production build
├── railway.json              # Railway deployment config
├── package.json
└── tsconfig.json
```

## AI Assistant

Lair-TG integrates with **42 production-ready DeFi agent definitions** via the [DeFi Agents API](https://sperax.click). When you ask a question with `/ask`, the bot automatically selects the most relevant specialist agent:

- **Yield questions** → DeFi Yield Farming Strategist
- **Security questions** → Smart Contract Security Auditor
- **Whale tracking** → Crypto Whale Watcher
- **Portfolio advice** → Portfolio Rebalancing Advisor
- **Tax questions** → Crypto Tax Strategy Advisor
- And 37 more specialized agents

You can also directly query any agent with `/agent <id> <question>`.

Powered by **OpenRouter** — supports Grok 4, Claude, GPT, and any OpenRouter-compatible model.

## Deployment

### Docker

```bash
docker build -t lair-tg .
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
  -e OPENROUTER_API_KEY=your-key \
  -p 3000:3000 \
  lair-tg
```

### Railway

Push the `lair-tg/` directory to Railway. The `railway.json` config will auto-detect the Dockerfile.

Set `TELEGRAM_BOT_TOKEN`, `SOLANA_RPC_URL`, and `OPENROUTER_API_KEY` as environment variables in the Railway dashboard.

## Architecture

Lair-TG follows the same patterns as the other bots in this repository:

- **grammY** for Telegram bot framework
- **Modular config** via `loadConfig()` with env vars
- **Structured logger** with level filtering
- **Health server** for container orchestration probes
- **Graceful shutdown** on SIGINT/SIGTERM
- **HTML formatting** for rich Telegram messages
- **OpenRouter** for AI chat completions (Grok 4 default)
- **DeFi Agents API** for specialized agent system prompts

The `DataAggregator` class provides a unified interface for fetching token data across multiple DeFi APIs. New sources are added by implementing the `DataSource` interface.

The `DefiAgentRegistry` fetches and caches agent definitions, auto-routing user queries to the most relevant specialist via keyword matching.

## License

See the root [LICENSE](../LICENSE) file.
