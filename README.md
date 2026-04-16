<p align="center">
  <strong>🦀 NemoClawd</strong><br/>
  <em>Autonomous Solana Trading Agent — Sandboxed, Wallet-Enabled, Telegram-Native</em>
</p>
8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump
<p align="center">
  <a href="https://www.npmjs.com/package/@mawdbotsonsolana/nemoclaw"><img src="https://img.shields.io/npm/v/@mawdbotsonsolana/nemoclaw.svg?style=flat-square&color=cb3837" alt="npm"></a>
  <a href="https://github.com/x402agent/NemoClaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status">
  <img src="https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/Telegram-Bot-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram">
  <img src="https://img.shields.io/badge/Ollama-DeepSolana-000000?style=flat-square&logo=ollama&logoColor=white" alt="DeepSolana">
  <img src="https://img.shields.io/badge/8004-Agent_Registry-7c5cfc?style=flat-square" alt="8004 Registry">
</p>

---

NemoClaw turns an AI model into a **fully autonomous Solana agent** that trades tokens, manages its own encrypted wallet, and narrates everything it does in natural language on Telegram — all running inside a hardened [OpenShell](https://github.com/NVIDIA/OpenShell) sandbox where every network request, file access, and on-chain transaction is governed by policy.

**Live on npm:** `@mawdbotsonsolana/nemoclaw@0.4.2`

```bash
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw launch
```

**Two commands. Zero raw keys. Fastest path to a live Solana operator.**

> **Alpha** — Interfaces may change. We welcome issues and feedback.

---

## What Shipped Today

### npm Release

The current public package is:

```bash
npm install -g @mawdbotsonsolana/nemoclaw@0.4.2
```

### New in `0.4.2`

- `nemoclaw launch` is now the fastest path: it runs `doctor`, onboards if needed, and starts the best available stack automatically.
- `nemoclaw doctor` gives a host-side preflight for Node/npm, Docker, OpenShell, sandbox state, RPC, Privy, wallet, Telegram, and Helius.
- Launch now degrades cleanly to relay-only mode when `TELEGRAM_BOT_TOKEN` is not configured instead of failing the full flow.
- The installer now targets the published scoped npm package instead of stale git-based install paths.
- The README, docs, landing page, and command help were aligned around the new one-shot developer flow.

---

## One Shot on Mac

If you want the fastest developer path on macOS, use this exact flow:

```bash
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw launch
```

If the OpenShell gateway has stopped but the cluster still exists:

```bash
docker start openshell-cluster-nemoclaw
```

If you want a dry run before onboarding, use:

```bash
nemoclaw doctor
```

It checks your Node/npm runtime, Docker daemon, OpenShell install, sandbox registry, wallet state, and Solana credentials, then prints the next recommended command.

`nemoclaw launch` runs that diagnostic automatically, onboards if needed, and then starts the best available stack:
- full Telegram + bridge + relay mode if `TELEGRAM_BOT_TOKEN` is configured
- relay-only mode if you just want to get the sandbox and Solana services up fast

## Deploy NemoClaw on Fly.io

To deploy NemoClaw to Fly.io, run the deploy script. It handles everything — app creation, volumes, secrets, and deployment.

```bash
cd nemoclaw
bash deploy/fly/deploy.sh
```

You'll need `flyctl` installed, a Fly.io account (free trial works), and an LLM API key (Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax).

### How it works

The deploy script sets up a wrapper server that manages the NemoClaw gateway and provides a browser-based setup wizard:

```
Internet → Fly.io proxy → Wrapper server (:3000) → NemoClaw gateway (:18789)
                              ├── /setup      → Setup wizard (password-protected)
                              ├── /healthz    → Health check (no auth)
                              └── /*          → Proxied to gateway
```

All state lives on a persistent volume mounted at `/data`, so your configuration, conversation history, wallets, and installed tools survive restarts and redeployments.

The script will prompt you for:

- **App name** — defaults to `nemoclaw-XXXX` (random suffix). This becomes your URL: `https://your-app-name.fly.dev`
- **Region** — where to run your Machine (defaults to `iad` / Virginia). Pick one close to you for lower latency. See [Fly.io regions](https://fly.io/docs/reference/regions/) for the full list.
- **Setup password** — protects the `/setup` wizard from the internet. Pick something strong.
- **LLM provider** — choose from Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax
- **LLM API key** — the key for your chosen provider
- **Channel tokens** (optional) — Discord bot token, Telegram bot token, or Slack bot + app tokens
- **Solana config** (optional) — RPC URL, Helius API key, Privy App ID/Secret for agentic wallets

The script then creates a Fly app, provisions a persistent volume, sets your credentials as encrypted Fly secrets, and builds and deploys the Docker image on Fly's remote builders. The first deploy takes a few minutes. Your credentials never leave your machine — they go directly to Fly.io via `flyctl`.

### Post-deploy setup

Once deployment completes, the script prints your app details:

```
=== Deployment Complete ===

  App URL:       https://your-app-name.fly.dev
  Setup wizard:  https://your-app-name.fly.dev/setup
  Gateway URL:   wss://your-app-name.fly.dev
  Gateway token: <your-generated-token>
```

#### Setup wizard

Visit `https://your-app-name.fly.dev/setup` in your browser. Log in with any username and the setup password you chose. From the wizard you can:

- Change your LLM provider and API key
- Configure Solana RPC, Helius, and Privy wallet credentials
- Add or update Discord, Telegram, and Slack channel connections
- Edit the raw NemoClaw config
- View gateway logs
- Export and import configuration backups

#### Connect your local CLI

If you have OpenClaw installed locally, point it at your remote gateway:

```bash
openclaw config set gateway.mode remote
openclaw config set gateway.remote.url wss://your-app-name.fly.dev
openclaw config set gateway.remote.token <your-gateway-token>
openclaw health  # verify the connection
```

This lets you use the `openclaw` CLI on your laptop while the gateway runs on Fly.io, keeping conversations and state persistent even when your laptop is closed.

### Configuration

#### Secrets

All sensitive values are stored as Fly secrets, encrypted at rest and injected as environment variables at boot. They are never visible in logs, config files, or the Fly dashboard.

| Secret | Required | Description |
|--------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Protects the `/setup` wizard with HTTP Basic Auth |
| `NEMOCLAW_GATEWAY_TOKEN` | Yes | Auth token for gateway connections (auto-generated) |
| `NEMOCLAW_API_KEY` | Yes | Your LLM provider API key |
| `NEMOCLAW_AUTH_CHOICE` | Yes | Provider identifier (set by deploy script) |
| `NEMOCLAW_DISCORD_TOKEN` | No | Discord bot token |
| `NEMOCLAW_TELEGRAM_TOKEN` | No | Telegram bot token |
| `NEMOCLAW_SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) |
| `NEMOCLAW_SLACK_APP_TOKEN` | No | Slack app token (`xapp-...`, required if bot token is set) |
| `SOLANA_RPC_URL` | No | Custom Solana RPC endpoint |
| `HELIUS_API_KEY` | No | Helius RPC API key |
| `PRIVY_APP_ID` | No | Privy agentic wallet app ID |
| `PRIVY_APP_SECRET` | No | Privy agentic wallet app secret |

To update a secret after deployment:

```bash
fly secrets set NEMOCLAW_API_KEY=sk-new-key-here -a your-app-name
```

The Machine restarts automatically when secrets change.

#### VM sizing

The default configuration uses a `shared-cpu-2x` Machine with 4 GB RAM, which costs roughly $20-25/month when running continuously. With auto-stop enabled (the default), you only pay for time the Machine is actually running.

```bash
fly scale memory 4096 -a your-app-name
fly scale vm shared-cpu-4x -a your-app-name
```

#### Persistent storage

NemoClaw stores all state on a Fly Volume mounted at `/data`. This includes:

- `nemoclaw.json` — wrapper configuration
- `.openclaw/` — gateway configuration, conversation history, context
- `.nemoclaw/wallets/` — wallet data (encrypted)
- `.nemoclaw/vault/` — append-only JSONL trade and heartbeat logs
- npm/pnpm caches for user-installed packages

The default volume size is 1 GB. To extend it:

```bash
fly volumes extend <volume-id> -s 3 -a your-app-name
```

### Useful commands

| Command | Description |
|---------|-------------|
| `fly logs -a your-app-name` | Stream live logs |
| `fly ssh console -a your-app-name` | SSH into the Machine |
| `fly apps restart your-app-name` | Restart after config changes |
| `fly scale memory 4096 -a your-app-name` | Increase memory |
| `fly status -a your-app-name` | Check Machine status |
| `fly volumes list -a your-app-name` | List attached volumes |

### Troubleshooting

**"SETUP_PASSWORD is not set"** — The setup password secret is missing:

```bash
fly secrets set SETUP_PASSWORD=your-password -a your-app-name
```

**Out of memory / crashes** — Increase the Machine's memory:

```bash
fly scale memory 4096 -a your-app-name
```

**Gateway won't start** — Visit `/setup` in your browser and check the logs section. Common causes: invalid API key, missing config file, or corrupted state.

**Lock file errors** — If the gateway didn't shut down cleanly:

```bash
fly ssh console -a your-app-name
rm -f /data/gateway.*.lock
exit
fly apps restart your-app-name
```

**Need to start fresh** — Use the "Reset" button in the setup wizard, or SSH in and remove the config:

```bash
fly ssh console -a your-app-name
rm /data/nemoclaw.json
exit
fly apps restart your-app-name
```

### Supported LLM providers

| Provider | What you need |
|----------|---------------|
| Anthropic | API key from [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | API key from [platform.openai.com](https://platform.openai.com) |
| NVIDIA | API key from [build.nvidia.com](https://build.nvidia.com) |
| Google Gemini | API key from [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | API key from [openrouter.ai](https://openrouter.ai) |
| Moonshot AI | API key from Moonshot's developer portal |
| MiniMax | API key from MiniMax's developer portal |

You can switch providers at any time through the setup wizard — no redeployment needed.

---

## Copy-Paste `SKILL.md`

Paste [`SKILL.md`](./SKILL.md) into Claude, Codex, Cursor, or any agent that supports repo or system skills.

That gives the agent a drop-in operating guide for:
- launching NemoClaw locally on macOS
- keeping secrets out of git and logs
- using Privy-managed wallets and runtime environment variables
- recovering the OpenShell gateway safely

This is the public developer path to feature at `nemo.nanosolana.com`: one-shot local launch on Mac, plus one skill file your agent can immediately use.

---

## What You Get

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DeepSolana Model ─── 8bit/DeepSolana via Ollama.              │
│   │                     Solana-tuned LLM. Auto-pulled.          │
│   │                                                             │
│   Encrypted Wallet ──── Privy server wallet. Private keys       │
│   │                     never leave Privy infrastructure.        │
│   │                                                             │
│   Telegram Bridge ───── Natural-language narration of every      │
│   │                     trade, transfer, and interaction.        │
│   │                                                             │
│   Pump-Fun SDK ──────── Token creation, trading, claims,        │
│   │                     buybacks, PumpKit monorepo, x402.        │
│   │                                                             │
│   8004 Agent Registry ─ On-chain identity, ATOM reputation,     │
│   │                     heartbeat liveness, trust tiers.         │
│   │                                                             │
│   Ops Dashboard ─────── Real-time process management, log       │
│   │                     streaming, service health monitoring.    │
│   │                                                             │
│   43 DeFi Personas ──── Yield farmer, whale watcher, MEV        │
│   │                     advisor, risk engine, tax strategist.    │
│   │                                                             │
│   Sandboxed ──────────── Landlock + seccomp + netns via          │
│                          NVIDIA OpenShell. Deny-all default.     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

<!-- start-quickstart-guide -->
## Quick Start

### Install

```bash
npm install -g @mawdbotsonsolana/nemoclaw
```

> Requires: **Node.js 20+**, **Docker**, **Linux** (Ubuntu 22.04+). macOS works for CLI management; the sandbox runs in Docker.

### Validate the Machine

```bash
nemoclaw doctor
```

This is the fastest way to catch missing Docker, OpenShell, RPC, or wallet setup before you start onboarding.

### Fastest Launch

```bash
nemoclaw launch
```

This runs `doctor`, launches onboarding if no sandbox exists yet, and then starts the stack. If `TELEGRAM_BOT_TOKEN` is missing, NemoClaw falls back to relay-only mode instead of failing the entire launch.

### Onboard (one time)

```bash
nemoclaw onboard
```

The wizard walks through **9 steps**:

| Step | What happens |
|:---:|---|
| 1 | **Preflight** — Docker, OpenShell, GPU detection |
| 2 | **Gateway** — Start the OpenShell gateway |
| 3 | **Sandbox** — Build Docker image (Solana CLI v3.1.9, Pump-Fun SDK, 43 DeFi personas) |
| 4 | **Inference** — Auto-detects Ollama, pulls `8bit/DeepSolana`. Or pick NVIDIA Cloud / vLLM |
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
| **Telegram Monitor** | Pump-Fun alerts, launch tracking, graduation events, whale detection |
| **Wallet Bridge** | Natural-language narration of buys, sells, transfers, program interactions |
| **WebSocket Relay** | Real-time launch feed for dashboards and downstream bots |
| **Agent Registry** | 8004 on-chain registration + heartbeat liveness (default on) |
| Payment App | Payment-gated agent (enable: `START_PAYMENT_APP=true`) |
| Swarm Bot | Multi-bot orchestration dashboard (enable: `START_SWARM_BOT=true`) |

<!-- end-quickstart-guide -->

---

## Operations Dashboard

NemoClaw includes a real-time operations dashboard for monitoring all running services, viewing logs, and controlling processes.

### Start the Dashboard

```bash
cd Pump-Fun/dashboard
SANDBOX_NAME=nemo npx tsx src/server.ts
```

Opens at `http://localhost:18789`.

### Features

| Feature | Description |
|---|---|
| **System Overview** | Sandbox name, model, provider, wallet, RPC at a glance |
| **Process Cards** | Start/stop/restart any managed service from the browser |
| **Live Log Viewer** | Full-screen log viewer with stdout/stderr/system filtering |
| **Service Health** | Auto-polls Ollama, Telegram bot, WebSocket relay health endpoints |
| **Event Feed** | SSE-powered real-time stream of health changes, process events, errors |
| **Stats Row** | Running/stopped processes, healthy services, event count, uptime |

### Auto-detected Processes

The dashboard auto-discovers services from the `Pump-Fun/` directory:

- Telegram Bot (`telegram-bot/`)
- WebSocket Relay (`websocket-server/`)
- Agent App (`agent-app/`)
- Swarm Bot (`swarm-bot/`)

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Dashboard health check |
| `GET` | `/api/processes` | List all managed processes |
| `POST` | `/api/processes/:id/start` | Start a process |
| `POST` | `/api/processes/:id/stop` | Stop a process |
| `POST` | `/api/processes/:id/restart` | Restart a process |
| `GET` | `/api/processes/:id/logs` | Get process logs |
| `GET` | `/api/processes/:id/stream` | SSE log stream for a process |
| `GET` | `/api/services` | Service health summary |
| `GET` | `/api/events/stream` | SSE event stream (all services) |
| `GET` | `/api/stats` | Dashboard summary stats |

---

## 8004 Agent Registry

NemoClaw registers itself on the [8004 Trustless Agent Registry](https://github.com/QuantuLabs/8004-solana-ts) at deploy time, then heartbeats to maintain on-chain reputation via the ATOM engine.

### What Happens at Deploy

1. **Registration** — Creates an agent NFT on the 8004 registry with ATOM reputation enabled
2. **Pump.fun Verification** — Verifies the agent token mint exists on-chain
3. **Wallet Binding** — Sets the operational wallet on the registry entry
4. **Heartbeat** — Starts periodic liveness + uptime feedback

### Heartbeat

The heartbeat runs every 60 seconds (configurable) and:

- Checks Solana RPC health + latency
- Checks wallet SOL balance and token ownership
- Submits **uptime** and **responseTime** feedback to the 8004 registry every 15 minutes
- Warns when wallet balance drops below 0.01 SOL

### Enable On-chain Registration

Registration requires a Solana keypair for signing:

```bash
# Generate a keypair
solana-keygen new --outfile ~/.nemoclaw/agent-keypair.json

# Set the private key (JSON array format)
export SOLANA_PRIVATE_KEY='[1,2,3,...]'

# Optional: IPFS metadata via Pinata
export PINATA_JWT='your-pinata-jwt'
```

### Run Standalone

```bash
cd Pump-Fun/agent-registry
npm install
npm start              # Register + heartbeat
npm run register       # Registration only
npm run heartbeat      # Heartbeat only
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `SOLANA_PRIVATE_KEY` | — | JSON array of secret key bytes (required for on-chain registration) |
| `REGISTRY_CLUSTER` | `mainnet-beta` | `mainnet-beta` or `devnet` |
| `HEARTBEAT_INTERVAL_SECONDS` | `60` | Heartbeat tick interval |
| `HEARTBEAT_ENABLED` | `true` | Enable/disable heartbeat |
| `START_AGENT_REGISTRY` | `true` | Enable in solana-stack |
| `PINATA_JWT` | — | Pinata JWT for IPFS metadata upload |
| `AGENT_NAME` | `NemoClaw` | Agent display name in registry |

---

## Default Model: `8bit/DeepSolana`

NemoClaw ships with **8bit/DeepSolana** as the default inference model, auto-pulled via Ollama during onboard.

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
ollama pull llama3
openshell inference set --no-verify --provider ollama-local --model llama3
```

---

## Sandbox

NemoClaw runs inside a hardened OpenShell sandbox container with all Solana tooling pre-installed.

### What's Inside

- **Solana CLI v3.1.9** — Full Solana toolchain (x86_64 only; skipped on arm64)
- **helius-cli** — Helius RPC direct access
- **OpenClaw 2026.3.x** — Agent framework
- **Python 3.13 + Node.js 20+** — Bot runtimes
- **43 DeFi persona JSONs** — Agent personalities
- **Pump-Fun SDK** — Token operations
- **Privy wallet skill** — Encrypted key management

### Sandbox Network Policies

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

## Wallet Commands

```bash
nemoclaw wallet create    # Prompts for Privy creds, creates Solana wallet
nemoclaw wallet list      # Shows all wallets with addresses and chain types
nemoclaw wallet status    # Privy config, wallet count, default address
```

Private keys **never leave Privy infrastructure** and are **never stored locally**.

---

## Telegram Bot

### Commands

| Command | Response |
|---|---|
| `/start` | Welcome + capabilities overview |
| `/balance` | SOL balance + top 8 token holdings |
| `/holdings` | Detailed token positions |
| `/status` | Uptime, transactions narrated, RPC provider |
| `/wallet` | Wallet address (copyable) |
| `/watch` | Watch a fee recipient wallet |
| `/alerts` | Configure alert types per chat |
| `/monitor` | Start real-time token launch feed |
| `/price` | Token price + bonding curve info |
| `/fees` | Show fee tiers for a token |
| `/quote` | Buy/sell quote estimate |
| `/cto` | Creator Takeover lookup + stats |

---

## All Commands

### Global

```bash
nemoclaw onboard                   # Full 9-step setup wizard
nemoclaw solana                    # Solana status + available commands
nemoclaw solana start              # One-shot: bridge + bot + relay + registry
nemoclaw wallet create             # Create encrypted Privy wallet
nemoclaw wallet list               # List all wallets
nemoclaw list                      # List all sandboxes
nemoclaw deploy <instance>         # Deploy to Brev GPU VM
```

### Per-Sandbox

```bash
nemoclaw <name> connect            # Open sandbox shell
nemoclaw <name> solana-stack       # Start bridge + bot + relay + registry
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

---

## Architecture

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
           │          ┌─────────────────┐  ┌──────────────┐│              │
           │          │  OpenClaw Agent  │  │ Agent        ││              │
           │          │                 │  │ Registry +   ││              │
           │          │  ├─ DeepSolana  │  │ Heartbeat    │┘              │
           │          │  ├─ Privy       │  └──────┬───────┘               │
           │          │  ├─ Pump-Fun    │         │                       │
           │          │  ├─ 43 Personas │         ▼                       │
           │          │  └─ Solana CLI  │  ┌──────────────┐               │
           │          └─────────────────┘  │ 8004 On-chain│               │
           │                               │  Registry    │               │
           │   ┌────────────────────────┐  └──────────────┘               │
           │   │  Ops Dashboard :18789  │                                 │
           │   │  Processes / Logs / SSE│                                 │
           │   └────────────────────────┘                                 │
           └───────────────────────────────────────────────────────────────┘
                                           │
                     ┌─────────────────────▼─────────────────────┐
                     │                 Ollama                      │
                     │     8bit/DeepSolana (localhost:11434)       │
                     │     Solana-tuned LLM — runs on CPU or GPU  │
                     └────────────────────────────────────────────┘
```

---

## Security

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

- `.gitignore` blocks `.env`, `.npmrc`, `credentials.json`, `*.keypair`, `*.keypair.json`, `privy.json`, `helius.json`
- Pre-commit hook rejects commits containing `nvapi-*`, `sk-*`, `ghp_*`, `AKIA*`, bot tokens
- API keys only injected at runtime from `~/.nemoclaw/` (mode 600)
- Wallet private keys stay in Privy — zero local exposure
- Agent registry keypairs stored in `~/.nemoclaw/agent-keypair.json` (mode 600, gitignored)

---

## Bundled Stack

| Component | Description |
|---|---|
| [Telegram Bot](./Pump-Fun/telegram-bot) | Launch monitoring, graduation alerts, whale detection, REST API |
| [Dashboard](./Pump-Fun/dashboard) | Real-time ops dashboard with process management and log streaming |
| [Agent Registry](./Pump-Fun/agent-registry) | 8004 on-chain registration, ATOM reputation, heartbeat liveness |
| [PumpKit](./Pump-Fun/pumpkit) | Monorepo: monitor, tracker, claim, channel, web packages + 6 tutorials |
| [Agent App](./Pump-Fun/agent-app) | Tracker bot, payment-gated invocation, invoice flow |
| [DeFi Agents](./Pump-Fun/packages/defi-agents) | 43 persona JSONs with 18 locale translations each |
| [Tokenized Agents](./pump-fun-skills-main/tokenized-agents) | @pump-fun/agent-payments-sdk implementation guide |
| [x402 Protocol](./Pump-Fun/x402) | HTTP 402 micropayment protocol for Solana |
| [Swarm Bot](./Pump-Fun/swarm-bot) | Multi-bot dashboard: sniper, momentum, market-maker strategies |
| [WebSocket Server](./Pump-Fun/websocket-server) | Real-time Pump launch relay |
| [Protocol Docs](./Pump-Fun/docs) | SDK reference, deployment guides, architecture |

---

## License

Licensed under [Apache 2.0](LICENSE).
