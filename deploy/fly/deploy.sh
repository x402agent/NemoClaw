#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# deploy.sh — One-command NemoClaw deployment to Fly.io
#
# Usage:
#   bash deploy.sh
#
# Prerequisites:
#   - flyctl installed (https://fly.io/docs/flyctl/install/)
#   - Fly.io account (free trial works)
#   - An LLM API key (Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot, MiniMax)

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
fail()  { echo -e "${RED}[deploy]${NC} $1"; exit 1; }
ask()   { echo -en "${BLUE}[deploy]${NC} $1"; }

# ── Banner ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}"
echo '  _  _                     ___ _                '
echo ' | \| |___ _ __  ___  / __| |__ ___ __ __      '
echo ' | .` / -_| '\''  \/ _ \| (__| / _` \ V  V /   '
echo ' |_|\_\___|_|_|_\___/ \___|_\__,_|\_/\_/       '
echo -e "${NC}"
echo -e "  ${BOLD}Deploy NemoClaw to Fly.io${NC}"
echo ""

# ── Preflight checks ───────────────────────────────────────────────
if ! command -v flyctl &>/dev/null && ! command -v fly &>/dev/null; then
  fail "flyctl not found. Install it: https://fly.io/docs/flyctl/install/"
fi

# Normalize command name
FLY="flyctl"
command -v flyctl &>/dev/null || FLY="fly"

if ! $FLY auth whoami &>/dev/null; then
  warn "Not logged into Fly.io. Running 'flyctl auth login'..."
  $FLY auth login
fi

# ── Locate repo root ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# If running from the deploy package zip, the repo root IS the script dir's parent's parent
# If running from the repo, navigate up from deploy/fly/
if [ -f "${SCRIPT_DIR}/../../package.json" ]; then
  REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
elif [ -f "${SCRIPT_DIR}/package.json" ]; then
  REPO_ROOT="${SCRIPT_DIR}"
else
  fail "Cannot find NemoClaw repo root. Run this from the repo or deploy package."
fi

info "Repo root: ${REPO_ROOT}"

# Verify critical files exist
for f in Dockerfile nemoclaw/dist nemoclaw/openclaw.plugin.json scripts/nemoclaw-start.sh; do
  [ -e "${REPO_ROOT}/${f}" ] || fail "Missing ${f} — is this a complete NemoClaw checkout?"
done

# ── Gather configuration ───────────────────────────────────────────
RANDOM_SUFFIX=$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n' | head -c 4)
DEFAULT_APP="nemoclaw-${RANDOM_SUFFIX}"

echo ""
ask "App name [${DEFAULT_APP}]: "
read -r APP_NAME
APP_NAME="${APP_NAME:-${DEFAULT_APP}}"

echo ""
info "Available regions: https://fly.io/docs/reference/regions/"
ask "Region [iad] (Virginia): "
read -r REGION
REGION="${REGION:-iad}"

echo ""
ask "Setup password (protects /setup wizard): "
read -rs SETUP_PASSWORD
echo ""
[ -n "${SETUP_PASSWORD}" ] || fail "Setup password is required."

echo ""
echo -e "  ${BOLD}Choose LLM provider:${NC}"
echo "    1) Anthropic"
echo "    2) OpenAI"
echo "    3) NVIDIA"
echo "    4) Google Gemini"
echo "    5) OpenRouter"
echo "    6) Moonshot AI"
echo "    7) MiniMax"
echo ""
ask "Provider [1]: "
read -r PROVIDER_CHOICE
PROVIDER_CHOICE="${PROVIDER_CHOICE:-1}"

case "${PROVIDER_CHOICE}" in
  1) AUTH_CHOICE="anthropic" ;;
  2) AUTH_CHOICE="openai" ;;
  3) AUTH_CHOICE="nvidia" ;;
  4) AUTH_CHOICE="gemini" ;;
  5) AUTH_CHOICE="openrouter" ;;
  6) AUTH_CHOICE="moonshot" ;;
  7) AUTH_CHOICE="minimax" ;;
  *) fail "Invalid provider choice." ;;
esac

echo ""
ask "API key for ${AUTH_CHOICE}: "
read -rs API_KEY
echo ""
[ -n "${API_KEY}" ] || fail "API key is required."

# Generate gateway token
GATEWAY_TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')

# ── Optional: Channel tokens ───────────────────────────────────────
echo ""
echo -e "  ${BOLD}Channel connections (optional — press Enter to skip):${NC}"
echo ""

ask "Telegram bot token: "
read -rs TELEGRAM_TOKEN
echo ""

ask "Discord bot token: "
read -rs DISCORD_TOKEN
echo ""

ask "Slack bot token (xoxb-...): "
read -rs SLACK_BOT_TOKEN
echo ""

SLACK_APP_TOKEN=""
if [ -n "${SLACK_BOT_TOKEN}" ]; then
  ask "Slack app token (xapp-...): "
  read -rs SLACK_APP_TOKEN
  echo ""
fi

# ── Optional: Solana config ────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Solana configuration (optional — press Enter for defaults):${NC}"
echo ""

ask "Solana RPC URL [default]: "
read -r SOLANA_RPC_URL
echo ""

ask "Helius API key: "
read -rs HELIUS_API_KEY
echo ""

ask "Privy App ID: "
read -r PRIVY_APP_ID

ask "Privy App Secret: "
read -rs PRIVY_APP_SECRET
echo ""

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Deployment Summary${NC}"
echo "  ─────────────────────────────────────────"
echo "  App name:     ${APP_NAME}"
echo "  Region:       ${REGION}"
echo "  Provider:     ${AUTH_CHOICE}"
echo "  Channels:     $([ -n "${TELEGRAM_TOKEN}" ] && echo 'Telegram ')$([ -n "${DISCORD_TOKEN}" ] && echo 'Discord ')$([ -n "${SLACK_BOT_TOKEN}" ] && echo 'Slack ')$([ -z "${TELEGRAM_TOKEN}${DISCORD_TOKEN}${SLACK_BOT_TOKEN}" ] && echo 'none')"
echo "  URL:          https://${APP_NAME}.fly.dev"
echo "  ─────────────────────────────────────────"
echo ""
ask "Deploy now? [Y/n]: "
read -r CONFIRM
if [[ "${CONFIRM}" =~ ^[Nn] ]]; then
  info "Cancelled."
  exit 0
fi

# ── Generate fly.toml ──────────────────────────────────────────────
info "Generating fly.toml..."
cd "${REPO_ROOT}"

sed -e "s/APP_NAME_PLACEHOLDER/${APP_NAME}/" \
    -e "s/REGION_PLACEHOLDER/${REGION}/" \
    deploy/fly/fly.toml.template > fly.toml

info "fly.toml written."

# ── Create Fly app ─────────────────────────────────────────────────
info "Creating Fly app '${APP_NAME}' in ${REGION}..."
$FLY apps create "${APP_NAME}" --machines -o personal 2>/dev/null || {
  warn "App may already exist — continuing."
}

# ── Create volume ──────────────────────────────────────────────────
info "Creating persistent volume..."
$FLY volumes create nemoclaw_data \
  --app "${APP_NAME}" \
  --region "${REGION}" \
  --size 1 \
  --yes 2>/dev/null || {
  warn "Volume may already exist — continuing."
}

# ── Set secrets ────────────────────────────────────────────────────
info "Setting secrets (encrypted at rest, never in logs)..."

SECRET_ARGS=(
  "SETUP_PASSWORD=${SETUP_PASSWORD}"
  "NEMOCLAW_GATEWAY_TOKEN=${GATEWAY_TOKEN}"
  "NEMOCLAW_API_KEY=${API_KEY}"
  "NEMOCLAW_AUTH_CHOICE=${AUTH_CHOICE}"
)

[ -n "${TELEGRAM_TOKEN}" ] && SECRET_ARGS+=("NEMOCLAW_TELEGRAM_TOKEN=${TELEGRAM_TOKEN}")
[ -n "${DISCORD_TOKEN}" ] && SECRET_ARGS+=("NEMOCLAW_DISCORD_TOKEN=${DISCORD_TOKEN}")
[ -n "${SLACK_BOT_TOKEN}" ] && SECRET_ARGS+=("NEMOCLAW_SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}")
[ -n "${SLACK_APP_TOKEN}" ] && SECRET_ARGS+=("NEMOCLAW_SLACK_APP_TOKEN=${SLACK_APP_TOKEN}")
[ -n "${SOLANA_RPC_URL}" ] && SECRET_ARGS+=("SOLANA_RPC_URL=${SOLANA_RPC_URL}")
[ -n "${HELIUS_API_KEY}" ] && SECRET_ARGS+=("HELIUS_API_KEY=${HELIUS_API_KEY}")
[ -n "${PRIVY_APP_ID}" ] && SECRET_ARGS+=("PRIVY_APP_ID=${PRIVY_APP_ID}")
[ -n "${PRIVY_APP_SECRET}" ] && SECRET_ARGS+=("PRIVY_APP_SECRET=${PRIVY_APP_SECRET}")

$FLY secrets set "${SECRET_ARGS[@]}" --app "${APP_NAME}" --stage

info "Secrets staged."

# ── Build & deploy ─────────────────────────────────────────────────
info "Building and deploying (this takes a few minutes on first deploy)..."
$FLY deploy \
  --app "${APP_NAME}" \
  --dockerfile deploy/fly/Dockerfile \
  --region "${REGION}" \
  --wait-timeout 300 \
  --strategy immediate

# ── Done ───────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "  App URL:       ${BOLD}https://${APP_NAME}.fly.dev${NC}"
echo -e "  Setup wizard:  ${BOLD}https://${APP_NAME}.fly.dev/setup${NC}"
echo -e "  Health check:  https://${APP_NAME}.fly.dev/healthz"
echo -e "  Gateway URL:   ${BOLD}wss://${APP_NAME}.fly.dev${NC}"
echo -e "  Gateway token: ${GATEWAY_TOKEN}"
echo ""
echo -e "  ${BOLD}Connect your local CLI:${NC}"
echo ""
echo "    openclaw config set gateway.mode remote"
echo "    openclaw config set gateway.remote.url wss://${APP_NAME}.fly.dev"
echo "    openclaw config set gateway.remote.token ${GATEWAY_TOKEN}"
echo "    openclaw health"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo ""
echo "    fly logs -a ${APP_NAME}          # Stream live logs"
echo "    fly ssh console -a ${APP_NAME}   # SSH into the machine"
echo "    fly apps restart ${APP_NAME}     # Restart after config changes"
echo "    fly status -a ${APP_NAME}        # Check machine status"
echo ""
