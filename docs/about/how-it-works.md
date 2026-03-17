---
title:
  page: "How NemoClaw Works — Financial Agent Runtime, Blueprint, and Sandbox Lifecycle"
  nav: "How It Works"
description: "How NemoClaw turns a funded wallet, heartbeat loop, and sandboxed agent runtime into a policy-bounded Solana operator."
keywords: ["how nemoclaw works", "nemoclaw sandbox lifecycle blueprint", "solana agent runtime", "wallet heartbeat", "nemo claw vault"]
topics: ["generative_ai", "ai_agents"]
tags: ["openclaw", "openshell", "sandboxing", "inference_routing", "blueprints", "network_policy", "solana", "wallets", "telemetry"]
content:
  type: concept
  difficulty: technical_beginner
  audience: ["developer", "engineer"]
status: published
---

<!--
  SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  SPDX-License-Identifier: Apache-2.0
-->

# How NemoClaw Works

NemoClaw combines a lightweight CLI plugin with a versioned blueprint to move OpenClaw into a controlled sandbox and pair it with a funded Solana wallet, market telemetry, and continuous runtime services.
This page explains the financial-agent runtime at a high level.

## How It Fits Together

The `nemoclaw` CLI is the primary entrypoint for setting up and managing sandboxed OpenClaw agents.
It delegates heavy lifting to a versioned blueprint, a Python artifact that orchestrates sandbox creation, policy application, and inference provider setup through the OpenShell CLI.

```{mermaid}
flowchart TB
    subgraph Host
        CMD["nemoclaw onboard"]
        PLUGIN[nemoclaw plugin]
        BLUEPRINT[blueprint runner]
        CLI["openshell CLI sandbox · gateway · inference · policy"]

        CMD --> PLUGIN
        PLUGIN --> BLUEPRINT
        BLUEPRINT --> CLI
    end

    subgraph Sandbox["OpenShell Sandbox"]
        AGENT[OpenClaw agent]
        INF[NVIDIA inference, routed]
        NET[strict network policy]
        FS[filesystem isolation]
        HEART[wallet heartbeat]
        VAULT[NemoClaw vault]

        AGENT --- INF
        AGENT --- NET
        AGENT --- FS
        AGENT --- HEART
        AGENT --- VAULT
    end

    PLUGIN --> AGENT

    classDef nv fill:#76b900,stroke:#333,color:#fff
    classDef nvLight fill:#e6f2cc,stroke:#76b900,color:#1a1a1a
    classDef nvDark fill:#333,stroke:#76b900,color:#fff

    class CMD,PLUGIN,BLUEPRINT nvDark
    class CLI nv
    class AGENT nv
    class INF,NET,FS,HEART,VAULT nvLight

    style Host fill:none,stroke:#76b900,stroke-width:2px,color:#1a1a1a
    style Sandbox fill:#f5faed,stroke:#76b900,stroke-width:2px,color:#1a1a1a
```

## Design Principles

NemoClaw architecture follows the following principles.

Thin plugin, versioned blueprint
: The plugin stays small and stable. Orchestration logic lives in the blueprint and evolves on its own release cadence.

Respect CLI boundaries
: The `nemoclaw` CLI is the primary interface. Plugin commands are available under `openclaw nemoclaw` but do not override built-in OpenClaw commands.

Supply chain safety
: Blueprint artifacts are immutable, versioned, and digest-verified before execution.

OpenShell-native for new installs
: For users without an existing OpenClaw installation, NemoClaw recommends `openshell sandbox create` directly
  rather than forcing a plugin-driven bootstrap.

Reproducible setup
: Running setup again recreates the sandbox from the same blueprint and policy definitions.

Policy-bounded autonomy
: NemoClaw is designed for continuous operation, but not unbounded behavior. Wallet policy, balance floors, network policy, and operator-visible logs constrain the runtime.

Auditability first
: Financial actions are only useful if they are explainable. NemoClaw keeps a vault trail of wallet activity, heartbeat state, and service startup so operators can reconstruct what happened.

## Plugin and Blueprint

NemoClaw is split into two parts:

- The *plugin* is a TypeScript package that powers the `nemoclaw` CLI and also registers commands under `openclaw nemoclaw`.
  It handles user interaction and delegates orchestration work to the blueprint.
- The *blueprint* is a versioned Python artifact that contains all the logic for creating sandboxes, applying policies, and configuring inference.
  The plugin resolves, verifies, and executes the blueprint as a subprocess.

This separation keeps the plugin small and stable while allowing the blueprint to evolve on its own release cadence.

## Sandbox Creation

When you run `nemoclaw onboard`, NemoClaw creates an OpenShell sandbox that runs OpenClaw in an isolated container.
The blueprint orchestrates this process through the OpenShell CLI:

1. The plugin downloads the blueprint artifact, checks version compatibility, and verifies the digest.
2. The blueprint determines which OpenShell resources to create or update, such as the gateway, inference providers, sandbox, and network policy.
3. The blueprint calls OpenShell CLI commands to create the sandbox and configure each resource.

After the sandbox starts, the agent runs inside it with all network, filesystem, and inference controls in place.

## Financial Runtime Loop

Once the sandbox is online and a wallet is configured, NemoClaw behaves like a long-running Solana operator:

1. A wallet is provisioned or attached through Privy.
2. The runtime connects to Solana RPC, typically Helius when configured.
3. A heartbeat loop measures wallet balance, funded state, and protection thresholds.
4. Runtime services observe wallet activity, token movements, and program interactions.
5. Events are narrated in natural language to Telegram and written to the NemoClaw vault.

This is continuous operation, not magic or sentience. NemoClaw does not claim independent consciousness. The practical goal is durable, observable agent behavior inside a sandbox with a funded wallet and controlled execution path.

## Wallet, Funding, and Protection Mode

NemoClaw uses a Privy-backed wallet so private keys do not live in the sandbox filesystem.
That wallet becomes the financial identity of the agent.

- A wallet can be created with `nemoclaw wallet create`.
- Solana runtime commands inject the wallet address, RPC URL, and optional Helius credentials into the sandbox.
- The bridge heartbeat marks the wallet as funded when it is above the configured activity threshold.
- When the wallet falls below the configured floor, NemoClaw shifts into a protection-oriented state rather than encouraging blind depletion.

This matters because a financial agent should remain online when capital is low, but it should not silently continue operating as though nothing changed.

## Inference Routing

Inference requests from the agent never leave the sandbox directly.
OpenShell intercepts every inference call and routes it to the configured provider.
NemoClaw routes inference to NVIDIA cloud, specifically Nemotron 3 Super 120B through [build.nvidia.com](https://build.nvidia.com). You can switch models at runtime without restarting the sandbox.

Inference is one input to the agent loop, not the final authority. Model output is still constrained by wallet configuration, sandbox policy, and runtime wiring.

## Network and Filesystem Policy

The sandbox starts with a strict baseline policy defined in `openclaw-sandbox.yaml`.
This policy controls which network endpoints the agent can reach and which filesystem paths it can access.

- For network, only endpoints listed in the policy are allowed.
  When the agent tries to reach an unlisted host, OpenShell blocks the request and surfaces it in the TUI for operator approval.
- For filesystem, the agent can write to `/sandbox` and `/tmp`.
  All other system paths are read-only.

Approved endpoints persist for the current session but are not saved to the baseline policy file.

## Heartbeat and the NemoClaw Vault

NemoClaw keeps an append-only operator trail under `~/.nemoclaw/vault/`.
The vault is intended to answer the practical questions operators actually have:

- Is the wallet funded?
- When did the stack start?
- Which RPC provider was active?
- What trades, transfers, or token balance changes were observed?
- When did the agent enter or leave protection mode?

In the current runtime, the Solana bridge writes:

- wallet and trade activity events as JSONL
- periodic heartbeat snapshots
- service session records for stack startup and runtime identity

This makes Telegram the human-readable surface and the vault the machine-readable audit trail.

## Runtime Services

The one-shot Solana stack starts several cooperating services inside the sandbox:

- the Pump-Fun Telegram bot for monitoring and API access
- the Solana bridge for natural-language wallet narration
- the realtime websocket relay for live token and launch feeds
- optional payment and swarm services when enabled

Together these services give NemoClaw a live operating loop from funded wallet to narration and audit trail.

## Next Steps

- Follow the [Quickstart](../get-started/quickstart.md) to launch your first sandbox.
- Refer to the [Command Reference](../reference/commands.md) for `nemoclaw wallet`, `nemoclaw solana start`, and service commands.
- Refer to the [Architecture](../reference/architecture.md) for the full technical structure, including file layouts and the blueprint lifecycle.
- Refer to [Inference Profiles](../reference/inference-profiles.md) for detailed provider configuration.
