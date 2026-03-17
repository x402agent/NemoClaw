#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Start the Solana operator stack inside the sandbox in one shot.
# This launches the Telegram bot, natural-language wallet bridge,
# and realtime websocket relay as background services.

set -euo pipefail

SERVICES_DIR="${HOME:-/sandbox}/.nemoclaw/services"
LOG_DIR="${SERVICES_DIR}/logs"
PID_DIR="${SERVICES_DIR}/pids"

mkdir -p "${LOG_DIR}" "${PID_DIR}"

START_TELEGRAM_BOT="${START_TELEGRAM_BOT:-true}"
START_SOLANA_BRIDGE="${START_SOLANA_BRIDGE:-true}"
START_WEBSOCKET_SERVER="${START_WEBSOCKET_SERVER:-true}"
START_PAYMENT_APP="${START_PAYMENT_APP:-false}"
START_SWARM_BOT="${START_SWARM_BOT:-false}"

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[solana-stack] Missing required environment variable: $key" >&2
    exit 1
  fi
}

service_running() {
  local name="$1"
  local pid_file="${PID_DIR}/${name}.pid"
  if [ -f "${pid_file}" ]; then
    local pid
    pid="$(cat "${pid_file}")"
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_service() {
  local name="$1"
  local command="$2"
  local log_file="${LOG_DIR}/${name}.log"
  local pid_file="${PID_DIR}/${name}.pid"

  if service_running "${name}"; then
    echo "[solana-stack] ${name} already running (pid $(cat "${pid_file}"))"
    return
  fi

  nohup bash -lc "${command}" >"${log_file}" 2>&1 &
  local pid=$!
  echo "${pid}" > "${pid_file}"
  echo "[solana-stack] ${name} started (pid ${pid})"
  echo "[solana-stack] log: ${log_file}"
}

if [ "${START_TELEGRAM_BOT}" = "true" ] || [ "${START_SOLANA_BRIDGE}" = "true" ]; then
  require_env TELEGRAM_BOT_TOKEN
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[solana-stack] NemoClaw Solana One-Shot Startup"
echo "[solana-stack] RPC: ${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
echo "[solana-stack] WS:  ${SOLANA_WS_URL:-auto}"
echo "[solana-stack] Wallet: ${DEVELOPER_WALLET:-not-configured}"
echo "[solana-stack] Mint: ${AGENT_TOKEN_MINT_ADDRESS:-not-configured}"
if [ -n "${HELIUS_API_KEY:-}" ]; then
  echo "[solana-stack] Helius: configured"
else
  echo "[solana-stack] Helius: not-configured"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "${START_TELEGRAM_BOT}" = "true" ]; then
  start_service "telegram-bot" "nemoclaw-telegram-bot"
fi

if [ "${START_SOLANA_BRIDGE}" = "true" ]; then
  start_service "solana-bridge" "nemoclaw-solana-bridge"
fi

if [ "${START_WEBSOCKET_SERVER}" = "true" ]; then
  start_service "websocket-server" "nemoclaw-websocket-server"
fi

if [ "${START_PAYMENT_APP}" = "true" ]; then
  start_service "payment-app" "nemoclaw-payment-app"
fi

if [ "${START_SWARM_BOT}" = "true" ]; then
  start_service "swarm-bot" "nemoclaw-swarm-bot"
fi

echo ""
echo "[solana-stack] Active services:"
for pid_file in "${PID_DIR}"/*.pid; do
  [ -e "${pid_file}" ] || continue
  service_name="$(basename "${pid_file}" .pid)"
  if service_running "${service_name}"; then
    echo "  - ${service_name} (pid $(cat "${pid_file}"))"
  fi
done
echo ""
echo "[solana-stack] One-shot startup complete."
