<p align="center">
  <strong>🦀 NemoClaw</strong><br/>
  <em>Autonomous Solana Trading Agent — Sandboxed, Wallet-Enabled, Telegram-Native</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mawdbotsonsolana/nemoclaw"><img src="https://img.shields.io/npm/v/@mawdbotsonsolana/nemoclaw.svg?style=flat-square&color=cb3837" alt="npm"></a>
  <a href="https://github.com/x402agent/NemoClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/Telegram-Bot-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram">
  <img src="https://img.shields.io/badge/Ollama-DeepSolana-000000?style=flat-square&logo=ollama&logoColor=white" alt="DeepSolana">
</p>

---

NemoClaw turns an AI model into a **fully autonomous Solana agent** that trades tokens, manages its own encrypted wallet, and narrates everything it does in natural language on Telegram — all running inside a hardened [OpenShell](https://github.com/NVIDIA/OpenShell) sandbox where every network request, file access, and on-chain transaction is governed by policy.

```bash
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw onboard
nemoclaw solana start
```

**Three commands. Zero exposed keys. Full autonomy.**

> **Alpha** — Interfaces may change. We welcome issues and feedback.

---

## 🍎 One Shot on Mac

If you want the fastest local path on macOS, use this exact flow:

```bash
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw onboard
nemoclaw solana start
```

Requirements:
- Docker Desktop is open.
- Ollama is optional. If present, NemoClaw auto-selects `8bit/DeepSolana`; otherwise you can use cloud inference.

If the OpenShell gateway ever drops but your cluster still exists:

```bash
docker start openshell-cluster-nemoclaw
```

---

## 📋 Copy-Paste `SKILL.md`

Paste [`SKILL.md`](./SKILL.md) into Claude, Codex, Cursor, or any agent that supports repo skills/system instructions.

That skill tells the agent to:
- install and onboard NemoClaw on macOS
- keep secrets out of git and out of logs
- use Privy-managed wallets and runtime environment variables
- recover the OpenShell gateway safely if it stops responding

This is the developer path we want to feature publicly at `nemo.nanosolana.com`: one-shot local launch on Mac, plus a drop-in skill your AI agent can immediately use.

---

## ⚡ What You Get

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🧠 DeepSolana Model ── 8bit/DeepSolana via Ollama.           │
│   │                       Solana-tuned LLM. Auto-pulled.       │
│   │                       Understands DeFi, Pump-Fun, wallets. │
│   │                                                             │
│   🔐 Encrypted Wallet ─── Privy server wallet. Private keys    │
│   │                       never leave Privy infrastructure.     │
│   │                       Spending policies enforced on-chain.  │
│   │                                                             │
│   🤖 Telegram Bridge ──── Natural-language narration of every   │
│   │                       trade, transfer, and interaction.     │
│   │                       /balance /holdings /status /lasttrade  │
│   │                                                             │
│   💎 Pump-Fun SDK ──────── Token creation, trading, claims,     │
│   │                       buybacks, PumpKit monorepo, x402.     │
│   │                                                             │
│   🧠 43 DeFi Personas ─── Yield farmer, whale watcher, MEV     │
│   │                       advisor, risk engine, tax strategist. │
│   │                                                             │
│   🛡️ Sandboxed ─────────── Landlock + seccomp + netns via       │
│                            NVIDIA OpenShell. Deny-all default.  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Install

```bash
npm install -g @mawdbotsonsolana/nemoclaw
```

> Requires: **Node.js 20+**, **Docker**, **Linux** (Ubuntu 22.04+). macOS works for CLI management; the sandbox runs in Docker.

### Onboard (one time)

```bash
nemoclaw onboard
```

The wizard walks through **9 steps**:

| Step | What happens |
|:---:|---|
| 1 | **Preflight** — Docker, OpenShell, GPU detection |
| 2 | **Gateway** — Start the OpenShell gateway |
| 3 | **Sandbox** — Build Docker image (Solana CLI v3.1.9 via Agave installer, Pump-Fun SDK, 43 DeFi personas) |
| 4 | **Inference** — Auto-detects Ollama → pulls `8bit/DeepSolana`. Or pick NVIDIA Cloud / vLLM |
| 5 | **Provider** — Configure the inference endpoint |
| 6 | **OpenClaw** — Install the agent framework in the sandbox |
| 7 | **Solana & Wallet** — RPC URL (Helius default), Privy agentic wallet, Pump-Fun token |
| 8 | **Test Validator** — Optional local validator with 4 cloned Pump programs |
| 9 | **Policies** — Auto-apply `solana-rpc`, `pumpfun`, `privy`, `telegram`, `ollama` presets |

### Set Environment

```bash
export HELIUS_API_KEY=<your-helius-key>
export SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY
export TELEGRAM_BOT_TOKEN=<botfather-token>
export TELEGRAM_NOTIFY_CHAT_IDS=<comma-separated-chat-ids>   # optional
export AGENT_TOKEN_MINT_ADDRESS=<pump-token-mint>             # optional
export DEVELOPER_WALLET=<developer-wallet>                    # optional (Privy creates one)
```

### Start Everything

```bash
nemoclaw solana start
```

One command spins up the full Solana operator stack inside the sandbox:

| Service | What it does |
|---|---|
| ✅ **Telegram Monitor** | Pump-Fun alerts, launch tracking, graduation events, whale detection |
| ✅ **Wallet Bridge** | Natural-language narration of buys, sells, transfers, program interactions |
| ✅ **WebSocket Relay** | Real-time launch feed for dashboards and downstream bots |
| ☐ **Payment App** | Payment-gated agent (enable: `START_PAYMENT_APP=true`) |
| ☐ **Swarm Bot** | Multi-bot orchestration dashboard (enable: `START_SWARM_BOT=true`) |

---

## 🧠 Default Model: `8bit/DeepSolana`

NemoClaw ships with **8bit/DeepSolana** as the default inference model, auto-pulled via Ollama during onboard. It's a Solana-tuned model that understands Pump-Fun mechanics, token launches, DeFi strategies, and wallet narration out of the box.

### Setup

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull DeepSolana (happens automatically during onboard)
ollama pull 8bit/DeepSolana

# Verify it's running
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"8bit/DeepSolana","messages":[{"role":"user","content":"What is Pump-Fun?"}]}'
```

### Model Options

| Option | How to select |
|---|---|
| **8bit/DeepSolana** (default) | Auto-selected when Ollama is detected |
| **NVIDIA Cloud** (Nemotron 120B) | Select "NVIDIA Cloud API" during onboard |
| **Any Ollama model** | `ollama pull <model>` then update inference route |
| **vLLM** | Set `NEMOCLAW_EXPERIMENTAL=1`, run vLLM on port 8000 |

### Switching Models

```bash
# Pull any model
ollama pull llama3

# Update the inference route
openshell inference set --no-verify --provider ollama-local --model llama3

# Or use NVIDIA Cloud
openshell provider create --name nvidia --type openai \
  --credential "OPENAI_API_KEY=nvapi-YOUR-KEY" \
  --config "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1"
openshell inference set --provider nvidia --model nvidia/llama-3.3-70b-instruct
```

---

## 🐳 Sandbox

NemoClaw runs inside a hardened OpenShell sandbox container. The sandbox is created from the community `openclaw` image and includes all Solana tooling pre-installed.

### Creating a Sandbox

```bash
# Automated (during onboard)
nemoclaw onboard

# Manual
openshell sandbox create --name deep-solana --from openclaw
```

### What's Inside

The sandbox container includes:
- **Solana CLI v3.1.9 via Agave installer** — Full Solana toolchain
- **helius-cli** — Helius RPC direct access
- **OpenClaw 2026.3.x** — Agent framework
- **Python 3.13** — For custom scripts
- **Node.js 20+** — For bot runtimes

On Apple Silicon hosts, OpenShell builds the sandbox as Linux `arm64`. Agave does not currently publish Linux `arm64` CLI installers, so `solana`, `solana-test-validator`, and `spl-token` may be skipped in that sandbox image while the rest of NemoClaw still works.
- **43 DeFi persona JSONs** — Agent personalities
- **Pump-Fun SDK** — Token operations
- **Privy wallet skill** — Encrypted key management

### Sandbox Network Policies

Every outbound request from the sandbox is governed by policy. Pre-configured presets:

| Preset | Endpoints Allowed |
|---|---|
| `solana-rpc` | Solana mainnet/devnet/testnet, Helius, Alchemy, QuikNode |
| `pumpfun` | pump.fun APIs, Jupiter aggregator, DexScreener |
| `privy` | Privy auth + wallet + policy APIs |
| `telegram` | Telegram Bot API |
| `ollama` | Local Ollama on `host.openshell.internal:11434` |
| `npm` | npm registry |
| `pypi` | Python package index |

---

## 🔐 Wallet Commands

Create and manage encrypted Privy agentic wallets without running the full onboard:

```bash
nemoclaw wallet create    # → Prompts for Privy creds → creates Solana wallet
nemoclaw wallet list      # → Shows all wallets with addresses and chain types
nemoclaw wallet status    # → Privy config, wallet count, default address
```

Private keys **never leave Privy infrastructure** and are **never stored locally**.
Default spending policy: **0.1 SOL per transaction** (configurable).

---

## 📡 Telegram Bot

When the bridge is running, your agent speaks on Telegram:

```
🟢 Wallet Buy Detected

Our agent wallet just spent 0.05 SOL to buy a token.
Token: 4xKp...9nZe
Amount: 1,250,000
Provider: Helius RPC
View on Solscan →
```

### Commands

| Command | Response |
|---|---|
| `/start` | Welcome + capabilities overview |
| `/balance` | SOL balance + top 8 token holdings |
| `/holdings` | Detailed token positions |
| `/status` | Uptime, transactions narrated, RPC provider, Privy status |
| `/wallet` | Wallet address (copyable) |
| `/rpc` | Current RPC endpoint and version |
| `/lasttrade` | Re-narrate the most recent detected event |

### Event Types

| Icon | Event | Example narration |
|---|---|---|
| 🟢 | **Buy** | "Our agent wallet just spent **0.05 SOL** to buy a token" |
| 🔴 | **Sell** | "Our agent wallet just sold tokens and realized **0.12 SOL**" |
| 💰 | **Received** | "The wallet received **1.5 SOL** from `4xKp...9nZe`" |
| 📤 | **Sent** | "The wallet sent **0.01 SOL** to `7bRq...2mXf`" |
| 🪙 | **Token** | "The wallet changed a token balance" |
| ⚡ | **Program** | "The wallet executed an on-chain program interaction" |

---

## 🛠️ All Commands

### Global

```bash
nemoclaw onboard                   # Full 9-step setup wizard
nemoclaw solana                    # Solana status + available commands
nemoclaw solana start              # One-shot: bridge + telegram-bot + relay
nemoclaw wallet create             # Create encrypted Privy wallet
nemoclaw wallet list               # List all wallets
nemoclaw wallet status             # Wallet + Privy configuration
nemoclaw list                      # List all sandboxes
nemoclaw start / stop / status     # Manage auxiliary services
nemoclaw deploy <instance>         # Deploy to Brev GPU VM
```

### Per-Sandbox

```bash
nemoclaw <name> connect            # Open sandbox shell
nemoclaw <name> solana-stack       # Start bridge + bot + relay together
nemoclaw <name> solana-agent       # Pump-Fun tracker bot
nemoclaw <name> solana-bridge      # Natural-language Telegram narration
nemoclaw <name> telegram-bot       # Telegram monitor + REST API
nemoclaw <name> payment-app        # Payment-gated agent
nemoclaw <name> swarm-bot          # Pump-Fun swarm dashboard
nemoclaw <name> websocket-server   # Real-time launch relay
nemoclaw <name> status             # Sandbox + Solana + wallet health
nemoclaw <name> logs --follow      # Stream logs
nemoclaw <name> policy-add         # Add network policy preset
nemoclaw <name> policy-list        # Show applied presets
nemoclaw <name> destroy            # Tear down sandbox + NIM
```

### Inside the Sandbox

```bash
solana config set --url <rpc>      # Set RPC endpoint
solana balance                     # Check SOL balance
solana transfer <to> <amount>      # Send SOL
solana-keygen new                  # Generate keypair
solana deploy <program.so>         # Deploy a program
solana-test-validator              # Local validator (Pump programs cloned)
spl-token create-token             # Create SPL token
spl-token mint <mint> <amount>     # Mint tokens
helius-cli                         # Helius RPC tools
```

---

## 🏗️ Architecture

```
                                 ┌──────────────────────┐
                                 │   nemoclaw CLI       │
                                 │   (host machine)     │
                                 └─────────┬────────────┘
                                           │
                     ┌─────────────────────▼─────────────────────┐
                     │          OpenShell Gateway                  │
                     │     (network policy + inference routing)   │
                     └─────────────────────┬─────────────────────┘
                                           │
           ┌───────────────────────────────▼──────────────────────────────┐
           │                   Sandbox Container                          │
           │              (Landlock + seccomp + netns)                    │
           │                                                              │
           │   ┌──────────────┐ ┌───────────────┐ ┌──────────────┐      │
           │   │ Telegram Bot  │ │ Solana Bridge  │ │  WS Relay    │      │
           │   │  (monitor)    │ │ (narration)    │ │ (launches)   │      │
           │   └──────┬────────┘ └──────┬────────┘ └──────┬───────┘      │
           │          └────────┬────────┘                  │              │
           │                   ▼                           │              │
           │          ┌─────────────────┐                  │              │
           │          │  OpenClaw Agent  │◄─────────────────┘              │
           │          │                 │                                  │
           │          │  ├─ 8bit/DeepSolana  (Ollama — auto-pulled)       │
           │          │  ├─ Privy Wallet Skill (sign / send / policy)     │
           │          │  ├─ Pump-Fun SDK     (@nirholas/pump-sdk)         │
           │          │  ├─ 43 DeFi Agent Personas                        │
           │          │  └─ Solana CLI + helius-cli                        │
           │          └─────────────────┘                                  │
           └───────────────────────────────────────────────────────────────┘
                                           │
                     ┌─────────────────────▼─────────────────────┐
                     │                 Ollama                      │
                     │     8bit/DeepSolana (localhost:11434)       │
                     │     Solana-tuned LLM — runs on CPU or GPU  │
                     └────────────────────────────────────────────┘
```

---

## 🛡️ Security

### Protection Layers

| Layer | What it protects | Enforcement |
|---|---|---|
| **Network** | Blocks unauthorized outbound connections | Hot-reloadable |
| **Filesystem** | Prevents access outside `/sandbox` and `/tmp` | At creation |
| **Process** | Blocks privilege escalation + dangerous syscalls | At creation |
| **Inference** | Routes model calls through controlled gateway | Hot-reloadable |
| **Wallet** | Private keys managed by Privy, never in sandbox | Always |
| **Credentials** | `~/.nemoclaw/` with mode 600 | Always |
| **Pre-commit** | Git hook blocks API keys, tokens, secret files | On commit |

### Secret Protection

- `.gitignore` blocks `.env`, `.npmrc`, `credentials.json`, `*.keypair`, `privy.json`, `helius.json`
- Pre-commit hook rejects commits containing `nvapi-*`, `sk-*`, `ghp_*`, `AKIA*`, bot tokens
- API keys only injected at runtime from `~/.nemoclaw/` (mode 600)
- Wallet private keys stay in Privy — zero local exposure

---

## 🧠 Knowledge Workspace

Inside the sandbox, the agent has **local access** to the full Pump-Fun corpus — no external fetching needed:

```
~/.openclaw/workspace/
├── AGENTS.md                        # Agent identity + Solana capabilities
├── skills/privy/SKILL.md            # Privy wallet skill (create/sign/send/policy)
└── pumpfun/
    ├── docs/                        # Protocol + SDK documentation
    ├── agent-app/                   # Tracker bot (payments, claims, buybacks)
    ├── telegram-bot/                # Telegram monitor runtime
    ├── pumpkit/                     # PumpKit packages + 6 tutorials
    ├── defi-agents/                 # 43 DeFi persona JSONs (18 locales each)
    ├── tokenized-agents-skill/      # @pump-fun/agent-payments-sdk guide
    ├── x402/                        # HTTP 402 Solana micropayment protocol
    ├── swarm-bot/                   # Multi-bot orchestration + strategies
    ├── websocket-server/            # Real-time launch relay
    ├── agent-prompts/               # PumpKit build prompts
    └── agent-tasks/                 # Scoped task specs + deliverables
```

### DeFi Agent Personas (43 total)

<details>
<summary>Click to see all 43 personas</summary>

| Category | Personas |
|---|---|
| **Trading** | Airdrop Hunter · Alpha Leak Detector · Whale Watcher · MEV Protection Advisor · DEX Aggregator Optimizer |
| **Risk & Analysis** | DeFi Risk Scoring Engine · Liquidation Risk Manager · Impermanent Loss Calculator · Smart Contract Auditor · Bridge Security Analyst |
| **Yield** | DeFi Yield Farmer · Yield Dashboard Builder · Yield Sustainability Analyst · Staking Rewards Calculator · Liquidity Pool Analyzer |
| **Portfolio** | Portfolio Rebalancing Advisor · Token Unlock Tracker · Wallet Security Advisor |
| **Research** | Crypto News Analyst · Narrative Trend Analyst · Protocol Revenue Analyst · Protocol Treasury Analyst · Governance Proposal Analyst |
| **Education** | DeFi Onboarding Mentor · APY vs APR Educator · Layer2 Comparison Guide · Gas Optimization Expert · Stablecoin Comparator |
| **Tax & Compliance** | Crypto Tax Strategist · DeFi Insurance Advisor |
| **Protocol-Specific** | Pump-Fun SDK Expert · NFT Liquidity Advisor · SPA Tokenomics Analyst · USDS Stablecoin Expert · Vespa Optimizer |
| **Sperax Suite** | Sperax Bridge · Governance · Liquidity · Onboarding · Portfolio · Risk · Yield |
| **DeFi Protocol** | DeFi Protocol Comparator |

</details>

---

## 🔧 Development

```bash
# Clone
git clone https://github.com/x402agent/NemoClaw.git
cd NemoClaw
npm install

# Build plugin
npm run build:plugin

# Run tests
npm test

# Audit tracked files and package metadata before a public push
npm run public:audit

# Check what gets published
npm run pack:check

# Full release check (build + test + pack)
npm run release:check

# Publish
npm run publish:public
```

---

## 📚 Learn More

### Bundled Stack

| Component | Description |
|---|---|
| [Telegram Bot](./Pump-Fun/telegram-bot) | Launch monitoring, graduation alerts, whale detection, REST API |
| [PumpKit](./Pump-Fun/pumpkit) | Monorepo: monitor, tracker, claim, channel, web packages + 6 tutorials |
| [Agent App](./Pump-Fun/agent-app) | Tracker bot, payment-gated invocation, invoice flow |
| [DeFi Agents](./Pump-Fun/packages/defi-agents) | 43 persona JSONs with 18 locale translations each |
| [Tokenized Agents](./pump-fun-skills-main/tokenized-agents) | @pump-fun/agent-payments-sdk implementation guide |
| [x402 Protocol](./Pump-Fun/x402) | HTTP 402 micropayment protocol for Solana |
| [Swarm Bot](./Pump-Fun/swarm-bot) | Multi-bot dashboard: sniper, momentum, market-maker strategies |
| [WebSocket Server](./Pump-Fun/websocket-server) | Real-time Pump launch relay |
| [Protocol Docs](./Pump-Fun/docs) | SDK reference, deployment guides, architecture |

### Reference Docs

- [CLI Commands Reference](./docs/reference/commands.md)
- [Inference Profiles](./docs/reference/inference-profiles.md)
- [Network Policies](./docs/reference/network-policies.md)

---

## License

Licensed under [Apache 2.0](LICENSE).
