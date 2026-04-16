<p align="center">
  <strong>🦀 nemoClawd</strong><br/>
  <em>Solana x xAI Agentic Trading Engine — Powered by $CLAWD</em>
</p>
<p align="center">
  <code>8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump</code>
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/nemoclaw"><img src="https://img.shields.io/npm/v/nemoclaw.svg?style=flat-square&color=cb3837" alt="npm"></a>
  <a href="https://github.com/x402agent/NemoClawd/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/xAI-Grok%204.20-black?style=flat-square&logo=x" alt="xAI Grok">
  <img src="https://img.shields.io/badge/MCP-31%20tools-blueviolet?style=flat-square" alt="MCP Tools">
  <img src="https://img.shields.io/badge/Multi--Agent-4--16%20agents-purple?style=flat-square" alt="Multi-Agent">
</p>

---

## solana-clawd Integration

**nemoClawd** now integrates **solana-clawd** — the full xAI Grok-powered agentic framework for Solana trading, research, and autonomous agent operations.

### What You Get

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                 │
│   xAI Grok Integration ─── 4-16 Grok agents with web + X search  │
│   │                     Chat, vision, image gen, voice          │
│   │                                                             │
│   $CLAWD Token ───────── 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump │
│   │                     Solana + Pump.fun native                │
│   │                                                             │
│   31 MCP Tools ───────── Solana market data, trading, NFTs      │
│   │                     Helius RPC/DAS, Pump.fun SDK            │
│   │                                                             │
│   Multi-Agent Research ─ 4 or 16 Grok agents collaborating     │
│   │                     Deep Solana research + intelligence   │
│   │                                                             │
│   Blockchain Buddies ─── 18 species with trading personalities  │
│   │                     Procedurally generated companions       │
│   │                                                             │
│   Voice Mode ─────────── xAI Grok text-to-speech agent          │
│   │                     Conversational AI + STT                 │
│   │                                                             │
│   Telegram Bot ───────── 60+ commands for trading + research    │
│                         Real-time alerts, sniping, narration    │
│                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Quick Start

```bash
npm install -g @mawdbotsonsolana/nemoclaw

# Start with Grok + Solana tools
nemoclaw launch

# Run demo walkthrough
nemoclaw demo
```

### xAI Grok Setup

```bash
export XAI_API_KEY="your_key"  # One key unlocks everything
export HELIUS_API_KEY="your_free_key"  # From helius.dev
```

### Grok Models

| Model | What it does | Use case |
|-------|-------------|----------|
| `grok-4.20-reasoning` | Chat, reasoning, vision, structured output, voice | Default for everything |
| `grok-4.20-multi-agent` | 4-16 agents collaborating in real-time | Deep research, complex analysis |
| `grok-4-1-fast` | Quick responses, low latency | Fast queries, real-time UX |
| `grok-imagine-image` | Image generation + editing | Memes, avatars, visualizations |

### MCP Tools (31)

**Solana Market Data:**
- `solana_price`, `solana_trending`, `solana_token_info`, `solana_wallet_pnl`
- `solana_search`, `solana_top_traders`, `solana_wallet_tokens`, `sol_price`

**Helius Onchain:**
- `helius_account_info`, `helius_balance`, `helius_transactions`
- `helius_priority_fee`, `helius_das_asset`, `helius_webhook_create`

**Agent Fleet:**
- `agent_spawn`, `agent_list`, `agent_stop`

**Memory:**
- `memory_recall`, `memory_write`

**Metaplex:**
- `metaplex_mint_agent`, `metaplex_register_identity`, `metaplex_read_agent`

**Pump.fun:**
- `pump_token_scan`, `pump_buy_quote`, `pump_sell_quote`, `pump_graduation`

---

## OODA Trading Loop

```
OBSERVE  → sol_price, trending, helius_priority_fee, memory KNOWN
ORIENT   → score candidates (trend + momentum + liquidity + participation)
DECIDE   → confidence ≥ 60? → size band (0.5x / 1.0x / 1.25x / 1.5x)
ACT      → trade_execute gated at `ask` permission (human approval required)
LEARN    → write INFERRED signals → Dream agent promotes to LEARNED
```

### Agent Fleet

| Agent | Type | Description |
|-------|------|-------------|
| **$CLAWD** | `Clawd` | Full autonomous agent — chat, vision, image gen, multi-agent, voice |
| **Grok Researcher** | `GrokResearcher` | 16-agent deep research with web + X search |
| **Explorer** | `Explore` | Read-only Solana research (fast, cheap) |
| **Scanner** | `Scanner` | Trend monitoring, surfaces high-signal opportunities |
| **OODA** | `OODA` | Full trading cycle: Observe, Orient, Decide, Act, Learn |
| **Dream** | `Dream` | Memory consolidation (INFERRED to LEARNED promotion) |
| **Analyst** | `Analyst` | Deep structured research reports |
| **Monitor** | `Monitor` | Helius WebSocket event listeners |

---

## Blockchain Buddies

Every `nemoClawd` user gets a companion — a procedurally generated Blockchain Buddy with its own wallet, trading personality, stats, and animated ASCII sprite.

```bash
nemoclaw birth   # hatch yours now
```

### Species (18 total)

| Category | Species | Personality | Risk Level |
|---|---|---|---|
| **Solana Natives** | SolDog, BONK Dog, dogwifhat, Jupiter Agg, Raydium LP | Diamond Hands / Degen / Bot | Low → Degen |
| **DeFi Archetypes** | Whale, Bull, Bear, MEV Shark, Octopus | Whale / Sniper / Ninja | Low → Medium |
| **Memecoin Culture** | Pepe, Pump.fun, Sniper Bot | Degen / Sniper | High → Degen |

---

## Telegram Trading Bot

### Commands

| Command | Response |
|---|---|
| `/sol` | SOL price (CoinGecko) |
| `/price <mint\|symbol>` | Token price |
| `/trending` | Top 10 trending tokens |
| `/wallet <address>` | Wallet PnL analysis |
| `/scan` | Toggle background pump scanner |
| `/snipe [config]` | Start sniper bot |
| `/grok <question>` | Chat with Grok |
| `/xsearch <query>` | Search X/Twitter live |
| `/imagine <prompt>` | Generate images |

---

## Deploy to Fly.io

```bash
cd MCP
fly launch --config fly.toml
fly secrets set HELIUS_API_KEY=your-key XAI_API_KEY=your-key MCP_API_KEY=optional-bearer-token
```

Then connect via:
```json
{ "type": "http", "url": "https://your-app.fly.dev/mcp" }
```

---

## Architecture

```
                     ┌─────────────────────────────────────────────────────┐
                     │                  ENTRY POINTS                       │
                     │  nemoClawd CLI    MCP Server    Telegram Bot        │
                     │  (interactive/   (stdio/HTTP)   60+ commands       │
                     │   one-shot)                                        │
                     └────────┬──────────┬────────────────┬────────────────┘
                              │          │                │
                              ▼          ▼                ▼
                     ┌─────────────────────────────────────────────────────┐
                     │                  CORE ENGINE                        │
                     │  QueryEngine ──► xAI Grok ──► Tool Execution       │
                     │    │              │              │               │
                     │    │  Providers:   │   ┌──────────┤               │
                     │    │  - xAI/Grok   │   │          │               │
                     │    │  - OpenRouter │   ▼          ▼               │
                     │    │  - Anthropic  │  ToolExecutor  Permission     │
                     └─────┼──────────────┼──────────────────────────────┘
                           │              │
               ┌───────────┴──────────────┴──────────────────────────────┐
               │                              │                         │
               ▼                              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────┐  ┌────────────────┐
│     SUPPORT LAYER    │  │      MEMORY SYSTEM       │  │   DATA SOURCES │
│                      │  │                          │  │                │
│  AppState (Zustand)  │  │  KNOWN   (ephemeral,     │  │  Helius RPC    │
│  - PermissionMode    │  │           ~60s TTL)      │  │  Helius DAS    │
│  - OODA phase        │  │                          │  │  Pump.fun      │
│  - PumpSignals       │  │  LEARNED (persistent,    │  │  Jupiter       │
│                      │  │           cross-session)  │  │                │
│  Risk Engine         │  │                          │  │  Solana Tracker│
└──────────────────────┘  │  INFERRED (tentative,    │  │                │
                          │           markdown)       │  │                │
                          └──────────────────────────┘  └────────────────┘
```

---

## Environment Variables

```bash
# Core (free at helius.dev)
HELIUS_API_KEY=               # RPC, DAS, enhanced txs, webhooks
HELIUS_RPC_URL=               # Helius mainnet RPC

# xAI Grok (one key unlocks everything)
XAI_API_KEY=                  # Grok: chat, voice, vision, search, multi-agent

# OpenRouter (optional)
OPENROUTER_API_KEY=           # Multi-model LLM routing

# Telegram
TELEGRAM_BOT_TOKEN=           # From @BotFather

# Wallet (optional)
SOLANA_PRIVATE_KEY=           # Base58 keypair for live trades
SOLANA_PUBLIC_KEY=           # Default wallet
```

---

## License

Licensed under [Apache 2.0](LICENSE).

**$CLAWD** `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`

Powered by **xAI Grok** from **xAI** | Built on **Solana**
