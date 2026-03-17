# NVIDIA NemoClaw: Solana Pump-Fun Agent for OpenClaw + OpenShell

<!-- start-badges -->
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](https://github.com/NVIDIA/NemoClaw/blob/main/LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Report%20a%20Vulnerability-red)](https://github.com/NVIDIA/NemoClaw/blob/main/SECURITY.md)
[![Project Status](https://img.shields.io/badge/status-alpha-orange)](https://github.com/NVIDIA/NemoClaw/blob/main/docs/about/release-notes.md)
<!-- end-badges -->

NVIDIA NemoClaw is an open source stack for running sandboxed [OpenClaw](https://openclaw.ai) assistants safely on top of [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell). In this repo it is wired as a **Solana Pump-Fun agent environment**: the sandbox bundles the Pump-Fun tracker bot from [`Pump-Fun/agent-app`](./Pump-Fun/agent-app), the full Pump-Fun documentation corpus from [`Pump-Fun/docs`](./Pump-Fun/docs), and the PumpKit agent prompt/task packs so the agent starts with local Solana protocol context instead of a blank workspace.

> **Alpha software**
> 
> NemoClaw is early-stage. Expect rough edges. We are building toward production-ready sandbox orchestration, but the starting point is getting your own environment up and running.
> Interfaces, APIs, and behavior may change without notice as we iterate on the design.
> The project is shared to gather feedback and enable early experimentation, but it
> should not yet be considered production-ready.
> We welcome issues and discussion from the community while the project evolves.

---

## Quick Start

<!-- start-quickstart-guide -->

Follow these steps to get started with NemoClaw as a sandboxed Solana/Pump-Fun agent.

:::{note}
NemoClaw currently requires a fresh installation of OpenClaw.
:::

### Prerequisites

Check the prerequisites before you start to ensure you have the necessary software and hardware to run NemoClaw.

#### Software

- Linux Ubuntu 22.04 LTS releases and later
- Node.js 20+ and npm 10+ (the installer recommends Node.js 22)
- Docker installed and running
- [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) installed

### Install NemoClaw and Onboard the Sandbox

Download and run the installer script.
The script installs Node.js if it is not already present, then runs the guided onboard wizard to create a sandbox, configure inference, and apply security policies. During onboarding, NemoClaw can now suggest `solana-rpc`, `pumpfun`, and `telegram` presets when the relevant environment variables are present.

```console
$ curl -fsSL https://nvidia.com/nemoclaw.sh | bash
```

When the install completes, a summary confirms the running environment:

```
──────────────────────────────────────────────────
Sandbox      my-assistant (Landlock + seccomp + netns)
Model        nvidia/nemotron-3-super-120b-a12b (NVIDIA Cloud API)
──────────────────────────────────────────────────
Run:         nemoclaw my-assistant connect
Status:      nemoclaw my-assistant status
Logs:        nemoclaw my-assistant logs --follow
──────────────────────────────────────────────────

[INFO]  === Installation complete ===
```

### Run the Solana Agent

Set the Solana/Pump-Fun runtime variables on the host:

```console
$ export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
$ export AGENT_TOKEN_MINT_ADDRESS=<pump-token-mint>
$ export DEVELOPER_WALLET=<developer-wallet>
$ export TELEGRAM_BOT_TOKEN=<botfather-token>
$ export TELEGRAM_NOTIFY_CHAT_IDS=<optional-comma-separated-chat-ids>
```

Start the bundled Pump-Fun tracker bot inside the sandbox:

```console
$ nemoclaw my-assistant solana-agent
```

The command launches the bot from [`Pump-Fun/agent-app`](./Pump-Fun/agent-app) inside the sandbox and passes the host-side Solana environment through to the process.

### Chat with the Agent

Connect to the sandbox, then chat with the agent through the TUI or the CLI.

```console
$ nemoclaw my-assistant connect
```

#### OpenClaw TUI

The OpenClaw TUI opens an interactive chat interface. Type a message and press Enter to send it to the agent:

```console
sandbox@my-assistant:~$ openclaw tui
```

Send a test message to the agent and verify you receive a response.

#### OpenClaw CLI

Use the OpenClaw CLI to send a single message and print the response:

```console
sandbox@my-assistant:~$ openclaw agent --agent main --local -m "hello" --session-id test
```

### Pump-Fun Knowledge Workspace

Inside the sandbox, OpenClaw's workspace is preloaded with the Pump-Fun corpus:

- `~/.openclaw/workspace/AGENTS.md` injects Pump-Fun/Solana instructions into every session
- `~/.openclaw/workspace/pumpfun/docs` contains the bundled documentation set
- `~/.openclaw/workspace/pumpfun/agent-app` contains the tracker bot code
- `~/.openclaw/workspace/pumpfun/agent-prompts` contains PumpKit build prompts
- `~/.openclaw/workspace/pumpfun/agent-tasks` contains task specs and deliverable prompts

This means the agent can inspect the local Pump-Fun docs, official docs, prompts, and implementation code without fetching them externally.

<!-- end-quickstart-guide -->

---

## How It Works

NemoClaw installs the NVIDIA OpenShell runtime and Nemotron models, then uses a versioned blueprint to create a sandboxed environment where every network request, file access, and inference call is governed by declarative policy. In this repo, the sandbox also ships the Pump-Fun code and docs corpus so the `nemoclaw` CLI can orchestrate both the OpenShell runtime and a Solana-specific agent workspace.

| Component        | Role                                                                                      |
|------------------|-------------------------------------------------------------------------------------------|
| **Plugin**       | TypeScript CLI commands for launch, connect, status, and logs.                            |
| **Blueprint**    | Versioned Python artifact that orchestrates sandbox creation, policy, and inference setup. |
| **Sandbox**      | Isolated OpenShell container running OpenClaw, the Pump-Fun tracker bot, and a local Pump-Fun knowledge workspace. |
| **Inference**    | NVIDIA cloud model calls, routed through the OpenShell gateway, transparent to the agent.  |

The blueprint lifecycle follows four stages: resolve the artifact, verify its digest, plan the resources, and apply through the OpenShell CLI.

When something goes wrong, errors may originate from either NemoClaw or the OpenShell layer underneath. Run `nemoclaw <name> status` for NemoClaw-level health and `openshell sandbox list` to check the underlying sandbox state.

---

## Inference

Inference requests from the agent never leave the sandbox directly. OpenShell intercepts every call and routes it to the NVIDIA cloud provider.

| Provider     | Model                               | Use Case                                       |
|--------------|--------------------------------------|-------------------------------------------------|
| NVIDIA cloud | `nvidia/nemotron-3-super-120b-a12b` | Production. Requires an NVIDIA API key.         |

Get an API key from [build.nvidia.com](https://build.nvidia.com). The `nemoclaw onboard` command prompts for this key during setup.

---

## Protection Layers

The sandbox starts with a strict baseline policy that controls network egress and filesystem access:

| Layer      | What it protects                                    | When it applies             |
|------------|-----------------------------------------------------|-----------------------------|
| Network    | Blocks unauthorized outbound connections.           | Hot-reloadable at runtime.  |
| Filesystem | Prevents reads/writes outside `/sandbox` and `/tmp`.| Locked at sandbox creation. |
| Process    | Blocks privilege escalation and dangerous syscalls. | Locked at sandbox creation. |
| Inference  | Reroutes model API calls to controlled backends.    | Hot-reloadable at runtime.  |

When the agent tries to reach an unlisted host, OpenShell blocks the request and surfaces it in the TUI for operator approval.

---

## Key Commands

### Host commands (`nemoclaw`)

Run these on the host to set up, connect to, and manage sandboxes.

| Command                              | Description                                            |
|--------------------------------------|--------------------------------------------------------|
| `nemoclaw onboard`                  | Interactive setup wizard: gateway, providers, sandbox. |
| `nemoclaw deploy <instance>`         | Deploy to a remote GPU instance through Brev.          |
| `nemoclaw <name> connect`            | Open an interactive shell inside the sandbox.          |
| `nemoclaw <name> solana-agent`       | Run the bundled Pump-Fun tracker bot inside the sandbox. |
| `openshell term`                     | Launch the OpenShell TUI for monitoring and approvals. |
| `nemoclaw start` / `stop` / `status` | Manage auxiliary services (Telegram bridge, tunnel).   |

### Plugin commands (`openclaw nemoclaw`)

Run these inside the OpenClaw CLI. These commands are under active development and may not all be functional yet.

| Command                                    | Description                                              |
|--------------------------------------------|----------------------------------------------------------|
| `openclaw nemoclaw launch [--profile ...]` | Bootstrap OpenClaw inside an OpenShell sandbox.          |
| `openclaw nemoclaw status`                 | Show sandbox health, blueprint state, and inference.     |
| `openclaw nemoclaw logs [-f]`              | Stream blueprint execution and sandbox logs.             |

See the full [CLI reference](https://docs.nvidia.com/nemoclaw/latest/reference/commands.md) for all commands, flags, and options.

> **Known limitations:**
> - The `openclaw nemoclaw` plugin commands are under active development. Use the `nemoclaw` host CLI as the primary interface.
> - Setup may require manual workarounds on some platforms. File an issue if you encounter blockers.

---

## Learn More

Refer to the documentation for more information on NemoClaw and the bundled Pump-Fun stack.

- [Pump-Fun app code](./Pump-Fun/agent-app): Solana tracker bot and payment-gated app
- [Pump-Fun docs](./Pump-Fun/docs): local protocol, SDK, deployment, and architecture docs
- [PumpKit agent prompts](./Pump-Fun/pumpkit/agent-prompts): build prompts for extending the agent
- [Pump-Fun agent tasks](./Pump-Fun/agent-tasks): scoped task prompts and deliverables

- [Overview](https://docs.nvidia.com/nemoclaw/latest/about/overview.html): what NemoClaw does and how it fits together
- [How It Works](https://docs.nvidia.com/nemoclaw/latest/about/how-it-works.html): plugin, blueprint, and sandbox lifecycle
- [Architecture](https://docs.nvidia.com/nemoclaw/latest/reference/architecture.html): plugin structure, blueprint lifecycle, and sandbox environment
- [Inference Profiles](https://docs.nvidia.com/nemoclaw/latest/reference/inference-profiles.html): NVIDIA cloud inference configuration
- [Network Policies](https://docs.nvidia.com/nemoclaw/latest/reference/network-policies.html): egress control and policy customization
- [CLI Commands](https://docs.nvidia.com/nemoclaw/latest/reference/commands.html): full command reference

## License

This project is licensed under the [Apache License 2.0](LICENSE).
