#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# NemoClaw sandbox entrypoint. Configures OpenClaw and starts the dashboard
# gateway inside the sandbox so the forwarded host port has a live upstream.
#
# Optional env:
#   NVIDIA_API_KEY   API key for NVIDIA-hosted inference
#   CHAT_UI_URL      Browser origin that will access the forwarded dashboard

set -euo pipefail

NEMOCLAW_CMD=("$@")
CHAT_UI_URL="${CHAT_UI_URL:-http://127.0.0.1:18789}"
PUBLIC_PORT=18789
WORKSPACE_ROOT="${HOME:-/sandbox}/.openclaw/workspace"
PUMPFUN_ROOT="/opt/pump-fun"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"

write_workspace_prompts() {
  mkdir -p "${WORKSPACE_ROOT}/pumpfun"

  ln -snf "${PUMPFUN_ROOT}/docs" "${WORKSPACE_ROOT}/pumpfun/docs"
  ln -snf "${PUMPFUN_ROOT}/agent-prompts" "${WORKSPACE_ROOT}/pumpfun/agent-prompts"
  ln -snf "${PUMPFUN_ROOT}/agent-tasks" "${WORKSPACE_ROOT}/pumpfun/agent-tasks"
  ln -snf "${PUMPFUN_ROOT}/agent-app" "${WORKSPACE_ROOT}/pumpfun/agent-app"
  ln -snf "${PUMPFUN_ROOT}/defi-agents" "${WORKSPACE_ROOT}/pumpfun/defi-agents"
  ln -snf "${PUMPFUN_ROOT}/telegram-bot" "${WORKSPACE_ROOT}/pumpfun/telegram-bot"
  ln -snf "${PUMPFUN_ROOT}/swarm-bot" "${WORKSPACE_ROOT}/pumpfun/swarm-bot"
  ln -snf "${PUMPFUN_ROOT}/websocket-server" "${WORKSPACE_ROOT}/pumpfun/websocket-server"
  ln -snf "${PUMPFUN_ROOT}/x402" "${WORKSPACE_ROOT}/pumpfun/x402"
  ln -snf "${PUMPFUN_ROOT}/tools" "${WORKSPACE_ROOT}/pumpfun/tools"
  ln -snf "${PUMPFUN_ROOT}/sdk" "${WORKSPACE_ROOT}/pumpfun/sdk"
  ln -snf "${PUMPFUN_ROOT}/tokenized-agents-skill" "${WORKSPACE_ROOT}/pumpfun/tokenized-agents-skill"
  ln -snf "${PUMPFUN_ROOT}/pumpkit" "${WORKSPACE_ROOT}/pumpfun/pumpkit"

  cat > "${WORKSPACE_ROOT}/AGENTS.md" <<'EOF'
# Pump-Fun Solana Agent Workspace

This OpenClaw workspace is a **Solana autonomous developer agent** with built-in
Pump.fun SDK, tokenized agent payments, the Pump-Fun Telegram/runtime stack,
44 DeFi agent personas, and an encrypted Privy agentic wallet.

Core behavior:
- Treat `pumpfun/docs/` as the primary local documentation corpus for protocol behavior, APIs, architecture, deployment, troubleshooting, and roadmap questions.
- Treat `pumpfun/docs/pump-official/` and `pumpfun/docs/pump-public-docs/` as authoritative references for official Pump program behavior and terminology.
- Use `pumpfun/telegram-bot/` as the primary implementation reference for NemoClaw's Pump-Fun Telegram bot runtime.
- Use `pumpfun/agent-app/` as the implementation reference for the bundled payment-gated app and tracker bot.
- Use `pumpfun/sdk/` to access the Pump-Fun SDK source (`@nirholas/pump-sdk`) for token creation, bonding curve operations, AMM pools, and fee management.
- Use `pumpfun/defi-agents/src/` to load any of the 44 DeFi agent persona JSONs for specialized capabilities.
- Use `pumpfun/tokenized-agents-skill/` for the `@pump-fun/agent-payments-sdk` integration guide.
- Use `pumpfun/x402/` for HTTP 402 payment patterns, Solana USDC micropayments, and API monetization.
- Use `pumpfun/swarm-bot/` and `pumpfun/websocket-server/` for dashboard, realtime relay, and multi-bot coordination patterns.
- Use `pumpfun/pumpkit/` for the modular PumpKit packages, tutorials, docs, and agent-prompts.
- Use `pumpfun/tools/` for operational scripts and keypair verification helpers.
- Use `pumpfun/agent-prompts/` and `pumpfun/agent-tasks/` as scaffolding and design references when extending or refactoring the Solana agent.
- Before proposing Pump.fun transaction logic, fee logic, or monitoring logic, read the relevant local docs first instead of improvising.

Solana capabilities:
- `solana` CLI for config, keygen, deploy, transfer
- `solana-test-validator` for local development (clones Pump programs from mainnet)
- `spl-token` for SPL token operations
- `helius` CLI for Helius RPC and account tooling when configured
- Privy agentic wallet for secure, policy-governed transaction signing
- NemoClaw vault at `~/.nemoclaw/vault/` for append-only JSONL wallet, trade, and heartbeat logs
- Full Pump-Fun SDK for token creation, trading, and fee management

High-value local docs:
- `pumpfun/docs/vision.md`
- `pumpfun/docs/ecosystem.md`
- `pumpfun/docs/getting-started.md`
- `pumpfun/docs/api-reference.md`
- `pumpfun/docs/architecture.md`
- `pumpfun/docs/end-to-end-workflow.md`
- `pumpfun/docs/rpc-best-practices.md`
- `pumpfun/docs/security.md`
- `pumpfun/docs/token-incentives.md`
- `pumpfun/docs/channel-bot-architecture.md`

When working on the bundled Telegram/runtime stack:
- Start with `pumpfun/telegram-bot/src/` for monitoring, alerts, and API behavior.
- Use `pumpfun/agent-app/src/` for payment-gated app flows and wallet-adapter UX.
- Pull persona definitions from `pumpfun/defi-agents/src/*.json`.
- Preserve Solana addresses and discriminators exactly as documented.
- Prefer the local docs and code over generic Solana advice when they conflict.
EOF

  cat > "${WORKSPACE_ROOT}/pumpfun/README.md" <<'EOF'
# Pump-Fun Corpus

Bundled local references for the Solana NemoClaw environment:

- `docs/`: Pump-Fun documentation corpus, including architecture, API reference, deployment, analytics, troubleshooting, roadmap, and official/public protocol docs.
- `sdk/`: Pump-Fun SDK source code (`@nirholas/pump-sdk`) — bonding curve math, AMM pools, fee sharing, token incentives.
- `telegram-bot/`: primary Pump-Fun Telegram monitoring bot with REST API and alerting.
- `agent-app/`: payment-gated Solana agent app and tracker-bot reference implementation.
- `defi-agents/`: raw persona JSON definitions, locales, manifests, and docs for the DeFi agent library.
- `tokenized-agents-skill/`: Full `@pump-fun/agent-payments-sdk` integration guide (SKILL.md).
- `x402/`: HTTP 402 payment protocol implementation for Solana/USDC monetization.
- `swarm-bot/`: multi-strategy bot manager with dashboard and SQLite state.
- `websocket-server/`: realtime Pump-Fun launch relay server for browser clients.
- `pumpkit/`: monorepo containing reusable packages, tutorials, prompts, docs, and web dashboard code.
- `tools/`: operational helper scripts and keypair/security utilities.
- `agent-prompts/`: build and refactor prompts for PumpKit agent workflows.
- `agent-tasks/`: standalone task specs describing parallel deliverables and expected bot/docs outputs.

Suggested reading order for new work:
1. `docs/vision.md`
2. `docs/ecosystem.md`
3. `docs/architecture.md`
4. `docs/api-reference.md`
5. `docs/end-to-end-workflow.md`
6. `docs/rpc-best-practices.md`
7. `sdk/src/sdk.ts` (core SDK)
8. `tokenized-agents-skill/SKILL.md`
9. `telegram-bot/src/index.ts`
10. `defi-agents/src/pump-fun-sdk-expert.json`
11. `agent-app/src/app/api/pump-fun/verify-payment/route.ts`
EOF

  cat > "${WORKSPACE_ROOT}/pumpfun/PUMPKIT_TASKS.md" <<'EOF'
# Active PumpKit Engineering Tasks

Use these as current implementation priorities when working in `pumpfun/pumpkit/`.

## Task 01
- Add ESLint flat-config linting to every PumpKit package so `cd pumpkit && npx turbo lint` works across `core`, `monitor`, `channel`, `claim`, `tracker`, and `web`.
- Follow the root ESLint style, add package `lint` scripts, install required dependencies, and fix reasonable lint failures.

## Task 02
- Add comprehensive Vitest + Testing Library coverage for `@pumpkit/web`.
- Cover components, hooks, and lib modules under `pumpkit/packages/web/src/`.
- Ensure `cd pumpkit && npx turbo test --filter=@pumpkit/web` passes.

## Relevant PumpKit paths
- `pumpkit/packages/`
- `pumpkit/agent-prompts/`
- `pumpkit/tutorials/`
- `pumpkit/docs/`
- `pumpkit/turbo.json`
- `pumpkit/package.json`
EOF
}

fix_openclaw_config() {
  python3 - <<'PYCFG'
import json
import os
from urllib.parse import urlparse

home = os.environ.get('HOME', '/sandbox')
config_path = os.path.join(home, '.openclaw', 'openclaw.json')
os.makedirs(os.path.dirname(config_path), exist_ok=True)

cfg = {}
if os.path.exists(config_path):
    with open(config_path) as f:
        cfg = json.load(f)

cfg.setdefault('agents', {}).setdefault('defaults', {}).setdefault('model', {})['primary'] = 'nvidia/nemotron-3-super-120b-a12b'

chat_ui_url = os.environ.get('CHAT_UI_URL', 'http://127.0.0.1:18789')
parsed = urlparse(chat_ui_url)
chat_origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else 'http://127.0.0.1:18789'
local_origin = f'http://127.0.0.1:{os.environ.get("PUBLIC_PORT", "18789")}'
origins = [local_origin]
if chat_origin not in origins:
    origins.append(chat_origin)

gateway = cfg.setdefault('gateway', {})
gateway['mode'] = 'local'
gateway['controlUi'] = {
    'allowInsecureAuth': True,
    'dangerouslyDisableDeviceAuth': True,
    'allowedOrigins': origins,
}
gateway['trustedProxies'] = ['127.0.0.1', '::1']

with open(config_path, 'w') as f:
    json.dump(cfg, f, indent=2)
os.chmod(config_path, 0o600)
PYCFG
}

write_auth_profile() {
  if [ -z "${NVIDIA_API_KEY:-}" ]; then
    return
  fi

  python3 - <<'PYAUTH'
import json
import os
path = os.path.expanduser('~/.openclaw/agents/main/agent/auth-profiles.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump({
    'nvidia:manual': {
        'type': 'api_key',
        'provider': 'nvidia',
        'keyRef': {'source': 'env', 'id': 'NVIDIA_API_KEY'},
        'profileId': 'nvidia:manual',
    }
}, open(path, 'w'))
os.chmod(path, 0o600)
PYAUTH
}

print_dashboard_urls() {
  local token chat_ui_base local_url remote_url

  token="$(python3 - <<'PYTOKEN'
import json
import os
path = os.path.expanduser('~/.openclaw/openclaw.json')
try:
    cfg = json.load(open(path))
except Exception:
    print('')
else:
    print(cfg.get('gateway', {}).get('auth', {}).get('token', ''))
PYTOKEN
)"

  chat_ui_base="${CHAT_UI_URL%/}"
  local_url="http://127.0.0.1:${PUBLIC_PORT}/"
  remote_url="${chat_ui_base}/"
  if [ -n "$token" ]; then
    local_url="${local_url}#token=${token}"
    remote_url="${remote_url}#token=${token}"
  fi

  echo "[gateway] Local UI: ${local_url}"
  echo "[gateway] Remote UI: ${remote_url}"
}

start_auto_pair() {
  nohup python3 - <<'PYAUTOPAIR' >> /tmp/gateway.log 2>&1 &
import json
import subprocess
import time

DEADLINE = time.time() + 600
QUIET_POLLS = 0
APPROVED = 0

def run(*args):
    proc = subprocess.run(args, capture_output=True, text=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()

while time.time() < DEADLINE:
    rc, out, err = run('openclaw', 'devices', 'list', '--json')
    if rc != 0 or not out:
        time.sleep(1)
        continue
    try:
        data = json.loads(out)
    except Exception:
        time.sleep(1)
        continue

    pending = data.get('pending') or []
    paired = data.get('paired') or []
    has_browser = any((d.get('clientId') == 'openclaw-control-ui') or (d.get('clientMode') == 'webchat') for d in paired if isinstance(d, dict))

    if pending:
        QUIET_POLLS = 0
        for device in pending:
            request_id = (device or {}).get('requestId')
            if not request_id:
                continue
            arc, aout, aerr = run('openclaw', 'devices', 'approve', request_id, '--json')
            if arc == 0:
                APPROVED += 1
                print(f'[auto-pair] approved request={request_id}')
            elif aout or aerr:
                print(f'[auto-pair] approve failed request={request_id}: {(aerr or aout)[:400]}')
        time.sleep(1)
        continue

    if has_browser:
        QUIET_POLLS += 1
        if QUIET_POLLS >= 4:
            print(f'[auto-pair] browser pairing converged approvals={APPROVED}')
            break
    elif APPROVED > 0:
        QUIET_POLLS += 1
    else:
        QUIET_POLLS = 0

    time.sleep(1)
else:
    print(f'[auto-pair] watcher timed out approvals={APPROVED}')
PYAUTOPAIR
  echo "[gateway] auto-pair watcher launched (pid $!)"
}

echo 'Setting up NemoClaw...'
openclaw doctor --fix > /dev/null 2>&1 || true
openclaw models set nvidia/nemotron-3-super-120b-a12b > /dev/null 2>&1 || true
write_auth_profile
export CHAT_UI_URL PUBLIC_PORT
fix_openclaw_config
write_workspace_prompts

# ── Solana CLI configuration ──────────────────────────────────────
if command -v solana &>/dev/null; then
  echo "[solana] Configuring Solana CLI..."
  solana config set --url "${SOLANA_RPC_URL}" 2>/dev/null || true
  echo "[solana] RPC: ${SOLANA_RPC_URL}"

  # Link SDK source and DeFi agent personas into workspace
  ln -snf "${PUMPFUN_ROOT}/sdk" "${WORKSPACE_ROOT}/pumpfun/sdk"
  ln -snf "${PUMPFUN_ROOT}/defi-agents" "${WORKSPACE_ROOT}/pumpfun/defi-agents"
  ln -snf "${PUMPFUN_ROOT}/tokenized-agents-skill" "${WORKSPACE_ROOT}/pumpfun/tokenized-agents-skill"
  ln -snf "${PUMPFUN_ROOT}/pumpkit" "${WORKSPACE_ROOT}/pumpfun/pumpkit"
  if command -v helius &>/dev/null; then
    echo "[solana] Helius CLI: $(helius --version 2>/dev/null || echo 'available')"
  fi
fi

# ── Privy wallet credentials ──────────────────────────────────────
if [ -n "${PRIVY_APP_ID:-}" ] && [ -n "${PRIVY_APP_SECRET:-}" ]; then
  echo "[privy] Injecting Privy wallet credentials into OpenClaw config..."
  python3 - <<'PYPRIVY'
import json, os
home = os.environ.get('HOME', '/sandbox')
config_path = os.path.join(home, '.openclaw', 'openclaw.json')
cfg = {}
if os.path.exists(config_path):
    with open(config_path) as f:
        cfg = json.load(f)
cfg.setdefault('env', {}).setdefault('vars', {}).update({
    'PRIVY_APP_ID': os.environ['PRIVY_APP_ID'],
    'PRIVY_APP_SECRET': os.environ['PRIVY_APP_SECRET'],
    'SOLANA_RPC_URL': os.environ.get('SOLANA_RPC_URL', ''),
})
with open(config_path, 'w') as f:
    json.dump(cfg, f, indent=2)
os.chmod(config_path, 0o600)
PYPRIVY
  echo "[privy] Privy credentials configured for agentic wallet access"
fi

openclaw plugins install /opt/nemoclaw > /dev/null 2>&1 || true

if [ ${#NEMOCLAW_CMD[@]} -gt 0 ]; then
  exec "${NEMOCLAW_CMD[@]}"
fi

nohup openclaw gateway run > /tmp/gateway.log 2>&1 &
echo "[gateway] openclaw gateway launched (pid $!)"
start_auto_pair
print_dashboard_urls
