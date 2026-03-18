# NemoClaw sandbox image — OpenClaw + NemoClaw plugin inside OpenShell

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 python3-pip python3-venv \
        curl git ca-certificates \
        iproute2 bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI tools via an explicit Agave release.
# Anza publishes installers for x86_64 Linux, x86_64/aarch64 macOS, and Windows,
# but not for Linux aarch64. Apple Silicon hosts building a Linux/arm64 sandbox
# must therefore skip the bundled CLI install instead of hard-failing the image.
ARG SOLANA_VERSION=v3.1.9
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    if [ "${arch}" = "arm64" ]; then \
      echo 'WARN: Agave does not publish Linux arm64 CLI installers; skipping Solana CLI in this sandbox build'; \
    else \
      sh -c "$(curl -sSfL https://release.anza.xyz/${SOLANA_VERSION}/install)"; \
      SOLANA_BIN_DIR="/root/.local/share/solana/install/active_release/bin"; \
      ln -sf "${SOLANA_BIN_DIR}/solana" /usr/local/bin/solana; \
      ln -sf "${SOLANA_BIN_DIR}/solana-test-validator" /usr/local/bin/solana-test-validator; \
      ln -sf "${SOLANA_BIN_DIR}/solana-keygen" /usr/local/bin/solana-keygen; \
      if [ -x "${SOLANA_BIN_DIR}/spl-token" ]; then \
        ln -sf "${SOLANA_BIN_DIR}/spl-token" /usr/local/bin/spl-token; \
      else \
        echo 'WARN: spl-token is not bundled in this Agave release'; \
      fi; \
    fi

# Create sandbox user (matches OpenShell convention)
RUN groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox \
    && mkdir -p /sandbox/.openclaw /sandbox/.nemoclaw \
    && chown -R sandbox:sandbox /sandbox

# Install OpenClaw CLI
RUN npm install -g openclaw@2026.3.11

# Install PyYAML for blueprint runner
RUN pip3 install --break-system-packages pyyaml

# Copy our plugin and blueprint into the sandbox
COPY nemoclaw/dist/ /opt/nemoclaw/dist/
COPY nemoclaw/openclaw.plugin.json /opt/nemoclaw/
COPY nemoclaw/package.json /opt/nemoclaw/
COPY nemoclaw-blueprint/ /opt/nemoclaw-blueprint/
COPY Pump-Fun/agent-app/ /opt/pump-fun/agent-app/
COPY Pump-Fun/agent-tasks/ /opt/pump-fun/agent-tasks/
COPY Pump-Fun/docs/ /opt/pump-fun/docs/
COPY Pump-Fun/packages/defi-agents/agents-manifest.json /opt/pump-fun/defi-agents/agents-manifest.json
COPY Pump-Fun/packages/defi-agents/locales/ /opt/pump-fun/defi-agents/locales/
COPY Pump-Fun/packages/defi-agents/docs/ /opt/pump-fun/defi-agents/docs/
COPY Pump-Fun/packages/defi-agents/README.md /opt/pump-fun/defi-agents/README.md
COPY Pump-Fun/packages/defi-agents/llms.txt /opt/pump-fun/defi-agents/llms.txt
COPY Pump-Fun/packages/defi-agents/llms-full.txt /opt/pump-fun/defi-agents/llms-full.txt
COPY Pump-Fun/packages/defi-agents/src/ /opt/pump-fun/defi-agents/src/
COPY Pump-Fun/pumpkit/ /opt/pump-fun/pumpkit/
COPY Pump-Fun/pumpkit/agent-prompts/ /opt/pump-fun/agent-prompts/
COPY Pump-Fun/telegram-bot/ /opt/pump-fun/telegram-bot/
COPY Pump-Fun/swarm-bot/ /opt/pump-fun/swarm-bot/
COPY Pump-Fun/websocket-server/ /opt/pump-fun/websocket-server/
COPY Pump-Fun/tools/ /opt/pump-fun/tools/
COPY Pump-Fun/x402/ /opt/pump-fun/x402/
COPY Pump-Fun/src/ /opt/pump-fun/sdk/src/
COPY pump-fun-skills-main/tokenized-agents/ /opt/pump-fun/tokenized-agents-skill/

# Install runtime dependencies only (no devDependencies, no build step)
WORKDIR /opt/nemoclaw
RUN npm install --omit=dev

# Install Pump-Fun Solana agent dependencies so the tracker bot can run
WORKDIR /opt/pump-fun/agent-app
RUN npm install

WORKDIR /opt/pump-fun/telegram-bot
RUN npm install

WORKDIR /opt/pump-fun/swarm-bot
RUN npm install

WORKDIR /opt/pump-fun/websocket-server
RUN npm install

WORKDIR /opt/pump-fun/x402
RUN npm install

# Set up blueprint for local resolution
RUN mkdir -p /sandbox/.nemoclaw/blueprints/0.1.0 \
    && cp -r /opt/nemoclaw-blueprint/* /sandbox/.nemoclaw/blueprints/0.1.0/

# Copy startup script
COPY scripts/nemoclaw-start.sh /usr/local/bin/nemoclaw-start
COPY scripts/nemoclaw-solana-agent.sh /usr/local/bin/nemoclaw-solana-agent
COPY scripts/nemoclaw-payment-app.sh /usr/local/bin/nemoclaw-payment-app
COPY scripts/nemoclaw-telegram-bot.sh /usr/local/bin/nemoclaw-telegram-bot
COPY scripts/nemoclaw-swarm-bot.sh /usr/local/bin/nemoclaw-swarm-bot
COPY scripts/nemoclaw-websocket-server.sh /usr/local/bin/nemoclaw-websocket-server
COPY scripts/nemoclaw-solana-bridge.sh /usr/local/bin/nemoclaw-solana-bridge
COPY scripts/nemoclaw-solana-stack.sh /usr/local/bin/nemoclaw-solana-stack
RUN chmod +x /usr/local/bin/nemoclaw-start
RUN chmod +x /usr/local/bin/nemoclaw-solana-agent
RUN chmod +x /usr/local/bin/nemoclaw-payment-app
RUN chmod +x /usr/local/bin/nemoclaw-telegram-bot
RUN chmod +x /usr/local/bin/nemoclaw-swarm-bot
RUN chmod +x /usr/local/bin/nemoclaw-websocket-server
RUN chmod +x /usr/local/bin/nemoclaw-solana-bridge
RUN chmod +x /usr/local/bin/nemoclaw-solana-stack

# Install Helius CLI for advanced RPC operations
RUN npm install -g helius-cli 2>/dev/null || echo 'WARN: helius-cli install skipped'

WORKDIR /sandbox
USER sandbox

# Pre-create OpenClaw directories and Privy skill
RUN mkdir -p /sandbox/.openclaw/agents/main/agent \
    && mkdir -p /sandbox/.openclaw/workspace/skills/privy \
    && mkdir -p /sandbox/.nemoclaw/wallets \
    && chmod 700 /sandbox/.openclaw \
    && chmod 700 /sandbox/.nemoclaw/wallets

# Write Privy agentic wallet skill for OpenClaw
RUN cat > /sandbox/.openclaw/workspace/skills/privy/SKILL.md <<'PRIVY_SKILL'
---
name: privy-agentic-wallets
description: |
  Create and manage Solana agentic wallets via Privy server wallets.
  Use when the agent needs its own wallet to sign transactions,
  send SOL/USDC, or interact with on-chain programs autonomously.
---

## Privy Agentic Wallet Skill

This skill enables autonomous wallet operations via Privy server wallets.

### Environment Variables
- `PRIVY_APP_ID` — Your Privy app ID (from dashboard.privy.io)
- `PRIVY_APP_SECRET` — Your Privy app secret

### Capabilities
- **Create wallets**: Solana server wallets for autonomous signing
- **Attach policies**: Spending limits, chain restrictions, contract allowlists
- **Sign transactions**: Agent can sign and submit transactions within policy bounds
- **No local keys**: Private keys never leave Privy infrastructure

### Create a Wallet
```bash
curl -X POST https://auth.privy.io/api/v1/wallets \
  -H "Authorization: Basic $(echo -n $PRIVY_APP_ID:$PRIVY_APP_SECRET | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{"chain_type": "solana"}'
```

### Security Rules
- NEVER log or expose PRIVY_APP_SECRET
- Start with restrictive policies, loosen over time
- Only fund wallets with amounts you can afford to lose
- Always verify transactions match intended parameters
PRIVY_SKILL

# Write openclaw.json: set nvidia as default provider, route through
# inference.local (OpenShell gateway proxy). No API key needed here —
# openshell injects credentials via the provider configuration.
RUN python3 -c "\
import json, os; \
config = { \
    'agents': {'defaults': {'model': {'primary': 'nvidia/nemotron-3-super-120b-a12b'}}}, \
    'models': {'mode': 'merge', 'providers': {'nvidia': { \
        'baseUrl': 'https://inference.local/v1', \
        'apiKey': 'openshell-managed', \
        'api': 'openai-completions', \
        'models': [{'id': 'nemotron-3-super-120b-a12b', 'name': 'NVIDIA Nemotron 3 Super 120B', 'reasoning': False, 'input': ['text'], 'cost': {'input': 0, 'output': 0, 'cacheRead': 0, 'cacheWrite': 0}, 'contextWindow': 131072, 'maxTokens': 4096}] \
    }}} \
}; \
path = os.path.expanduser('~/.openclaw/openclaw.json'); \
json.dump(config, open(path, 'w'), indent=2); \
os.chmod(path, 0o600)"

# Install NemoClaw plugin into OpenClaw
RUN openclaw doctor --fix > /dev/null 2>&1 || true \
    && openclaw plugins install /opt/nemoclaw > /dev/null 2>&1 || true

ENTRYPOINT ["/bin/bash"]
CMD []
