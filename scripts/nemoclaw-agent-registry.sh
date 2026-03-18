#!/usr/bin/env bash
# NemoClaw Agent Registry — Launch Script
#
# Registers the agent with 8004 Solana Agent Registry and Pump.fun,
# then enters a heartbeat loop for uptime/liveness feedback.

set -euo pipefail

REGISTRY_DIR="/opt/pump-fun/agent-registry"

# Fall back to local dev path if /opt doesn't exist
if [ ! -d "${REGISTRY_DIR}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REGISTRY_DIR="$(dirname "${SCRIPT_DIR}")/Pump-Fun/agent-registry"
fi

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
export SOLANA_WS_URL="${SOLANA_WS_URL:-}"
export HEARTBEAT_INTERVAL_SECONDS="${HEARTBEAT_INTERVAL_SECONDS:-60}"
export HEARTBEAT_ENABLED="${HEARTBEAT_ENABLED:-true}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[agent-registry] NemoClaw Agent Registry + Heartbeat"
echo "[agent-registry] RPC: ${SOLANA_RPC_URL}"
echo "[agent-registry] Heartbeat: ${HEARTBEAT_INTERVAL_SECONDS}s"
echo "[agent-registry] Wallet: ${DEVELOPER_WALLET:-not-configured}"
echo "[agent-registry] Mint: ${AGENT_TOKEN_MINT_ADDRESS:-not-configured}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "${REGISTRY_DIR}"
exec npx tsx src/index.ts
