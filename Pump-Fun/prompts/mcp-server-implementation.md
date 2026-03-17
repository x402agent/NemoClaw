# MCP Server — Full Implementation

## Objective

Create the `mcp-server/` directory with a fully functional Model Context Protocol server exposing 53 tools for the Pump SDK. The MCP server should work with Claude, Cursor, and any MCP-compatible AI assistant.

## Context

The Pump SDK (`@nirholas/pump-sdk`) is a TypeScript SDK for the Pump protocol on Solana. It provides offline-first instruction builders for token creation, buying, selling, migration, and fee management.

**Existing MCP prompts to reference** (these contain architectural plans — read them first):
- `prompts/mcp-server/MCP_MASTER_PLAN.md` — Master architecture plan
- `prompts/mcp-server/agent-1-server-core.md` — Server core & transport
- `prompts/mcp-server/agent-2-tools-prompts.md` — Tool definitions
- `prompts/mcp-server/agent-3-resources-sampling.md` — Resources & sampling
- `prompts/mcp-server/agent-4-testing-security.md` — Testing & security
- `prompts/mcp-server/agent-5-docs-deploy.md` — Docs & deployment

**Server config** (`server.json` in root):
```json
{
  "name": "io.github.nirholas/pump-fun-sdk",
  "title": "Pump SDK MCP Server",
  "description": "Build extend and maintain pump - Token creation buying selling migration fee collection",
  "version": "1.0.1"
}
```

**On-chain programs:**
| Program | ID | Purpose |
|---------|-----|---------|
| Pump | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | Bonding curve operations |
| PumpAMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | Graduated AMM pools |
| PumpFees | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` | Fee sharing |

## Architecture

### Directory Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                  # Entry point — stdio transport
│   ├── server.ts                 # MCP server setup, tool/resource registration
│   ├── types.ts                  # Shared types
│   ├── tools/
│   │   ├── index.ts              # Tool registry — exports all 53 tools
│   │   ├── quoting.ts            # Buy/sell quotes, price impact, market cap
│   │   ├── trading.ts            # Build buy/sell/create instructions
│   │   ├── fees.ts               # Fee tiers, fee sharing, distribution
│   │   ├── analytics.ts          # Bonding curve state, graduation progress
│   │   ├── amm.ts                # PumpAMM pool queries, swap instructions
│   │   ├── social-fees.ts        # Creator vaults, shareholder management
│   │   ├── wallet.ts             # Generate keypair, vanity, validate address
│   │   ├── token-incentives.ts   # Unclaimed tokens, volume stats, claiming
│   │   └── metadata.ts           # Token info, creator profiles
│   ├── resources/
│   │   ├── index.ts
│   │   └── solana.ts             # solana:// URI scheme resources
│   └── utils/
│       ├── validation.ts         # Input validation with Zod
│       └── formatting.ts         # BN formatting, lamport conversion
└── tests/
    ├── server.test.ts
    ├── tools.test.ts
    └── validation.test.ts
```

### Core Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@solana/web3.js": "^1.98.0",
    "bn.js": "^5.2.1",
    "zod": "^3.22.0"
  }
}
```

### 53 Tools (Organized by Category)

**Quoting (8 tools):**
- `get_buy_quote` — Calculate tokens received for SOL input
- `get_sell_quote` — Calculate SOL received for token input
- `get_price_impact` — Price impact percentage for a trade
- `get_market_cap` — Current market cap in SOL and USD
- `get_token_price` — Current price per token
- `get_bonding_curve_summary` — Full curve state summary
- `get_graduation_progress` — Percentage toward AMM migration
- `get_amm_quote` — Quote for graduated tokens on PumpAMM

**Trading (6 tools):**
- `build_buy_instructions` — Build buy transaction instructions
- `build_sell_instructions` — Build sell transaction instructions
- `build_create_token` — Build createV2 token launch instructions
- `build_create_and_buy` — Create token + initial buy in one TX
- `build_amm_swap` — Build PumpAMM swap instructions
- `build_migrate_instructions` — Build graduation migration

**Fees (8 tools):**
- `get_fee_tier` — Current fee tier for a trade amount
- `get_fee_breakdown` — Decompose fees (platform, creator, referral)
- `get_creator_vault_balance` — SOL in creator vault
- `get_minimum_distributable_fee` — Distribution threshold check
- `build_collect_creator_fees` — Build fee collection instructions
- `build_distribute_fees` — Build fee distribution instructions
- `get_fee_sharing_config` — Current shareholder configuration
- `build_update_fee_shares` — Build shareholder update instructions

**Analytics (7 tools):**
- `get_bonding_curve_state` — Raw bonding curve account data
- `get_token_info` — Token metadata, socials, image
- `get_creator_profile` — Creator history, launch count, followers
- `get_token_holders` — Holder count and distribution
- `get_recent_trades` — Recent trades for a token
- `get_sol_usd_price` — Current SOL/USD from Jupiter
- `get_graduation_status` — Whether token has graduated

**AMM (5 tools):**
- `get_amm_pool` — PumpAMM pool state
- `get_amm_reserves` — Current pool reserves
- `get_amm_price` — Price from AMM pool
- `build_amm_deposit` — Build liquidity deposit
- `build_amm_withdraw` — Build liquidity withdrawal

**Social Fees (6 tools):**
- `build_create_fee_sharing` — Create fee sharing config
- `build_update_shareholders` — Update shareholders
- `build_revoke_admin` — Lock configuration permanently
- `get_shareholders` — List current shareholders
- `get_distributable_amount` — Check distributable balance
- `build_claim_share` — Build claim instructions for shareholder

**Wallet (5 tools):**
- `generate_keypair` — Generate new Solana keypair
- `generate_vanity_address` — Generate vanity address with prefix/suffix
- `validate_address` — Check if address is valid base58
- `estimate_vanity_time` — Estimate generation time for pattern
- `restore_keypair` — Restore from secret key bytes

**Token Incentives (5 tools):**
- `get_unclaimed_tokens` — Unclaimed PUMP tokens for user
- `get_current_day_tokens` — Preview current day's projected tokens
- `get_volume_stats` — Aggregate volume accumulator stats
- `build_claim_incentives` — Build claim instructions
- `build_claim_cashback` — Build cashback claim instructions

**Metadata (3 tools):**
- `search_tokens` — Search PumpFun tokens by name/symbol
- `get_token_metadata_uri` — Get metadata JSON URI
- `get_token_socials` — Extract social links from metadata

## Implementation Rules

1. **Use `@modelcontextprotocol/sdk`** — Don't implement JSON-RPC from scratch
2. **Stdio transport** — Primary transport for Claude/Cursor integration
3. **All financial math uses `BN`** — Never JavaScript `number` for SOL/token amounts
4. **Validate all inputs with Zod** — Every tool parameter validated before processing
5. **ONLY official Solana Labs crypto** — `@solana/web3.js` only, no third-party crypto
6. **Zeroize key material** — Wallet tools must clear sensitive data after use
7. **Offline-first** — Tools that don't need RPC should use `PumpSdk` (offline singleton `PUMP_SDK`)
8. **Online tools** — Use `OnlinePumpSdk` only when RPC fetching is required
9. **Error messages must be actionable** — Include what went wrong and how to fix it

## Testing

- Unit tests for every tool with mocked RPC responses
- Validation tests for all Zod schemas (valid + invalid inputs)
- Integration test that starts the server and sends JSON-RPC requests over stdio
- Security tests: no key leaks in error messages, input sanitization

## Deliverables

1. Complete `mcp-server/` directory with all files
2. All 53 tools implemented and registered
3. README.md with setup, usage, and Claude/Cursor configuration
4. Test suite passing
5. `npm run build` succeeds with zero errors
