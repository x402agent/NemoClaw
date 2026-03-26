#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# NemoClaw Fly.io entrypoint — boots the wrapper server which manages
# the OpenClaw gateway, setup wizard, and reverse proxy.

set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
export DATA_DIR

echo "============================================"
echo "  NemoClaw on Fly.io"
echo "============================================"

# Ensure data directory structure
mkdir -p "${DATA_DIR}/.openclaw/agents/main/agent" \
         "${DATA_DIR}/.openclaw/workspace/skills" \
         "${DATA_DIR}/.nemoclaw/wallets" \
         "${DATA_DIR}/.nemoclaw/vault"
chmod 700 "${DATA_DIR}/.nemoclaw/wallets" 2>/dev/null || true

# If the OpenClaw config doesn't exist yet, write a sensible default
if [ ! -f "${DATA_DIR}/.openclaw/openclaw.json" ]; then
  echo "[entrypoint] Writing default OpenClaw config..."
  python3 -c "
import json, os
cfg = {
  'agents': {'defaults': {'model': {'primary': 'nvidia/nemotron-3-super-120b-a12b'}}},
  'gateway': {
    'mode': 'local',
    'controlUi': {
      'allowInsecureAuth': True,
      'dangerouslyDisableDeviceAuth': True,
      'allowedOrigins': ['http://127.0.0.1:18789']
    },
    'trustedProxies': ['127.0.0.1', '::1']
  }
}
path = os.path.join('${DATA_DIR}', '.openclaw', 'openclaw.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(cfg, open(path, 'w'), indent=2)
os.chmod(path, 0o600)
"
fi

# Pre-install NemoClaw plugin if not already present
if command -v openclaw &>/dev/null; then
  HOME="${DATA_DIR}" openclaw doctor --fix > /dev/null 2>&1 || true
  HOME="${DATA_DIR}" openclaw plugins install /opt/nemoclaw > /dev/null 2>&1 || true
fi

# ── Apply secrets from Fly into wrapper config ──────────────────
# If nemoclaw.json doesn't exist but Fly secrets do, seed the config
if [ ! -f "${DATA_DIR}/nemoclaw.json" ]; then
  PROVIDER=""
  API_KEY=""

  case "${NEMOCLAW_AUTH_CHOICE:-}" in
    anthropic) PROVIDER="anthropic"; API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    openai)    PROVIDER="openai";    API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    nvidia)    PROVIDER="nvidia";    API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    gemini)    PROVIDER="gemini";    API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    openrouter) PROVIDER="openrouter"; API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    moonshot)  PROVIDER="moonshot";  API_KEY="${NEMOCLAW_API_KEY:-}" ;;
    minimax)   PROVIDER="minimax";   API_KEY="${NEMOCLAW_API_KEY:-}" ;;
  esac

  if [ -n "${PROVIDER}" ] && [ -n "${API_KEY}" ]; then
    echo "[entrypoint] Seeding config from Fly secrets (provider: ${PROVIDER})..."
    python3 -c "
import json, os
cfg = {
  'provider': '${PROVIDER}',
  'apiKey': os.environ.get('NEMOCLAW_API_KEY', ''),
  'telegramToken': os.environ.get('NEMOCLAW_TELEGRAM_TOKEN', ''),
  'discordToken': os.environ.get('NEMOCLAW_DISCORD_TOKEN', ''),
  'slackBotToken': os.environ.get('NEMOCLAW_SLACK_BOT_TOKEN', ''),
  'slackAppToken': os.environ.get('NEMOCLAW_SLACK_APP_TOKEN', ''),
  'solanaRpcUrl': os.environ.get('SOLANA_RPC_URL', ''),
  'privyAppId': os.environ.get('PRIVY_APP_ID', ''),
  'privyAppSecret': os.environ.get('PRIVY_APP_SECRET', ''),
  'heliusApiKey': os.environ.get('HELIUS_API_KEY', ''),
}
# Remove empty values
cfg = {k: v for k, v in cfg.items() if v}
path = '${DATA_DIR}/nemoclaw.json'
json.dump(cfg, open(path, 'w'), indent=2)
os.chmod(path, 0o600)
"
  fi
fi

echo "[entrypoint] Starting wrapper server on :${PORT:-3000}..."
exec node /opt/wrapper/server.js
