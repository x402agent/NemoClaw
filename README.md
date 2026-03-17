# NemoClaw — Autonomous Solana Trading Agent

<!-- start-badges -->
[![npm version](https://img.shields.io/npm/v/@mawdbotsonsolana/nemoclaw.svg)](https://www.npmjs.com/package/@mawdbotsonsolana/nemoclaw)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](https://github.com/NVIDIA/NemoClaw/blob/main/LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Report%20a%20Vulnerability-red)](https://github.com/NVIDIA/NemoClaw/blob/main/SECURITY.md)
[![Project Status](https://img.shields.io/badge/status-alpha-orange)](https://github.com/NVIDIA/NemoClaw/blob/main/docs/about/release-notes.md)
<!-- end-badges -->

NemoClaw is an open source agent stack that turns an AI model into an **autonomous Solana trader** with its own encrypted wallet, natural-language Telegram narration, and the full Pump-Fun SDK — all running inside a sandboxed [OpenShell](https://github.com/NVIDIA/OpenShell) container where every network request, file access, and transaction is governed by policy.

**Three commands. That's it.**

```bash
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw onboard          # pick your RPC, inference, and wallet
nemoclaw solana start     # bridged Telegram bot + tracker + relay start up
```

> **Alpha software** — Interfaces, APIs, and behavior may change without notice.
> We welcome issues and feedback while the project evolves.

---

## What You Get

| Feature | Description |
|---|---|
| **Agentic Wallet** | Encrypted Privy server wallet — private keys never leave Privy. Spending policies enforced on-chain |
| **Telegram Bridge** | Real-time natural-language narration of every trade, transfer, and program interaction |
| **NemoClaw Vault** | Append-only JSONL audit trail for wallet events, trade activity, heartbeats, and stack sessions |
| **Pump-Fun SDK** | Token creation, trading, claims, buybacks, payment-gated agents, and the full PumpKit monorepo |
| **44 DeFi Personas** | Pre-loaded agent identities (yield farmer, risk engine, news analyst, tax strategist, etc.) |
| **Solana Tooling** | `solana`, `solana-test-validator`, `spl-token`, `helius` installed in sandbox |
| **Sandboxed Execution** | Landlock + seccomp + network namespace isolation via NVIDIA OpenShell |
| **NVIDIA Inference** | Nemotron models via NVIDIA Cloud API, routed through the OpenShell gateway |

---

## Quick Start

### 1. Install

```bash
npm install -g @mawdbotsonsolana/nemoclaw
```

Requirements: Node.js 20+, Docker, Linux (Ubuntu 22.04+). macOS works for CLI management; sandbox runs in Docker.

### 2. Onboard

```bash
nemoclaw onboard
```

The interactive wizard walks through 9 steps:

1. **Preflight** — Docker, OpenShell, GPU detection
2. **Gateway** — Start the OpenShell gateway
3. **Sandbox** — Build the Docker image (Solana CLI, Pump-Fun SDK, DeFi personas)
4. **Inference model** — Pick NIM / NVIDIA Cloud / Ollama / vLLM
5. **Provider setup** — Configure the inference endpoint
6. **OpenClaw** — Install the agent framework in the sandbox
7. **Solana & Wallet** — RPC URL, Privy agentic wallet, Pump-Fun token config
8. **Test validator** — Optional local validator with cloned Pump programs
9. **Policies** — Auto-detect and apply `solana-rpc`, `pumpfun`, `privy`, `telegram`

### 3. Set Environment Variables

```bash
export HELIUS_API_KEY=<your-helius-key>
export SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY
export TELEGRAM_BOT_TOKEN=<botfather-token>
export TELEGRAM_NOTIFY_CHAT_IDS=<comma-separated-chat-ids>
export AGENT_TOKEN_MINT_ADDRESS=<pump-token-mint>
export DEVELOPER_WALLET=<developer-wallet>
export HEARTBEAT_SECONDS=60
export MIN_WALLET_SOL=0.01
export STOP_BALANCE_SOL=0.002
```

### 4. Start Everything

```bash
nemoclaw solana start
```

One command starts the full Solana operator stack inside the sandbox:

- ✅ Pump-Fun Telegram monitor bot + REST API
- ✅ Natural-language wallet narration bridge
- ✅ Realtime WebSocket relay
- ✅ Continuous wallet heartbeat with funded/protect-mode state
- ✅ Append-only vault logs under `~/.nemoclaw/vault`
- ✅ Optional payment app and swarm bot

---

## Standalone Commands

Each service can also be started individually:

### Create a Wallet

```bash
nemoclaw wallet create    # Create encrypted Privy agentic wallet
nemoclaw wallet list      # List all wallets
nemoclaw wallet status    # Show wallet + Privy configuration
```

### Solana Quick Start

```bash
nemoclaw solana           # Show Solana status + all available commands
nemoclaw solana start     # One-shot: bridge + telegram-bot + relay
```

### Individual Services

```bash
nemoclaw <name> connect          # Open sandbox shell
nemoclaw <name> solana-agent     # Pump-Fun tracker bot (payments, claims, buybacks)
nemoclaw <name> solana-bridge    # Natural-language Telegram wallet narration
nemoclaw <name> telegram-bot     # Telegram monitor + REST API
nemoclaw <name> payment-app      # Payment-gated Pump-Fun agent
nemoclaw <name> swarm-bot        # Pump-Fun swarm dashboard
nemoclaw <name> websocket-server # Pump-Fun realtime launch relay
nemoclaw <name> solana-stack     # Start bridge + bot + relay together
```

### Management

```bash
nemoclaw <name> status           # Sandbox + Solana + wallet health
nemoclaw <name> logs --follow    # Stream sandbox logs
nemoclaw <name> policy-add       # Add network policy preset
nemoclaw <name> policy-list      # List applied presets
nemoclaw <name> destroy          # Stop NIM + delete sandbox
nemoclaw deploy <instance>       # Deploy to a Brev GPU VM
```

---

## Telegram Bot Commands

When the Solana bridge is running, interact with it via Telegram:

| Command | Description |
|---|---|
| `/start` | Welcome + capabilities |
| `/balance` | SOL balance + token holdings |
| `/holdings` | Detailed token positions |
| `/status` | Bridge uptime, tx count, RPC provider |
| `/wallet` | Wallet address |
| `/rpc` | Current RPC endpoint and provider |
| `/lasttrade` | Most recent narrated trade |

The bridge automatically narrates:
- 🟢 **Buy** — "Our agent wallet just spent **0.05 SOL** to buy a token"
- 🔴 **Sell** — "Our agent wallet just sold tokens and realized **0.12 SOL**"
- 💰 **Incoming** — "The wallet received **1.5 SOL** from `4xKp...9nZe`"
- 📤 **Outgoing** — "The wallet sent **0.01 SOL** to `7bRq...2mXf`"
- ⚡ **Program** — "The wallet executed an on-chain program interaction"

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  nemoclaw CLI (host)                                     │
│                                                          │
│  nemoclaw onboard → builds sandbox image                │
│  nemoclaw solana start → injects env → starts services  │
│  nemoclaw wallet create → Privy API → encrypted wallet  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  OpenShell Gateway (network policy enforcement)          │
├─────────────────────────────────────────────────────────┤
│  Sandbox (Landlock + seccomp + netns)                    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Telegram Bot  │  │ Solana Bridge│  │ WS Relay     │  │
│  │ (monitor)     │  │ (narration)  │  │ (launches)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  OpenClaw Agent                                          │
│  ├── NVIDIA Nemotron (inference via gateway)             │
│  ├── Privy Wallet Skill (sign, send, policy)            │
│  ├── Pump-Fun SDK (@nirholas/pump-sdk)                   │
│  ├── 44 DeFi Agent Personas                              │
│  └── Solana CLI (solana, spl-token, helius)              │
└─────────────────────────────────────────────────────────┘
```

| Component | Role |
|---|---|
| **Plugin** | TypeScript CLI for launch, connect, status, logs |
| **Blueprint** | Python artifact that orchestrates sandbox, policy, inference |
| **Sandbox** | Isolated container running OpenClaw + Solana services |
| **Inference** | Model calls routed through OpenShell gateway |
| **Privy** | Server wallet management — private keys never stored locally |

---

## Security & Protection

| Layer | What it protects | When |
|---|---|---|
| **Network** | Blocks unauthorized outbound connections | Hot-reloadable |
| **Filesystem** | Prevents reads/writes outside `/sandbox` and `/tmp` | At creation |
| **Process** | Blocks privilege escalation and dangerous syscalls | At creation |
| **Inference** | Routes model calls to controlled backends | Hot-reloadable |
| **Wallet** | Private keys managed by Privy, never in sandbox | Always |
| **Credentials** | `~/.nemoclaw/` with mode 600, `.gitignore` protected | Always |
| **Pre-commit** | Hook blocks commits containing API keys or tokens | On commit |

### Network Policy Presets

| Preset | What it allows |
|---|---|
| `solana-rpc` | Solana mainnet, devnet, testnet, Helius, Alchemy, QuikNode |
| `pumpfun` | pump.fun APIs, Jupiter aggregator, DexScreener |
| `privy` | Privy auth + policy + wallet APIs |
| `telegram` | Telegram Bot API |
| `pypi` | Python package index |
| `npm` | npm registry |

---

## Knowledge Workspace

Inside the sandbox, the agent has local access to:

```
~/.openclaw/workspace/
├── AGENTS.md                    # Agent identity + Solana instructions
├── skills/privy/SKILL.md        # Privy wallet skill
└── pumpfun/
    ├── docs/                    # Protocol + SDK documentation
    ├── agent-app/               # Tracker bot code
    ├── telegram-bot/            # Telegram monitor runtime
    ├── pumpkit/                 # PumpKit packages + tutorials
    ├── defi-agents/             # 44 DeFi persona JSONs
    ├── tokenized-agents-skill/  # Payment skill guide
    ├── x402/                    # HTTP 402 payment protocol
    ├── swarm-bot/               # Multi-bot orchestration
    ├── websocket-server/        # Realtime launch relay
    ├── agent-prompts/           # PumpKit build prompts
    └── agent-tasks/             # Task specs + deliverables
```

No external fetching needed — the agent works with local protocol context.

---

## Inference

| Provider | Model | Use Case |
|---|---|---|
| NVIDIA Cloud | `nvidia/nemotron-3-super-120b-a12b` | Production (requires API key) |

Get an API key from [build.nvidia.com](https://build.nvidia.com).

---

## Learn More

**Bundled Stack:**
- [Pump-Fun Telegram bot](./Pump-Fun/telegram-bot) — monitoring, alerts, REST API
- [PumpKit monorepo](./Pump-Fun/pumpkit) — reusable packages, tutorials, web dashboard
- [Pump-Fun agent app](./Pump-Fun/agent-app) — tracker bot, payment-gated app
- [DeFi agent personas](./Pump-Fun/packages/defi-agents) — 44 personas with locales
- [Tokenized agent skill](./pump-fun-skills-main/tokenized-agents) — payment/invoice implementation
- [Pump-Fun x402](./Pump-Fun/x402) — HTTP 402 micropayment protocol for Solana
- [Pump-Fun swarm bot](./Pump-Fun/swarm-bot) — dashboard + multi-bot orchestration
- [WebSocket server](./Pump-Fun/websocket-server) — realtime launch relay
- [Protocol docs](./Pump-Fun/docs) — SDK, deployment, architecture
- [PumpKit prompts](./Pump-Fun/pumpkit/agent-prompts) — build prompts for extending the agent
- [Agent tasks](./Pump-Fun/agent-tasks) — scoped task prompts and deliverables

**NVIDIA Docs:**
- [CLI Commands Reference](./docs/reference/commands.md)
- [Inference Profiles](./docs/reference/inference-profiles.md)
- [Network Policies](./docs/reference/network-policies.md)

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
