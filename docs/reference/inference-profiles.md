---
title:
  page: "NemoClaw Inference Profiles"
  nav: "Inference Profiles"
description: "Configuration reference for inference profiles — Ollama (DeepSolana), NVIDIA Cloud, vLLM."
keywords: ["nemoclaw inference profiles", "nemoclaw deepsolana", "nemoclaw ollama", "nemoclaw nvidia cloud provider"]
topics: ["generative_ai", "ai_agents"]
tags: ["openclaw", "openshell", "inference_routing", "llms", "ollama", "deepsolana"]
content:
  type: reference
  difficulty: intermediate
  audience: ["developer", "engineer"]
status: published
---

<!--
  SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
  SPDX-License-Identifier: Apache-2.0
-->

# Inference Profiles

NemoClaw ships with an inference profile defined in `blueprint.yaml`.
The profile configures an OpenShell inference provider and model route.
The agent inside the sandbox uses whichever model is active.
Inference requests are routed transparently through the OpenShell gateway.

## Default: Ollama + `8bit/DeepSolana`

When Ollama is detected on `localhost:11434` during `nemoclaw onboard`, NemoClaw:

1. Automatically selects the `ollama-local` provider
2. Pulls `8bit/DeepSolana` (`ollama pull 8bit/DeepSolana`)
3. Configures the OpenShell inference route

DeepSolana is a Solana-tuned model that understands Pump-Fun mechanics, token launches, DeFi strategies, and wallet narration out of the box.

```console
$ openshell provider create --name ollama-local --type openai \
    --credential "OPENAI_API_KEY=ollama" \
    --config "OPENAI_BASE_URL=http://host.openshell.internal:11434/v1"

$ openshell inference set --no-verify --provider ollama-local --model 8bit/DeepSolana
```

## Profile Summary

| Profile | Provider | Model | Endpoint | Use Case |
|---|---|---|---|---|
| `ollama-local` (default) | Ollama | `8bit/DeepSolana` | `localhost:11434` | Local inference. No API key required. |
| `nvidia-nim` | NVIDIA Cloud | `nvidia/nemotron-3-super-120b-a12b` | `integrate.api.nvidia.com` | Production. Requires NVIDIA API key. |

## Available NVIDIA Cloud Models

The `nvidia-nim` provider registers the following models from [build.nvidia.com](https://build.nvidia.com):

| Model ID | Label | Context Window | Max Output |
|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b` | Nemotron 3 Super 120B | 131,072 | 8,192 |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1` | Nemotron Ultra 253B | 131,072 | 4,096 |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | Nemotron Super 49B v1.5 | 131,072 | 4,096 |
| `nvidia/nemotron-3-nano-30b-a3b` | Nemotron 3 Nano 30B | 131,072 | 4,096 |

## Switching Models at Runtime

After the sandbox is running, switch models with the OpenShell CLI:

```console
# Switch to a different Ollama model
$ ollama pull llama3
$ openshell inference set --no-verify --provider ollama-local --model llama3

# Switch to NVIDIA Cloud
$ openshell inference set --provider nvidia-nim --model nvidia/nemotron-3-super-120b-a12b
```

The change takes effect immediately.
No sandbox restart is needed.

## `ollama-local` — Default (DeepSolana)

- **Provider type:** `openai` (OpenAI-compatible)
- **Endpoint:** `http://host.openshell.internal:11434/v1`
- **Model:** `8bit/DeepSolana`
- **Credential:** `OPENAI_API_KEY=ollama` (placeholder, Ollama doesn't require auth)
- **Install:** `brew install ollama` (macOS) or [ollama.ai](https://ollama.ai)

## `nvidia-nim` — NVIDIA Cloud

- **Provider type:** `nvidia`
- **Endpoint:** `https://integrate.api.nvidia.com/v1`
- **Model:** `nvidia/nemotron-3-super-120b-a12b`
- **Credential:** `NVIDIA_API_KEY` environment variable

Get an API key from [build.nvidia.com](https://build.nvidia.com).
The `nemoclaw onboard` command prompts for this key and stores it in `~/.nemoclaw/credentials.json`.
