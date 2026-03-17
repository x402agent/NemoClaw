#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun WebSocket relay inside the sandbox.

set -euo pipefail

APP_DIR="/opt/pump-fun/websocket-server"
PUMPFUN_ROOT="/opt/pump-fun"
WORKSPACE_ROOT="${HOME:-/sandbox}/.openclaw/workspace"

prepare_workspace() {
  mkdir -p "${WORKSPACE_ROOT}/pumpfun"
  ln -snf "${PUMPFUN_ROOT}/websocket-server" "${WORKSPACE_ROOT}/pumpfun/websocket-server"
  ln -snf "${PUMPFUN_ROOT}/telegram-bot" "${WORKSPACE_ROOT}/pumpfun/telegram-bot"
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
export SOLANA_RPC_WS="${SOLANA_RPC_WS:-$(derive_ws_url)}"
export PORT="${PORT:-3099}"
export IPFS_GATEWAY="${IPFS_GATEWAY:-https://cf-ipfs.com/ipfs/}"

prepare_workspace

cd "${APP_DIR}"
echo "[websocket-server] Starting Pump-Fun relay"
echo "[websocket-server] RPC WS: ${SOLANA_RPC_WS}"
echo "[websocket-server] Port: ${PORT}"
exec npx tsx src/server.ts
