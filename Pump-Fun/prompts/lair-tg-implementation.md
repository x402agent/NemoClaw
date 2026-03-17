# Lair-TG — Unified Telegram Bot Platform

## Objective

Create the `lair-tg/` directory with a unified Telegram bot platform for DeFi intelligence, wallet management, and token launching on Solana via the Pump protocol.

## Context

The existing `telegram-bot/` is a **single-purpose** monitor focused on fee claims, CTO alerts, whale trades, and graduations. Lair-TG is a **full-featured platform** — a complete DeFi command center in Telegram.

The `channel-bot/` is a read-only feed that broadcasts to `@pumpfunclaims`. Lair-TG is interactive — users issue commands and get personalized responses.

**Existing files to study:**
- `telegram-bot/src/` — Bot patterns, Telegram API usage, monitor architecture
- `channel-bot/src/` — Formatting patterns, pump-client.ts for PumpFun API calls
- `src/sdk.ts` — PumpSdk offline instruction builders
- `src/online-sdk.ts` — OnlinePumpSdk with RPC fetchers

**On-chain programs:**
| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing |

## Architecture

### Directory Structure

```
lair-tg/
├── package.json
├── tsconfig.json
├── Dockerfile
├── railway.json
├── README.md
├── .env.example
├── src/
│   ├── index.ts                  # Entry point — bot startup
│   ├── bot.ts                    # Telegram bot setup, command registration
│   ├── config.ts                 # Environment config loader
│   ├── types.ts                  # Shared types
│   ├── commands/
│   │   ├── index.ts              # Command registry
│   │   ├── start.ts              # /start — Welcome + help
│   │   ├── wallet.ts             # /wallet — View/create wallet
│   │   ├── balance.ts            # /balance — SOL + token balances
│   │   ├── buy.ts                # /buy <mint> <sol> — Buy tokens
│   │   ├── sell.ts               # /sell <mint> <amount> — Sell tokens
│   │   ├── launch.ts             # /launch — Interactive token creation
│   │   ├── quote.ts              # /quote <mint> <sol> — Get buy/sell quote
│   │   ├── chart.ts              # /chart <mint> — Bonding curve visualization
│   │   ├── token.ts              # /token <mint> — Token info card
│   │   ├── fees.ts               # /fees <mint> — Fee info + claimable
│   │   ├── claim.ts              # /claim — Claim all pending rewards
│   │   ├── portfolio.ts          # /portfolio — All held tokens + P&L
│   │   ├── alerts.ts             # /alert <mint> <price> — Price alerts
│   │   ├── watch.ts              # /watch <wallet> — Watch wallet activity
│   │   ├── trending.ts           # /trending — Top tokens by volume
│   │   └── settings.ts           # /settings — User preferences
│   ├── services/
│   │   ├── wallet-service.ts     # Encrypted wallet storage per user
│   │   ├── pump-service.ts       # PumpFun API wrapper (reuse patterns from channel-bot)
│   │   ├── price-service.ts      # SOL/USD price cache (Jupiter)
│   │   ├── alert-service.ts      # Price alert monitoring
│   │   └── portfolio-service.ts  # Token balance tracking
│   ├── formatters/
│   │   ├── token-card.ts         # Compact token info card (emoji-dense)
│   │   ├── trade-card.ts         # Buy/sell confirmation card
│   │   ├── portfolio-card.ts     # Portfolio summary
│   │   └── utils.ts              # Shared formatting helpers
│   ├── middleware/
│   │   ├── auth.ts               # Rate limiting, user validation
│   │   └── logging.ts            # Command logging
│   └── storage/
│       ├── index.ts              # Storage interface
│       └── sqlite.ts             # SQLite for wallets, alerts, preferences
```

### Commands (16)

| Command | Args | Description |
|---------|------|-------------|
| `/start` | — | Welcome message with command list |
| `/wallet` | — | View or create Solana wallet |
| `/balance` | `[mint]` | SOL balance + token balances |
| `/buy` | `<mint> <sol>` | Buy tokens on bonding curve |
| `/sell` | `<mint> <amount|%>` | Sell tokens |
| `/launch` | — | Interactive token creation wizard |
| `/quote` | `<mint> <sol>` | Price quote without executing |
| `/chart` | `<mint>` | ASCII bonding curve + key metrics |
| `/token` | `<mint>` | Full token info card |
| `/fees` | `<mint>` | Fee tier, creator vault, claimable |
| `/claim` | `[mint]` | Claim pending rewards (incentives, cashback, fees) |
| `/portfolio` | — | All held tokens, entry price, P&L |
| `/alert` | `<mint> <price>` | Set price alert |
| `/watch` | `<wallet> [label]` | Watch wallet for activity |
| `/trending` | — | Top tokens by volume/mcap |
| `/settings` | — | Inline keyboard for preferences |

### Wallet Security

- **Encrypted at rest** — AES-256-GCM with per-user key derived from `ENCRYPTION_KEY` env + user ID
- **Never log private keys** — Not in errors, not in Telegram messages
- **Confirmation for trades** — Inline keyboard "Confirm / Cancel" before signing
- **Spending limits** — Configurable max SOL per trade
- **ONLY `@solana/web3.js`** — No third-party crypto libraries

### Message Format

Follow the compact, emoji-dense style used in the channel-bot. Example token card:

```
🪙 TokenName $SYMBOL
💰 0.000021 SOL ⋅ $0.0032
💎 Mcap: 21.6K ⋅ 📊 Vol: 18K
📈 1H: +12.3% ⋅ Age: 2d
💦 Curve: 45% ⋅ 👥 285 holders
🔗 Pump ⋅ DEX ⋅ TX
```

## Implementation Rules

1. Use `grammy` or `telegraf` for Telegram Bot API (match existing telegram-bot's choice)
2. All financial math uses `BN` — never JavaScript `number`
3. Reuse `PumpSdk` / `OnlinePumpSdk` from `src/` for instruction building
4. SQLite via `better-sqlite3` for local storage — no external DB required
5. Rate limit: 1 trade command per 5 seconds per user
6. All trade confirmations require explicit user approval via inline keyboard
7. Dockerfile for Railway deployment (match channel-bot pattern)

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=         # Bot token from @BotFather
SOLANA_RPC_URL=             # Helius/Alchemy RPC endpoint
ENCRYPTION_KEY=             # 32-byte hex for wallet encryption
MAX_SOL_PER_TRADE=1         # Safety limit
ADMIN_CHAT_IDS=             # Comma-separated admin Telegram IDs
```

## Deliverables

1. Complete `lair-tg/` directory with all files
2. All 16 commands implemented
3. Encrypted wallet storage
4. Trade confirmation flow with inline keyboards
5. Compact emoji-dense message formatting
6. Dockerfile + railway.json for deployment
7. README.md with setup, commands, and security notes
8. `npm run build` succeeds with zero errors
