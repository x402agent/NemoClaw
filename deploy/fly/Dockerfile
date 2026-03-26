# NemoClaw Fly.io deployment image
# Builds the full NemoClaw stack + wrapper server for managed deployment.

FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 python3-pip python3-venv \
        curl git ca-certificates \
        iproute2 bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI tools (x86_64 only — arm64 skipped gracefully)
ARG SOLANA_VERSION=v3.1.9
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    if [ "${arch}" = "arm64" ]; then \
      echo 'WARN: Agave does not publish Linux arm64 CLI installers; skipping Solana CLI'; \
    else \
      sh -c "$(curl -sSfL https://release.anza.xyz/${SOLANA_VERSION}/install)"; \
      SOLANA_BIN_DIR="/root/.local/share/solana/install/active_release/bin"; \
      ln -sf "${SOLANA_BIN_DIR}/solana" /usr/local/bin/solana; \
      ln -sf "${SOLANA_BIN_DIR}/solana-test-validator" /usr/local/bin/solana-test-validator; \
      ln -sf "${SOLANA_BIN_DIR}/solana-keygen" /usr/local/bin/solana-keygen; \
      if [ -x "${SOLANA_BIN_DIR}/spl-token" ]; then \
        ln -sf "${SOLANA_BIN_DIR}/spl-token" /usr/local/bin/spl-token; \
      fi; \
    fi

# Install PyYAML for blueprint runner
RUN pip3 install --break-system-packages pyyaml

# Install OpenClaw CLI
RUN npm install -g openclaw@2026.3.11

# Install Helius CLI
RUN npm install -g helius-cli 2>/dev/null || echo 'WARN: helius-cli install skipped'

# ── Copy NemoClaw plugin + assets ──────────────────────────────────
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

# Install runtime dependencies
WORKDIR /opt/nemoclaw
RUN npm install --omit=dev

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

# ── Copy startup scripts ──────────────────────────────────────────
COPY scripts/nemoclaw-start.sh /usr/local/bin/nemoclaw-start
COPY scripts/nemoclaw-solana-agent.sh /usr/local/bin/nemoclaw-solana-agent
COPY scripts/nemoclaw-payment-app.sh /usr/local/bin/nemoclaw-payment-app
COPY scripts/nemoclaw-telegram-bot.sh /usr/local/bin/nemoclaw-telegram-bot
COPY scripts/nemoclaw-swarm-bot.sh /usr/local/bin/nemoclaw-swarm-bot
COPY scripts/nemoclaw-websocket-server.sh /usr/local/bin/nemoclaw-websocket-server
COPY scripts/nemoclaw-solana-bridge.sh /usr/local/bin/nemoclaw-solana-bridge
COPY scripts/nemoclaw-solana-stack.sh /usr/local/bin/nemoclaw-solana-stack
RUN chmod +x /usr/local/bin/nemoclaw-*

# ── Wrapper server (setup wizard + proxy) ──────────────────────────
COPY deploy/fly/wrapper/ /opt/wrapper/
WORKDIR /opt/wrapper
RUN npm install --omit=dev

# ── Entrypoint ─────────────────────────────────────────────────────
COPY deploy/fly/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Persistent volume mount point
RUN mkdir -p /data
VOLUME /data

ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

WORKDIR /data
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
