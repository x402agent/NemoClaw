# Deploy NemoClaw on Fly.io

To deploy NemoClaw to Fly.io, run the deploy script from the repo root. It handles everything — app creation, volumes, secrets, and deployment.

```bash
cd /path/to/nemoclaw
bash deploy/fly/deploy.sh
```

You'll need `flyctl` installed, a Fly.io account (free trial works), and an LLM API key (Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax).

## What is NemoClaw?

NemoClaw is a one-shot Solana developer agent with Pump-Fun tooling, Privy agentic wallets, and a Telegram-native operator stack. It runs on top of OpenClaw as a persistent AI gateway reachable from Discord, Telegram, Slack, or your local CLI.

## How it works

The deploy script sets up a wrapper server that manages the NemoClaw gateway and provides a browser-based setup wizard:

```
Internet → Fly.io proxy → Wrapper server (:3000) → NemoClaw gateway (:18789)
                              ├── /setup      → Setup wizard (password-protected)
                              ├── /healthz    → Health check (no auth)
                              └── /*          → Proxied to gateway
```

All state lives on a persistent volume mounted at `/data`, so your configuration, conversation history, wallets, and installed tools survive restarts and redeployments.

## What the script prompts for

| Prompt | Description |
|--------|-------------|
| **App name** | Defaults to `nemoclaw-XXXX` (random suffix). Becomes your URL: `https://your-app.fly.dev` |
| **Region** | Where to run your Machine (defaults to `iad` / Virginia). [See regions](https://fly.io/docs/reference/regions/) |
| **Setup password** | Protects the `/setup` wizard. Pick something strong. |
| **LLM provider** | Anthropic, OpenAI, NVIDIA, Google Gemini, OpenRouter, Moonshot AI, or MiniMax |
| **API key** | The key for your chosen provider |
| **Channel tokens** | (Optional) Discord, Telegram, or Slack tokens |
| **Solana config** | (Optional) RPC URL, Helius API key, Privy App ID/Secret |

Your credentials never leave your machine — they go directly to Fly.io as encrypted secrets via `flyctl`.

## Post-deploy setup

Once deployment completes, the script prints your app details:

```
=== Deployment Complete ===

  App URL:       https://your-app.fly.dev
  Setup wizard:  https://your-app.fly.dev/setup
  Gateway URL:   wss://your-app.fly.dev
  Gateway token: <your-generated-token>
```

### Setup wizard

Visit `https://your-app.fly.dev/setup` in your browser. Log in with any username and the setup password you chose. From the wizard you can:

- Change your LLM provider and API key
- Configure Solana RPC, Helius, and Privy wallet credentials
- Add or update Discord, Telegram, and Slack channel connections
- Edit the raw NemoClaw config
- View gateway logs
- Export and import configuration backups

### Connect your local CLI

```bash
openclaw config set gateway.mode remote
openclaw config set gateway.remote.url wss://your-app.fly.dev
openclaw config set gateway.remote.token <your-gateway-token>
openclaw health  # verify the connection
```

## Configuration

### Secrets

All sensitive values are stored as Fly secrets, encrypted at rest and injected as environment variables at boot.

| Secret | Required | Description |
|--------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Protects the `/setup` wizard |
| `NEMOCLAW_GATEWAY_TOKEN` | Yes | Auth token for gateway connections (auto-generated) |
| `NEMOCLAW_API_KEY` | Yes | Your LLM provider API key |
| `NEMOCLAW_AUTH_CHOICE` | Yes | Provider identifier (set by deploy script) |
| `NEMOCLAW_DISCORD_TOKEN` | No | Discord bot token |
| `NEMOCLAW_TELEGRAM_TOKEN` | No | Telegram bot token |
| `NEMOCLAW_SLACK_BOT_TOKEN` | No | Slack bot token (`xoxb-...`) |
| `NEMOCLAW_SLACK_APP_TOKEN` | No | Slack app token (`xapp-...`) |
| `SOLANA_RPC_URL` | No | Custom Solana RPC endpoint |
| `HELIUS_API_KEY` | No | Helius RPC API key |
| `PRIVY_APP_ID` | No | Privy agentic wallet app ID |
| `PRIVY_APP_SECRET` | No | Privy agentic wallet app secret |

To update a secret after deployment:

```bash
fly secrets set NEMOCLAW_API_KEY=sk-new-key-here -a your-app-name
```

The Machine restarts automatically when secrets change.

### VM sizing

Default: `shared-cpu-2x` with 4 GB RAM (~$20-25/month when running continuously). With auto-stop enabled (the default), you only pay for time the Machine is running.

```bash
fly scale memory 4096 -a your-app-name
fly scale vm shared-cpu-4x -a your-app-name
```

### Persistent storage

NemoClaw stores all state on a Fly Volume mounted at `/data`:

- `nemoclaw.json` — wrapper configuration
- `.openclaw/` — OpenClaw gateway config, conversation history, context
- `.nemoclaw/wallets/` — wallet data (encrypted)
- `.nemoclaw/vault/` — append-only JSONL trade and heartbeat logs

Default volume size is 1 GB. To extend:

```bash
fly volumes extend <volume-id> -s 3 -a your-app-name
```

## Useful commands

| Command | Description |
|---------|-------------|
| `fly logs -a your-app` | Stream live logs |
| `fly ssh console -a your-app` | SSH into the Machine |
| `fly apps restart your-app` | Restart after config changes |
| `fly scale memory 4096 -a your-app` | Increase memory |
| `fly status -a your-app` | Check Machine status |
| `fly volumes list -a your-app` | List attached volumes |

## Troubleshooting

**"SETUP_PASSWORD is not set"**
```bash
fly secrets set SETUP_PASSWORD=your-password -a your-app-name
```

**Out of memory / crashes**
```bash
fly scale memory 4096 -a your-app-name
```

**Gateway won't start** — visit `/setup` and check the logs section. Common causes: invalid API key, missing config, or corrupted state.

**Lock file errors**
```bash
fly ssh console -a your-app-name
rm -f /data/gateway.*.lock
exit
fly apps restart your-app-name
```

**Need to start fresh** — use the "Reset" button in the setup wizard, or:
```bash
fly ssh console -a your-app-name
rm /data/nemoclaw.json
exit
fly apps restart your-app-name
```

## Supported LLM providers

| Provider | What you need |
|----------|---------------|
| Anthropic | API key from [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | API key from [platform.openai.com](https://platform.openai.com) |
| NVIDIA | API key from [build.nvidia.com](https://build.nvidia.com) |
| Google Gemini | API key from [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | API key from [openrouter.ai](https://openrouter.ai) |
| Moonshot AI | API key from Moonshot's developer portal |
| MiniMax | API key from MiniMax's developer portal |

You can switch providers at any time through the setup wizard — no redeployment needed.
