# Prompts

Agent prompt templates for building AI-powered PumpFun tools. These prompts are designed for use with AI coding assistants (Copilot, Claude, Cursor, etc.) to scaffold complete implementations.

## Prompt Index

### 🔴 Critical — Missing Components

| File | Priority | Description |
|------|----------|-------------|
| `mcp-server-implementation.md` | 🔴 Critical | Full MCP server with 53 tools (quoting, trading, fees, analytics, AMM, wallet) |
| `lair-tg-implementation.md` | 🔴 Critical | Unified Telegram bot — 16 commands, wallet management, trading, portfolio |

### 🟡 High — API Endpoints (plugin.delivery)

| File | Endpoints | Description |
|------|-----------|-------------|
| `api-address-labels.md` | 2 | Address label lookup + entity search |
| `api-audit-checker.md` | 2 | Protocol audit registry + search |
| `api-contract-scanner.md` | 2 | Token red flag scanner + honeypot detection |
| `api-ens-lookup.md` | 3 | ENS/SNS name resolution + availability |
| `api-gas-estimator.md` | 2 | Priority fee estimation + transaction simulation |
| `api-grants-finder.md` | 2 | Active crypto grants discovery |
| `api-phishing-detector.md` | 2 | Phishing URL + malicious contract detection |
| `api-sanctions-check.md` | 1 | OFAC/EU sanctions list checking |

### 🟠 Medium — Infrastructure

| File | Description |
|------|-------------|
| `gateway-auth-implementation.md` | Basic Auth + OAuth2 for plugin gateway (+ enable 2 skipped tests) |
| `speraxos-integration.md` | Complete SperaxOS plugin registration (plugin def, OpenAPI spec, i18n, manifest) |

### 🔵 Low — Code Cleanup

| File | Description |
|------|-------------|
| `code-cleanup-todos.md` | Fix 4 scattered TODOs (pulse animation, field migration, deprecation warning) |

### 📋 Planned — New Features (Roadmap Q2-Q3)

| File | Description |
|------|-------------|
| `openclaw-skill-packages.md` | Plug-and-play agent skills for LangChain, CrewAI, MCP |
| `token-metadata-helpers.md` | Arweave/IPFS upload + metadata JSON builder |
| `transaction-simulation.md` | Dry-run buys/sells before submitting |

### Token Launch Monitors

| File | Description |
|------|-------------|
| `agent-token-launch-monitor-1.md` | Prompt for building a token launch monitoring agent (variant 1) |
| `agent-token-launch-monitor-2.md` | Prompt for building a token launch monitoring agent (variant 2) |

### MCP Server Prompts — Original (`mcp-server/`)

Step-by-step prompts for the original MCP server plan (5-agent parallel approach):

| File | Phase | Description |
|------|-------|-------------|
| `mcp-server/MCP_MASTER_PLAN.md` | Planning | Master architecture plan |
| `mcp-server/agent-1-server-core.md` | Phase 1 | Server core — transport, lifecycle |
| `mcp-server/agent-2-tools-prompts.md` | Phase 2 | Tool definitions and prompts |
| `mcp-server/agent-3-resources-sampling.md` | Phase 3 | Resources and sampling |
| `mcp-server/agent-4-testing-security.md` | Phase 4 | Testing and security |
| `mcp-server/agent-5-docs-deploy.md` | Phase 5 | Documentation and deployment |

## Usage

Copy any prompt into your AI assistant's context to generate the corresponding implementation. Each prompt is self-contained with requirements, constraints, and expected outputs.

```
# Example: paste the content of a prompt file into your AI assistant
cat prompts/mcp-server-implementation.md | pbcopy
```

## Execution Order

Recommended order based on priority and dependencies:

1. **MCP server** — Foundation for agent tooling
2. **Lair-TG** — Full Telegram bot platform
3. **API endpoints** (all 8 prompts) — Can be done in parallel
4. **Gateway auth** — Unblocks OAuth2 plugins
5. **SperaxOS integration** — Depends on working API endpoints
6. **Code cleanup** — Quick wins, do anytime
7. **OpenClaw / Metadata / Simulation** — New features after foundation is solid
