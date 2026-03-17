#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun tokenized agent app inside the sandbox.

set -euo pipefail

APP_DIR="/opt/pump-fun/agent-app"
PUMPFUN_ROOT="/opt/pump-fun"
WORKSPACE_ROOT="${HOME:-/sandbox}/.openclaw/workspace"
PORT="${PORT:-3000}"
DEFI_AGENT_ID="${DEFI_AGENT_ID:-pump-fun-sdk-expert}"

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[payment-app] Missing required environment variable: $key" >&2
    exit 1
  fi
}

write_persona_soul() {
  export WORKSPACE_ROOT PUMPFUN_ROOT DEFI_AGENT_ID
  python3 - <<'PYSOUL'
import json
import os
import pathlib
import sys

workspace = pathlib.Path(os.environ["WORKSPACE_ROOT"])
root = pathlib.Path(os.environ["PUMPFUN_ROOT"])
agent_id = os.environ["DEFI_AGENT_ID"]
persona_path = root / "defi-agents" / "src" / f"{agent_id}.json"

if not persona_path.exists():
    print(f"[payment-app] Persona not found: {agent_id}", file=sys.stderr)
    sys.exit(1)

data = json.loads(persona_path.read_text())
title = data.get("meta", {}).get("title", agent_id)
description = data.get("meta", {}).get("description", "")
system_role = data.get("config", {}).get("systemRole", "").strip()
opening = data.get("config", {}).get("openingMessage", "").strip()
tags = ", ".join(data.get("meta", {}).get("tags", []))

workspace.mkdir(parents=True, exist_ok=True)
content = f"""# Active Tokenized Agent Persona

Persona ID: `{agent_id}`
Title: {title}
Description: {description}
Tags: {tags}

Opening message:
{opening}

System role:
{system_role}

Runtime rules:
- This is a payment-gated Solana agent delivered through the bundled Pump-Fun agent app.
- Ground answers in the local Pump-Fun docs and official Pump docs before relying on generic memory.
- For invoice, payment, wallet-adapter, and verification flows, align with `pumpfun/tokenized-agents-skill/SKILL.md` and the bundled `pumpfun/agent-app/`.
- When giving protocol guidance, prefer the Pump-Fun docs corpus and bundled persona over generic DeFi advice.
"""
(workspace / "SOUL.md").write_text(content)
PYSOUL
  ln -snf "${PUMPFUN_ROOT}/tokenized-agents-skill" "${WORKSPACE_ROOT}/pumpfun/tokenized-agents-skill"
  ln -snf "${PUMPFUN_ROOT}/defi-agents" "${WORKSPACE_ROOT}/pumpfun/defi-agents"
  ln -snf "${PUMPFUN_ROOT}/x402" "${WORKSPACE_ROOT}/pumpfun/x402"
}

require_env AGENT_TOKEN_MINT_ADDRESS

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
export NEXT_PUBLIC_SOLANA_RPC_URL="${NEXT_PUBLIC_SOLANA_RPC_URL:-$SOLANA_RPC_URL}"
export DEFI_AGENTS_ROOT="${DEFI_AGENTS_ROOT:-/opt/pump-fun/defi-agents}"
export TOKENIZED_AGENT_SKILL_ROOT="${TOKENIZED_AGENT_SKILL_ROOT:-/opt/pump-fun/tokenized-agents-skill}"
export HOSTNAME=0.0.0.0
export PORT

write_persona_soul

cd "$APP_DIR"
echo "[payment-app] Starting payment app"
echo "[payment-app] Port: ${PORT}"
echo "[payment-app] Persona: ${DEFI_AGENT_ID}"
echo "[payment-app] Mint: ${AGENT_TOKEN_MINT_ADDRESS}"
echo "[payment-app] RPC: ${SOLANA_RPC_URL}"
exec npm run dev -- --hostname 0.0.0.0 --port "$PORT"
