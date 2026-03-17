#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Run the bundled Pump-Fun Solana tracker bot inside the sandbox.
# Also supports starting a local test-validator and reporting wallet status.

set -euo pipefail

APP_DIR="/opt/pump-fun/agent-app"

# ── Helpers ──────────────────────────────────────────────────────

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[solana-agent] Missing required environment variable: $key" >&2
    exit 1
  fi
}

warn_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[solana-agent] WARNING: $key is not set (some features may be limited)" >&2
  fi
}

# ── Environment ──────────────────────────────────────────────────

export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
export NEXT_PUBLIC_SOLANA_RPC_URL="${NEXT_PUBLIC_SOLANA_RPC_URL:-$SOLANA_RPC_URL}"
export SOLANA_WS_URL="${SOLANA_WS_URL:-$SOLANA_RPC_URL}"
export NEMOCLAW_VAULT_DIR="${NEMOCLAW_VAULT_DIR:-${HOME:-/sandbox}/.nemoclaw/vault}"

mkdir -p "${NEMOCLAW_VAULT_DIR}"

# ── Mode selection ───────────────────────────────────────────────

MODE="${1:-bot}"

case "$MODE" in
  bot)
    require_env AGENT_TOKEN_MINT_ADDRESS
    require_env DEVELOPER_WALLET
    require_env TELEGRAM_BOT_TOKEN

    cd "$APP_DIR"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[solana-agent] Starting Pump-Fun tracker bot"
    echo "[solana-agent] RPC: ${SOLANA_RPC_URL}"
    echo "[solana-agent] WS: ${SOLANA_WS_URL}"
    echo "[solana-agent] Mint: ${AGENT_TOKEN_MINT_ADDRESS}"
    echo "[solana-agent] Dev wallet: ${DEVELOPER_WALLET}"
    echo "[solana-agent] Vault: ${NEMOCLAW_VAULT_DIR}"
    if [ -n "${HELIUS_API_KEY:-}" ]; then
      echo "[solana-agent] Helius: configured"
    fi

    # Report Solana CLI version if available
    if command -v solana &>/dev/null; then
      echo "[solana-agent] Solana CLI: $(solana --version 2>/dev/null || echo 'unknown')"
    fi

    # Report Privy wallet status
    if [ -n "${PRIVY_APP_ID:-}" ]; then
      echo "[solana-agent] Privy wallet: configured (app: ${PRIVY_APP_ID:0:12}...)"
    else
      echo "[solana-agent] Privy wallet: not configured"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exec npm run bot
    ;;

  test-validator)
    echo "[solana-agent] Starting solana-test-validator..."
    if ! command -v solana-test-validator &>/dev/null; then
      echo "[solana-agent] ERROR: solana-test-validator not found" >&2
      exit 1
    fi

    # Clone Pump programs from mainnet
    CLONE_ARGS=""
    CLONE_ARGS+=" --clone 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    CLONE_ARGS+=" --clone pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
    CLONE_ARGS+=" --clone pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
    CLONE_ARGS+=" --clone AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7"
    CLONE_ARGS+=" --url https://api.mainnet-beta.solana.com"

    echo "[solana-agent] Cloning Pump programs from mainnet..."
    exec solana-test-validator --rpc-port 8899 $CLONE_ARGS
    ;;

  status)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[solana-agent] Status Report"
    echo "[solana-agent] RPC: ${SOLANA_RPC_URL}"
    echo "[solana-agent] WS:  ${SOLANA_WS_URL}"
    echo "[solana-agent] Vault: ${NEMOCLAW_VAULT_DIR}"
    echo "[solana-agent] Chain health:"
    curl -sf -X POST "${SOLANA_RPC_URL}" \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null || echo "  unreachable"

    if command -v solana &>/dev/null; then
      echo ""
      echo "[solana-agent] Solana CLI: $(solana --version 2>/dev/null)"
      solana config get 2>/dev/null || true
    fi

    warn_env AGENT_TOKEN_MINT_ADDRESS
    warn_env DEVELOPER_WALLET
    warn_env PRIVY_APP_ID

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;

  *)
    echo "Usage: nemoclaw-solana-agent [bot|test-validator|status]"
    echo ""
    echo "  bot              Start the Pump-Fun tracker bot (default)"
    echo "  test-validator   Start a local solana-test-validator with cloned Pump programs"
    echo "  status           Show Solana and wallet configuration status"
    exit 0
    ;;
esac
