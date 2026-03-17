#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun Solana tracker bot inside the sandbox.

set -euo pipefail

APP_DIR="/opt/pump-fun/agent-app"

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[solana-agent] Missing required environment variable: $key" >&2
    exit 1
  fi
}

require_env AGENT_TOKEN_MINT_ADDRESS
require_env DEVELOPER_WALLET
require_env TELEGRAM_BOT_TOKEN

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
export NEXT_PUBLIC_SOLANA_RPC_URL="${NEXT_PUBLIC_SOLANA_RPC_URL:-$SOLANA_RPC_URL}"

cd "$APP_DIR"
echo "[solana-agent] Starting Pump-Fun tracker bot"
echo "[solana-agent] RPC: ${SOLANA_RPC_URL}"
echo "[solana-agent] Mint: ${AGENT_TOKEN_MINT_ADDRESS}"
echo "[solana-agent] Dev wallet: ${DEVELOPER_WALLET}"
exec npm run bot
