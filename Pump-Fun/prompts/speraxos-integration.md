# SperaxOS Integration — pump-fun-sdk as Native Skill

## Objective

Complete the SperaxOS integration to make pump-fun-sdk available as a native skill in the SperaxOS plugin ecosystem.

## Context

SperaxOS is a plugin platform for AI agents. The integration work is in `packages/plugin.delivery/`. The SDK needs to be wrapped as a SperaxOS plugin that agents can invoke via the gateway.

**Existing infrastructure:**
- `packages/plugin.delivery/api/pump-fun-sdk/` — 6 API endpoints already working (bonding-curve, market-cap, price-quote, fee-sharing, fee-tier, token-incentives)
- `packages/plugin.delivery/packages/gateway/` — Plugin gateway routes API calls
- `packages/plugin.delivery/packages/sdk/client/speraxOS.ts` — SperaxOS client with message protocol

**Status:** 🚧 In Progress per ROADMAP.md

## What's Missing

### 1. Plugin Definition

Create `packages/plugin.delivery/src/pump-fun-sdk.json`:
```json
{
  "id": "pump-fun-sdk",
  "name": "PumpFun SDK",
  "description": "Create, buy, sell, and analyze tokens on the PumpFun bonding curve protocol on Solana",
  "version": "1.0.0",
  "type": "openapi",
  "icon": "🪙",
  "category": "defi",
  "api": {
    "type": "openapi",
    "spec": "./api/pump-fun-sdk/openapi.yaml"
  }
}
```

### 2. OpenAPI Spec

Create `packages/plugin.delivery/api/pump-fun-sdk/openapi.yaml` documenting all 6 endpoints:
- `POST /api/pump-fun-sdk/bonding-curve` — Get bonding curve state
- `POST /api/pump-fun-sdk/market-cap` — Get market cap
- `POST /api/pump-fun-sdk/price-quote` — Get buy/sell quote
- `POST /api/pump-fun-sdk/fee-sharing` — Get fee sharing config
- `POST /api/pump-fun-sdk/fee-tier` — Get fee tier
- `POST /api/pump-fun-sdk/token-incentives` — Get token incentives

### 3. Localization

Create `packages/plugin.delivery/locales/pump-fun-sdk.en-US.json` with English translations (required — build fails without it).

### 4. Plugin Manifest

Create `packages/plugin.delivery/public/pump-fun-sdk/manifest.json`:
```json
{
  "schema_version": "v1",
  "name": "PumpFun SDK",
  "description": "Token trading and analytics on PumpFun",
  "auth": { "type": "none" },
  "api": { "type": "openapi", "url": "/api/pump-fun-sdk/openapi.yaml" }
}
```

### 5. Build & Deploy

```bash
cd packages/plugin.delivery
bun run format    # Generates 18-language translations via OpenAI
bun run build     # Builds plugin registry
vercel --prod     # Deploy
```

## Rules

- Follow the exact plugin creation steps from `packages/plugin.delivery/README.md`
- All 4 files are required: plugin def, locale, manifest, OpenAPI spec
- Test with `bun run build` before deploying
- The OpenAPI spec must accurately describe request/response schemas matching existing endpoints
- Use `bun run format` to auto-generate i18n (requires OpenAI API key in env)

## Deliverables

1. Plugin definition JSON
2. OpenAPI spec YAML
3. English locale file
4. Plugin manifest
5. Successful `bun run build`
6. Deployment to Vercel
