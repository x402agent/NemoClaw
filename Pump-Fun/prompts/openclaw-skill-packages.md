# OpenClaw Skill Packages

## Objective

Create packaged, plug-and-play agent skill modules that can be imported into any AI agent framework (Claude, Cursor, Copilot, LangChain, CrewAI) to instantly gain Pump SDK capabilities.

## Context

The existing `skills/` directory has 28+ markdown skill documents. OpenClaw packages turn these into **executable code modules** — not just documentation, but importable functions that agents can call.

**Existing skills to package** (see `skills/` and `.github/skills/`):
- `pump-sdk-core` — Core SDK patterns
- `pump-bonding-curve` — AMM math, buy/sell quoting
- `pump-fee-system` — Fee tiers, decomposition
- `pump-fee-sharing` — Shareholder management
- `pump-security` — Security best practices
- `pump-rust-vanity` — Vanity address generation
- `pump-mcp-server` — MCP integration
- `pump-shell-scripts` — CLI wrappers

## Architecture

```
packages/openclaw/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts              # Main export — all skills
│   ├── skills/
│   │   ├── quoting.ts        # getBuyQuote, getSellQuote, getMarketCap, getPriceImpact
│   │   ├── trading.ts        # buildBuy, buildSell, buildCreate, buildMigrate
│   │   ├── fees.ts           # getFeeTier, getFeeBreakdown, buildCollectFees
│   │   ├── analytics.ts      # getBondingCurveState, getGraduationProgress
│   │   ├── wallet.ts         # generateKeypair, validateAddress
│   │   └── metadata.ts       # getTokenInfo, getCreatorProfile
│   ├── adapters/
│   │   ├── langchain.ts      # LangChain Tool adapter
│   │   ├── crewai.ts         # CrewAI Tool adapter
│   │   └── mcp.ts            # MCP tool definition adapter
│   └── types.ts
└── tests/
    └── skills.test.ts
```

Each skill function should:
1. Accept plain JSON parameters (no Solana-specific types in the public API)
2. Return plain JSON (BN values serialized to strings)
3. Include a `description` and `parameters` schema (for auto-registration in agent frameworks)
4. Work offline where possible (use `PUMP_SDK` singleton)

## Example Skill Definition

```typescript
export const getBuyQuote = {
  name: 'get_buy_quote',
  description: 'Calculate how many tokens you receive for a given SOL input on a PumpFun bonding curve',
  parameters: {
    type: 'object',
    properties: {
      mint: { type: 'string', description: 'Token mint address' },
      solAmount: { type: 'string', description: 'SOL amount (e.g., "0.1")' },
    },
    required: ['mint', 'solAmount'],
  },
  execute: async ({ mint, solAmount }: { mint: string; solAmount: string }) => {
    // Implementation using OnlinePumpSdk
  },
};
```

## Deliverables

1. Complete `packages/openclaw/` with all files
2. 20+ skill functions covering core SDK operations
3. LangChain and CrewAI adapters
4. MCP tool definition export
5. Tests for all skills
6. README with usage examples for each framework
7. `npm run build` succeeds
