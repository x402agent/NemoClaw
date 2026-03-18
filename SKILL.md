# NemoClaw Mac Launch Skill

Use this skill when the user wants to run NemoClaw locally on macOS, launch the Solana stack in one flow, and keep secrets out of git.

## Goal

Install NemoClaw, onboard OpenShell, configure runtime credentials safely, and launch the Solana operator stack with the fewest possible steps.

## Non-Negotiables

- Never ask the user to paste raw private keys into git-tracked files.
- Never print or log wallet secret keys, Privy app secrets, Telegram bot tokens, or Helius API keys.
- Never commit `.env`, `~/.nemoclaw/`, `credentials.json`, `*.keypair.json`, or other secret-bearing files.
- Prefer Privy-managed wallets and environment variables over local secret-key files.

## One-Shot macOS Flow

1. Ensure Docker Desktop is open and healthy.
2. Ensure the shell can see local CLI tools:

```bash
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

3. Install and onboard:

```bash
npm install -g @mawdbotsonsolana/nemoclaw
nemoclaw onboard
```

4. Set runtime env only through shell exports or `~/.nemoclaw/credentials.json`:

```bash
export SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
export TELEGRAM_BOT_TOKEN="YOUR_BOTFATHER_TOKEN"
export TELEGRAM_NOTIFY_CHAT_IDS="123456789"
```

5. Launch the full stack:

```bash
nemoclaw solana start
```

## Standard Operator Commands

```bash
nemoclaw solana
nemoclaw wallet status
nemoclaw list
nemoclaw nemo status
nemoclaw nemo connect
nemoclaw nemo logs --follow
```

## Recovery Rules

- If the OpenShell gateway is down but the saved cluster exists, start it with:

```bash
docker start openshell-cluster-nemoclaw
```

- If `nemoclaw ... status` reports a port `8080` conflict, stop the conflicting process or move it off `8080` before retrying.
- If Docker is up but `openshell` is missing from the shell, restore PATH first:

```bash
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
```

## Public-Release Safety Check

Before publishing or pushing public changes, run:

```bash
npm run public:audit
```

This must pass before any public release.

