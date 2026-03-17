# Deploy to Railway in 5 Minutes

> Ship any PumpKit bot to production with Railway — persistent volumes, health checks, and auto-restarts.

## What You'll Build

A production deployment of any PumpKit bot on [Railway](https://railway.com) with:
- Docker-based builds (Alpine Node.js, non-root user)
- Persistent volumes for SQLite databases
- Health checks and auto-restarts
- Environment variable management
- Log monitoring

```
Your Code (GitHub)
    │
    ▼
Railway (Docker Build)
    │
    ├── Pulls from your repo
    ├── Builds with multi-stage Dockerfile
    ├── Mounts persistent volume for /app/data
    ├── Runs health checks every 30s
    └── Auto-restarts on failure (up to 10 retries)
    │
    ▼
Your Bot — running 24/7
```

## Prerequisites

- A [Railway](https://railway.com) account (free tier available)
- A GitHub account (Railway deploys from GitHub)
- A working PumpKit bot (any of the tutorials 01-04)
- Railway CLI installed (Step 1 below)

## Step 1: Install the Railway CLI

```bash
# macOS / Linux
curl -fsSL https://railway.com/install.sh | sh

# Or via npm
npm install -g @railway/cli

# Verify installation
railway --version
```

Log in:

```bash
railway login
```

This opens your browser for authentication.

## Step 2: Initialize Your Railway Project

From the root of your PumpKit checkout:

```bash
cd pumpkit
railway init
```

Select "Empty Project" when prompted. Railway creates a project linked to your current directory.

```
✔ Project created: pumpkit-bot
✔ Environment: production
```

## Step 3: Choose Which Bot to Deploy

Each PumpKit bot has its own Dockerfile. Pick the one you want:

| Bot | Directory | Dockerfile |
|-----|-----------|------------|
| Monitor (claims + API) | `packages/monitor/` | `packages/monitor/Dockerfile` |
| Channel (broadcast feed) | `packages/channel/` | `packages/channel/Dockerfile` |
| Tracker (group calls) | `packages/tracker/` | `packages/tracker/Dockerfile` |
| Claim (wallet tracker) | `packages/claim/` | `packages/claim/Dockerfile` |

For this tutorial, we'll deploy the **Monitor bot**. The steps are identical for any bot — just change the directory and Dockerfile path.

## Step 4: Set Environment Variables

```bash
# Required for all bots
railway variables set TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
railway variables set SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-key

# Optional: WebSocket for real-time events
railway variables set SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=your-key

# Monitor-specific: enable REST API
railway variables set ENABLE_API=true
railway variables set API_PORT=3000
railway variables set API_KEYS=sk_live_your-secret-key

# Webhook signing secret
railway variables set WEBHOOK_SECRET=whsec_your-secret-here
```

> **Never commit secrets to git.** Always set them via `railway variables set` or the Railway dashboard.

Alternatively, set variables in the Railway dashboard: Project → Service → Variables tab.

## Step 5: Configure the Dockerfile

The `railway.json` in each bot package tells Railway which Dockerfile to use:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "runtime": "V2",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/v1/health",
    "numReplicas": 1
  }
}
```

### What the Dockerfile Does

```dockerfile
# ── Build stage ──────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                              # Install all deps
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build                       # Compile TypeScript

# ── Production stage ─────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S bot && adduser -S bot -G bot  # Non-root user

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force  # Production deps only

COPY --from=build /app/dist dist/
RUN mkdir -p /app/data && chown bot:bot /app/data  # Data directory

EXPOSE 3000
USER bot                                # Run as non-root

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/health || exit 0

CMD ["node", "dist/index.js"]
```

Key security features:
- **Multi-stage build**: Build tools aren't in the production image
- **Non-root user**: The bot runs as `bot`, not `root`
- **Alpine base**: Minimal attack surface (~5MB base image)
- **Health checks**: Railway auto-restarts if the health endpoint fails

## Step 6: Deploy

```bash
cd packages/monitor
railway up
```

Expected output:

```
☁️ Uploading project...
📦 Building Docker image...
  Step 1/14 : FROM node:20-alpine AS build
  ...
  Step 14/14 : CMD ["node", "dist/index.js"]
✅ Build successful
🚀 Deploying to production...
✔ Deployment live at https://pumpkit-bot-production.up.railway.app
```

The deployment URL is your API endpoint (if `ENABLE_API=true`).

## Step 7: Add a Persistent Volume

SQLite databases and watch lists need persistent storage. Without a volume, data is lost on every restart.

### Via Railway Dashboard

1. Go to your project in the Railway dashboard
2. Click your service → Settings → Volumes
3. Click "Add Volume"
4. Mount path: `/app/data`
5. Size: 1 GB (sufficient for most bots)

### Via CLI

```bash
railway volume add --mount /app/data
```

The bot stores its data in `/app/data/`:
- `watches.json` — persisted watch list
- `claims.db` — SQLite database (if using SqliteStore)
- `calls.db` — call tracking database (tracker bot)

## Step 8: Monitor Logs

### Via CLI

```bash
railway logs
```

```
[INFO] Bot started: @YourBotName
[INFO] ClaimMonitor: WebSocket subscription active
[INFO] API server listening on :3000
[INFO] Health: OK (uptime: 00:05:23)
```

### Via Dashboard

Railway dashboard → Service → Logs tab shows real-time streaming logs.

### Health Check

If you enabled the API, check the health endpoint:

```bash
curl https://pumpkit-bot-production.up.railway.app/api/v1/health
```

```json
{
  "status": "ok",
  "uptime": 3600,
  "monitors": {
    "ClaimMonitor": { "running": true, "eventsProcessed": 42 },
    "LaunchMonitor": { "running": true, "eventsProcessed": 15 }
  }
}
```

## Step 9: Set Up Auto-Deploy from GitHub

1. Push your fork to GitHub
2. In Railway dashboard → Service → Settings → Source
3. Connect your GitHub repository
4. Select the branch (e.g., `main`)
5. Set the root directory to the bot package (e.g., `packages/monitor`)

Now every push to `main` triggers a new deployment automatically.

## Deploying Other Bots

The process is identical for each bot. Just change the working directory:

### Channel Bot

```bash
cd packages/channel
railway init    # New project for this bot
railway variables set TELEGRAM_BOT_TOKEN=...
railway variables set CHANNEL_ID=-1001234567890
railway variables set SOLANA_RPC_URL=...
railway variables set FEED_CLAIMS=true
railway variables set FEED_LAUNCHES=true
railway variables set FEED_WHALES=true
railway variables set WHALE_THRESHOLD_SOL=10
railway up
```

### Tracker Bot

```bash
cd packages/tracker
railway init
railway variables set TELEGRAM_BOT_TOKEN=...
railway variables set SOLANA_RPC_URL=...
railway volume add --mount /app/data    # Important: SQLite needs persistence
railway up
```

## Docker Without Railway

If you prefer Docker directly (e.g., VPS, AWS ECS, Fly.io):

```bash
cd packages/monitor

# Build
docker build -t pumpkit-monitor .

# Run
docker run -d \
  --name pumpkit-monitor \
  --restart unless-stopped \
  -p 3000:3000 \
  -v pumpkit-data:/app/data \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e SOLANA_RPC_URL=your-rpc-url \
  -e ENABLE_API=true \
  pumpkit-monitor
```

## Production Checklist

| Item | Status |
|------|--------|
| Environment variables set (no secrets in code) | ☐ |
| Persistent volume mounted at `/app/data` | ☐ |
| Health check endpoint responding | ☐ |
| Auto-restart on failure configured | ☐ |
| Logs accessible (CLI or dashboard) | ☐ |
| Non-root user in Dockerfile | ☐ |
| WebSocket URL set for real-time events | ☐ |
| Rate limits configured (if API enabled) | ☐ |

## Common Issues

| Issue | Fix |
|-------|-----|
| `Build failed: npm ci` | Ensure `package-lock.json` is committed and up to date |
| `ENOENT: data/watches.json` | Mount a persistent volume at `/app/data` |
| Health check failing | Check that `API_PORT` matches the `EXPOSE` in Dockerfile |
| Bot not responding | Check `railway logs` for errors. Verify bot token is correct |
| SQLite database lost on restart | You need a persistent volume. See Step 7 |
| `Permission denied: /app/data` | The volume must be writable by the `bot` user (UID 1000) |

## Next Steps

- [06 — Webhooks & API](06-add-webhooks-api.md): Add REST API, SSE streaming, and webhooks to your deployed bot
- [02 — Channel Broadcast](02-channel-broadcast.md): Deploy a channel feed alongside your monitor
- [03 — Custom Monitors](03-custom-monitors.md): Add custom event detection before deploying
