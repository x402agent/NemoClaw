# nemoClawd xAI Grok Agent Skill

Use this skill when the user wants to run nemoClawd with xAI Grok integration for Solana trading, research, and autonomous agent operations.

## Goal

Launch nemoClawd with full xAI Grok-powered agentic capabilities, including multi-agent research, voice mode, and the $CLAWD Solana ecosystem.

## Non-Negotiables

- Never ask the user to paste raw private keys into git-tracked files.
- Never print or log wallet secret keys, Helius API keys, Telegram bot tokens, or xAI API keys.
- Never commit `.env`, `credentials.json`, `*.keypair.json`, or other secret-bearing files.
- Use environment variables and secure vault storage for secrets.
- All trade operations default to `ask` permission — human approval required.

## One-Shot Flow

1. Ensure Node.js 20+ is available:
```bash
node --version
```

2. Install nemoClawd:
```bash
npm install -g @mawdbotsonsolana/nemoclaw
```

3. Set xAI API key and Helius credentials:
```bash
export XAI_API_KEY="your_xai_key"           # From x.ai
export HELIUS_API_KEY="your_helius_key"     # From helius.dev
export HELIUS_RPC_URL="https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY"
```

4. Launch with Grok integration:
```bash
nemoclaw launch
```

5. Run the demo walkthrough:
```bash
nemoclaw demo
```

## xAI Grok Integration

nemoClawd integrates xAI Grok for AI capabilities:

| Feature | Grok Model | Description |
|---------|------------|-------------|
| Chat | `grok-4.20-reasoning` | Conversational AI with streaming |
| Vision | `grok-4.20-reasoning` | Image analysis, chart reading |
| Image Gen | `grok-imagine-image` | Text-to-image, meme generation |
| Multi-Agent | `grok-4.20-multi-agent` | 4-16 agents collaborating |
| Voice | `grok-4.20-reasoning` | TTS + conversational agent |
| X Search | `grok-4.20-reasoning` | Real-time Twitter intelligence |

## MCP Tools

nemoClawd exposes 31 MCP tools for Solana operations:

**Market Data:**
- `solana_price`, `solana_trending`, `solana_token_info`
- `solana_wallet_pnl`, `solana_search`, `solana_top_traders`

**Helius Onchain:**
- `helius_account_info`, `helius_balance`, `helius_transactions`
- `helius_priority_fee`, `helius_das_asset`, `helius_webhook_create`

**Agent Fleet:**
- `agent_spawn`, `agent_list`, `agent_stop`
- `memory_recall`, `memory_write`

**Pump.fun:**
- `pump_token_scan`, `pump_buy_quote`, `pump_sell_quote`
- `pump_graduation`, `pump_market_cap`, `pump_top_tokens`

## Blockchain Buddies

Generate companion agents with unique trading personalities:

```bash
nemoclaw birth   # Hatch a buddy
nemoclaw spinners   # Preview custom animations
```

18 species: SolDog, BONK Dog, dogwifhat, Whale, Bull, Bear, Pepe, Pump.fun, Sniper Bot, and more.

## Telegram Commands

```bash
nemoclaw telegram start

# Market commands
nemoclaw sol              # SOL price
nemoclaw price <token>    # Token price
nemoclaw trending         # Top trending tokens

# Trading commands
nemoclaw wallet           # Wallet PnL
nemoclaw scan             # Pump.fun scanner
nemoclaw snipe <config>   # Sniper bot

# Grok AI commands
nemoclaw grok <question>  # Chat with Grok
nemoclaw xsearch <query>  # X/Twitter search
nemoclaw imagine <prompt> # Generate images
```

## Memory Tiers

| Tier | Storage | Behavior |
|------|---------|----------|
| **KNOWN** | Ephemeral (~60s TTL) | Live API data, prices, balances |
| **LEARNED** | Persistent | Validated patterns, cross-session |
| **INFERRED** | Markdown | Tentative signals, hypotheses |

## OODA Loop

```
OBSERVE  → sol_price, trending, helius_priority_fee, memory KNOWN
ORIENT   → score candidates (trend + momentum + liquidity)
DECIDE   → confidence ≥ 60? → size band
ACT      → human approval → trade execution
LEARN    → write INFERRED → Dream promotes to LEARNED
```

## Agent Fleet

| Agent | Turns | Purpose |
|-------|-------|---------|
| **Explorer** | 10 | Read-only research, fast/cheap |
| **Scanner** | 25 | Market scanning, trend monitoring |
| **OODA** | 40 | Full trading cycle with permission |
| **Dream** | 20 | Memory consolidation |
| **Analyst** | 30 | Deep structured research |
| **Monitor** | 15 | WebSocket event listeners |

## Recovery Rules

- If the sandbox gateway is down, restart with: `docker start openshell-cluster-nemoclaw`
- If port conflicts occur, stop the conflicting process or move it off the conflicting port.
- Run `nemoclaw doctor` to check all prerequisites.

## Public-Release Safety Check

Before publishing:
```bash
npm run public:audit
```
