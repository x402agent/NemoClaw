#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun Telegram bot inside the sandbox.

set -euo pipefail

APP_DIR="/opt/pump-fun/telegram-bot"
PUMPFUN_ROOT="/opt/pump-fun"
WORKSPACE_ROOT="${HOME:-/sandbox}/.openclaw/workspace"

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[telegram-bot] Missing required environment variable: $key" >&2
    exit 1
  fi
}

prepare_workspace() {
  mkdir -p "${WORKSPACE_ROOT}/pumpfun"
  ln -snf "${PUMPFUN_ROOT}/telegram-bot" "${WORKSPACE_ROOT}/pumpfun/telegram-bot"
  ln -snf "${PUMPFUN_ROOT}/defi-agents" "${WORKSPACE_ROOT}/pumpfun/defi-agents"
  ln -snf "${PUMPFUN_ROOT}/tokenized-agents-skill" "${WORKSPACE_ROOT}/pumpfun/tokenized-agents-skill"
  ln -snf "${PUMPFUN_ROOT}/websocket-server" "${WORKSPACE_ROOT}/pumpfun/websocket-server"
  ln -snf "${PUMPFUN_ROOT}/swarm-bot" "${WORKSPACE_ROOT}/pumpfun/swarm-bot"
  ln -snf "${PUMPFUN_ROOT}/x402" "${WORKSPACE_ROOT}/pumpfun/x402"
  ln -snf "${PUMPFUN_ROOT}/tools" "${WORKSPACE_ROOT}/pumpfun/tools"
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

require_env TELEGRAM_BOT_TOKEN

# OpenShell sandboxes may inherit host proxy variables that break direct
# Telegram API access and WebSocket setup inside the sandbox.
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy grpc_proxy GRPC_PROXY
unset NODE_USE_ENV_PROXY

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
export SOLANA_WS_URL="${SOLANA_WS_URL:-$(derive_ws_url)}"
export RES_OPTIONS="${RES_OPTIONS:-ndots:1 timeout:1 attempts:2}"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first"
export ENABLE_API="${ENABLE_API:-true}"
export ENABLE_LAUNCH_MONITOR="${ENABLE_LAUNCH_MONITOR:-true}"
export ENABLE_GRADUATION_ALERTS="${ENABLE_GRADUATION_ALERTS:-true}"
export ENABLE_TRADE_ALERTS="${ENABLE_TRADE_ALERTS:-false}"
export ENABLE_FEE_DISTRIBUTION_ALERTS="${ENABLE_FEE_DISTRIBUTION_ALERTS:-true}"
export GITHUB_ONLY_FILTER="${GITHUB_ONLY_FILTER:-false}"
export POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-60}"
export WHALE_THRESHOLD_SOL="${WHALE_THRESHOLD_SOL:-10}"
export PORT="${PORT:-3001}"

prepare_workspace

cd "${APP_DIR}"
echo "[telegram-bot] Starting Pump-Fun Telegram bot"
echo "[telegram-bot] RPC: ${SOLANA_RPC_URL}"
echo "[telegram-bot] WS: ${SOLANA_WS_URL}"
echo "[telegram-bot] API enabled: ${ENABLE_API}"
echo "[telegram-bot] API port: ${PORT}"
exec npx tsx src/index.ts
