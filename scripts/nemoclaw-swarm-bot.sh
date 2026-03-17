#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun swarm dashboard inside the sandbox.

set -euo pipefail

APP_DIR="/opt/pump-fun/swarm-bot"
PUMPFUN_ROOT="/opt/pump-fun"
WORKSPACE_ROOT="${HOME:-/sandbox}/.openclaw/workspace"

prepare_workspace() {
  mkdir -p "${WORKSPACE_ROOT}/pumpfun"
  ln -snf "${PUMPFUN_ROOT}/swarm-bot" "${WORKSPACE_ROOT}/pumpfun/swarm-bot"
  ln -snf "${PUMPFUN_ROOT}/telegram-bot" "${WORKSPACE_ROOT}/pumpfun/telegram-bot"
  ln -snf "${PUMPFUN_ROOT}/websocket-server" "${WORKSPACE_ROOT}/pumpfun/websocket-server"
}

derive_ws_url() {
  python3 - <<'PYURL'
import os
from urllib.parse import urlparse, urlunparse

rpc = os.environ["SOLANA_RPC_URL"]
parsed = urlparse(rpc)
scheme = "wss" if parsed.scheme == "https" else "ws"
print(urlunparse((scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)))
PYURL
}

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
export SOLANA_WS_URL="${SOLANA_WS_URL:-$(derive_ws_url)}"
export PORT="${PORT:-3100}"
export DB_PATH="${DB_PATH:-/sandbox/data/swarm.db}"
export DEFAULT_SLIPPAGE_BPS="${DEFAULT_SLIPPAGE_BPS:-500}"
export MAX_POSITION_SOL_PER_BOT="${MAX_POSITION_SOL_PER_BOT:-5}"
export MAX_TOTAL_POSITION_SOL="${MAX_TOTAL_POSITION_SOL:-50}"
export POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-5000}"
export LOG_LEVEL="${LOG_LEVEL:-info}"

mkdir -p "$(dirname "${DB_PATH}")"
prepare_workspace

cd "${APP_DIR}"
echo "[swarm-bot] Starting Pump-Fun swarm dashboard"
echo "[swarm-bot] RPC: ${SOLANA_RPC_URL}"
echo "[swarm-bot] WS: ${SOLANA_WS_URL}"
echo "[swarm-bot] Port: ${PORT}"
echo "[swarm-bot] DB: ${DB_PATH}"
exec npx tsx src/index.ts
