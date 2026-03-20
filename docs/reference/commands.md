---
title:
  page: "NemoClaw CLI Commands Reference"
  nav: "Commands"
description: "Full CLI reference for plugin and standalone NemoClaw commands."
keywords: ["nemoclaw cli commands", "nemoclaw command reference", "solana agent cli", "privy wallet"]
topics: ["generative_ai", "ai_agents", "solana"]
tags: ["openclaw", "openshell", "nemoclaw", "cli", "solana", "pump-fun", "privy"]
content:
  type: reference
  difficulty: technical_beginner
  audience: ["developer", "engineer"]
status: published
---

<!--
  SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  SPDX-License-Identifier: Apache-2.0
-->

# Commands

NemoClaw provides two command interfaces.
The plugin commands run under the `openclaw nemoclaw` namespace inside the OpenClaw CLI.
The standalone `nemoclaw` binary handles host-side setup, deployment, Solana integration, and service management.
Both interfaces are installed when you run `npm install -g @mawdbotsonsolana/nemoclaw`.

## Quick Start

### `nemoclaw solana`

One-shot command that shows your Solana configuration status and lists all available actions.
If no sandbox exists, it runs the full onboard wizard automatically.

```console
$ nemoclaw solana
```

### `nemoclaw doctor`

Run a host-side diagnostic pass before onboarding or going live.

```console
$ nemoclaw doctor
```

This checks:

- Node.js and npm versions
- Docker CLI and daemon availability
- OpenShell installation state
- sandbox registry state
- Solana RPC, Privy wallet, Telegram token, and Helius configuration

### `nemoclaw onboard`

Run the **9-step** interactive setup wizard.
The wizard creates an OpenShell gateway, registers inference providers, builds the sandbox image, configures Solana RPC, sets up a Privy agentic wallet, and optionally starts a local test-validator.

```console
$ nemoclaw onboard
```

**Onboard steps:**
1. Preflight checks (Docker, OpenShell, GPU detection)
2. Start OpenShell gateway
3. Create sandbox (builds Docker image with Solana CLI + Pump-Fun SDK)
4. Configure inference (NIM / NVIDIA Cloud / Ollama / vLLM)
5. Set up inference provider
6. Set up OpenClaw inside sandbox
7. **Solana & Wallet Configuration** — RPC URL, Privy agentic wallet, Pump-Fun token
8. **Solana test-validator** — optional local validator with cloned Pump programs
9. Policy presets (auto-detects solana-rpc, pumpfun, privy, telegram)

## Plugin Commands

### `openclaw nemoclaw launch`

Bootstrap OpenClaw inside an OpenShell sandbox.
If NemoClaw detects an existing host installation, `launch` stops unless you pass `--force`.

```console
$ openclaw nemoclaw launch [--force] [--profile <profile>]
```

`--force`
: Skip the ergonomics warning and force plugin-driven bootstrap. Without this flag,
  NemoClaw recommends using `openshell sandbox create` directly for new installs.

`--profile <profile>`
: Blueprint profile to use. Default: `default`.

### `openclaw nemoclaw status`

Display sandbox health, blueprint run state, and inference configuration.

```console
$ openclaw nemoclaw status [--json]
```

### `openclaw nemoclaw logs`

Stream blueprint execution and sandbox logs.

```console
$ openclaw nemoclaw logs [-f] [-n <count>] [--run-id <id>]
```

### `/nemoclaw` Slash Command

| Subcommand | Description |
|---|---|
| `/nemoclaw status` | Show sandbox and inference state |

## Standalone Host Commands

### Solana Quick Start

#### `nemoclaw solana`

Show the Solana quick-start overview for the default sandbox.

```console
$ nemoclaw solana
```

This prints the active RPC, wallet, and the recommended Solana runtime commands.

#### `nemoclaw solana start [sandbox]`

Run the one-shot Solana startup flow.

```console
$ nemoclaw solana start my-assistant
```

This launches the bundled Solana operator stack inside the sandbox:

- Pump-Fun Telegram bot + API
- natural-language Solana wallet bridge
- realtime websocket relay
- wallet heartbeat and vault logging

If no sandbox exists yet, NemoClaw runs `onboard` first and then starts the stack.

#### `nemoclaw wallet [create|list|status]`

Manage the Privy-backed Solana wallet used by the agent.

```console
$ nemoclaw wallet create
$ nemoclaw wallet list
$ nemoclaw wallet status
```

`create` provisions a Privy-managed Solana wallet and can optionally create a default
spending policy. `list` shows locally known wallet records, and `status` prints the
current Privy, wallet, and RPC configuration.

### Sandbox Management

#### `nemoclaw <name> connect`

Open an interactive shell inside the sandbox. The sandbox includes Solana CLI tools,
Pump-Fun SDK, `helius`, and the Privy agentic wallet skill.

```console
$ nemoclaw my-assistant connect
```

#### `nemoclaw <name> status`

Show sandbox status, health, inference config, Solana RPC, and wallet info.

```console
$ nemoclaw my-assistant status
```

#### `nemoclaw <name> logs`

View sandbox logs. Use `--follow` to stream output in real time.

```console
$ nemoclaw my-assistant logs [--follow]
```

#### `nemoclaw <name> destroy`

Stop the NIM container and delete the sandbox.

```console
$ nemoclaw my-assistant destroy
```

### Solana Agent Commands

#### `nemoclaw <name> solana-stack`

Start the Solana operator stack inside the sandbox.

```console
$ nemoclaw my-assistant solana-stack
```

This is the sandbox-scoped equivalent of `nemoclaw solana start`.
The stack writes service and runtime records to `~/.nemoclaw/vault/`.

#### `nemoclaw <name> solana-agent`

Run the Pump-Fun Solana tracker bot inside the sandbox.
Monitors agent payments, creator fee claims, and token buybacks on-chain,
sending real-time Telegram notifications.

```console
$ nemoclaw my-assistant solana-agent
```

**Required env:** `AGENT_TOKEN_MINT_ADDRESS`, `DEVELOPER_WALLET`, `TELEGRAM_BOT_TOKEN`
**Optional env:** `SOLANA_RPC_URL`, `SOLANA_WS_URL`, `HELIUS_API_KEY`, `CURRENCY_MINT`, `PRICE_AMOUNT`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`

The bot also supports sub-modes inside the sandbox:

```console
$ nemoclaw-solana-agent bot              # Default: start tracker bot
$ nemoclaw-solana-agent test-validator   # Start local validator with Pump programs
$ nemoclaw-solana-agent status           # Show Solana + wallet status
```

#### `nemoclaw <name> solana-bridge`

Real-time Solana-Telegram bridge that monitors wallet activity and narrates it in natural language.
Detects incoming/outgoing transfers, buys, sells, token balance changes, and program interactions.

```console
$ nemoclaw my-assistant solana-bridge
```

**Required env:** `TELEGRAM_BOT_TOKEN`
**Optional env:** `SOLANA_RPC_URL`, `SOLANA_WS_URL`, `HELIUS_API_KEY`, `DEVELOPER_WALLET`, `AGENT_TOKEN_MINT_ADDRESS`, `TELEGRAM_NOTIFY_CHAT_IDS`, `PRIVY_APP_ID`, `NEMOCLAW_VAULT_DIR`, `HEARTBEAT_SECONDS`, `MIN_WALLET_SOL`, `STOP_BALANCE_SOL`

The bridge is broadcast-oriented and is designed to coexist with the main Pump-Fun Telegram bot without polling conflicts. It pushes narrated wallet activity to `TELEGRAM_NOTIFY_CHAT_IDS`, records heartbeat snapshots and wallet activity to the NemoClaw vault, and marks funded or protection state from wallet balance thresholds while the primary bot continues handling interactive commands.

#### `nemoclaw <name> telegram-bot`

Run the Pump-Fun Telegram monitor bot with full API and event filtering.

```console
$ nemoclaw my-assistant telegram-bot
```

#### `nemoclaw <name> payment-app`

Run the payment-gated Pump-Fun agent app (Next.js).

```console
$ nemoclaw my-assistant payment-app
```

#### `nemoclaw <name> swarm-bot`

Run the Pump-Fun swarm dashboard.

```console
$ nemoclaw my-assistant swarm-bot
```

#### `nemoclaw <name> websocket-server`

Run the Pump-Fun WebSocket relay server.

```console
$ nemoclaw my-assistant websocket-server
```

### Policy Presets

#### `nemoclaw <name> policy-add`

Add a policy preset to a sandbox.

```console
$ nemoclaw my-assistant policy-add
```

Available presets include:

| Preset | Description |
|---|---|
| `solana-rpc` | Solana RPC providers (mainnet, devnet, testnet, Helius, Alchemy, QuikNode) |
| `pumpfun` | Pump.fun APIs, Jupiter aggregator, DexScreener |
| `privy` | Privy agentic wallet APIs (auth, policies, transaction signing) |
| `telegram` | Telegram Bot API |
| `pypi` | Python package index |
| `npm` | npm registry |

#### `nemoclaw <name> policy-list`

List available presets and show which are applied.

```console
$ nemoclaw my-assistant policy-list
```

### Deploy

#### `nemoclaw deploy <instance>`

Deploy to a remote Brev GPU instance.

```console
$ nemoclaw deploy my-gpu-box
```

### Services

#### `nemoclaw start`

Start auxiliary services (Telegram bridge, cloudflared tunnel).

```console
$ nemoclaw start
```

#### `nemoclaw stop`

Stop all auxiliary services.

```console
$ nemoclaw stop
```

#### `nemoclaw status`

Show sandbox list and service status.

```console
$ nemoclaw status
```

### Infrastructure

#### `nemoclaw setup-spark`

Set up NemoClaw on DGX Spark (cgroup v2 + Docker fixes for Ubuntu 24.04).

```console
$ sudo nemoclaw setup-spark
```

## Sandbox Solana Tooling

When connected to a sandbox (`nemoclaw <name> connect`), the following tools are available:

### Solana CLI

```console
$ solana config set --url <rpc>          # Set RPC endpoint
$ solana balance                          # Check SOL balance
$ solana transfer <to> <amount>           # Send SOL
$ solana-keygen new                       # Generate a new keypair
$ solana deploy <program.so>              # Deploy a program
$ solana-test-validator                    # Run local test-validator
```

### SPL Token

```console
$ spl-token create-token                  # Create a new SPL token
$ spl-token create-account <mint>         # Create a token account
$ spl-token mint <mint> <amount>          # Mint tokens
$ spl-token transfer <mint> <amount> <to> # Transfer tokens
```

### Helius CLI

```console
$ helius                                  # Helius RPC CLI tools
```

### Privy Agentic Wallet

The Privy skill is available to the OpenClaw agent inside the sandbox.
Ask the agent to:

- "Create a Solana wallet for me using Privy"
- "Check my wallet balance"
- "Create a spending policy that limits to 0.1 SOL per transaction"
- "Send 0.01 SOL to `<address>`"

Private keys are managed by Privy — they never leave Privy's infrastructure
and are never stored in the sandbox.
