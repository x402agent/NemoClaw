#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { execSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { ROOT, SCRIPTS, run, runCapture } = require("./lib/runner");
const {
  ensureApiKey,
  ensureGithubToken,
  getCredential,
  isRepoPrivate,
} = require("./lib/credentials");
const registry = require("./lib/registry");
const nim = require("./lib/nim");
const policies = require("./lib/policies");
const solana = require("./lib/solana");

// ── Global commands ──────────────────────────────────────────────

const GLOBAL_COMMANDS = new Set([
  "onboard", "list", "deploy", "setup", "setup-spark",
  "start", "stop", "status", "solana", "wallet",
  "help", "--help", "-h",
]);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function deriveWebsocketUrl(rpcUrl) {
  if (!rpcUrl) return null;
  try {
    const url = new URL(rpcUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  } catch {
    return null;
  }
}

function createSandboxSshConfig(sandboxName) {
  const configBody = runCapture(`openshell sandbox ssh-config "${sandboxName}"`);
  const configPath = path.join(os.tmpdir(), `nemoclaw-ssh-${sandboxName}-${Date.now()}.conf`);
  fs.writeFileSync(configPath, configBody + "\n", { mode: 0o600 });
  return configPath;
}

function runSandboxCommand(sandboxName, envValues, command) {
  const exports = Object.entries(envValues)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ");
  const innerCmd = exports ? `export ${exports} && ${command}` : command;
  const sshConfigPath = createSandboxSshConfig(sandboxName);
  try {
    const remoteCmd = `bash -lc ${shellQuote(innerCmd)}`;
    run(`ssh -F "${sshConfigPath}" "openshell-${sandboxName}" ${shellQuote(remoteCmd)}`);
  } finally {
    fs.unlinkSync(sshConfigPath);
  }
}

function runSandboxScript(sandboxName, envValues, scriptName) {
  runSandboxCommand(sandboxName, envValues, scriptName);
}

function validateSandboxEnv(label, envValues, requiredKeys, optionalHint) {
  const missing = requiredKeys.filter((key) => !envValues[key]);
  if (missing.length === 0) {
    return;
  }
  console.error(`  Missing environment variables for ${label}:`);
  missing.forEach((key) => console.error(`    - ${key}`));
  console.error("");
  console.error("  Export them in your shell or store them in ~/.nemoclaw/credentials.json.");
  if (optionalHint) {
    console.error(`  Optional: ${optionalHint}`);
  }
  process.exit(1);
}

function resolveSandboxName(preferredName) {
  if (preferredName) {
    const sandbox = registry.getSandbox(preferredName);
    if (!sandbox) {
      console.error(`  Unknown sandbox: ${preferredName}`);
      process.exit(1);
    }
    return preferredName;
  }

  const { sandboxes, defaultSandbox } = registry.listSandboxes();
  if (defaultSandbox && registry.getSandbox(defaultSandbox)) {
    return defaultSandbox;
  }
  return sandboxes[0] ? sandboxes[0].name : null;
}

function buildSolanaRuntimeEnv() {
  const solConfig = solana.loadSolanaConfig() || {};
  const wallet = solana.getDefaultWallet();
  const defaultRpc = getCredential("SOLANA_RPC_URL") || solana.getSolanaRpcUrl();
  const defaultWs =
    getCredential("SOLANA_WS_URL") ||
    solana.getSolanaWsUrl() ||
    deriveWebsocketUrl(defaultRpc);

  return {
    SOLANA_RPC_URL: defaultRpc,
    NEXT_PUBLIC_SOLANA_RPC_URL:
      getCredential("NEXT_PUBLIC_SOLANA_RPC_URL") ||
      defaultRpc,
    SOLANA_WS_URL: defaultWs,
    HELIUS_API_KEY: getCredential("HELIUS_API_KEY") || solana.getHeliusApiKey(),
    AGENT_TOKEN_MINT_ADDRESS:
      getCredential("AGENT_TOKEN_MINT_ADDRESS") || solConfig.agentTokenMint,
    DEVELOPER_WALLET:
      getCredential("DEVELOPER_WALLET") || (wallet && wallet.address) || solConfig.developerWallet,
    CURRENCY_MINT: getCredential("CURRENCY_MINT") || solConfig.currencyMint,
    PRICE_AMOUNT: getCredential("PRICE_AMOUNT") || solConfig.priceAmount,
    PRIVY_APP_ID: getCredential("PRIVY_APP_ID"),
    PRIVY_APP_SECRET: getCredential("PRIVY_APP_SECRET"),
    TELEGRAM_BOT_TOKEN: getCredential("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_NOTIFY_CHAT_IDS: getCredential("TELEGRAM_NOTIFY_CHAT_IDS"),
    POLL_INTERVAL_SECONDS: getCredential("POLL_INTERVAL_SECONDS") || process.env.POLL_INTERVAL_SECONDS,
  };
}

// ── Commands ─────────────────────────────────────────────────────

async function onboard() {
  const { onboard: runOnboard } = require("./lib/onboard");
  await runOnboard();
}

async function setup() {
  console.log("");
  console.log("  ⚠  `nemoclaw setup` is deprecated. Use `nemoclaw onboard` instead.");
  console.log("     Running legacy setup.sh for backwards compatibility...");
  console.log("");
  await ensureApiKey();
  run(`bash "${SCRIPTS}/setup.sh"`);
}

async function setupSpark() {
  await ensureApiKey();
  run(`sudo -E NVIDIA_API_KEY="${process.env.NVIDIA_API_KEY}" bash "${SCRIPTS}/setup-spark.sh"`);
}

async function deploy(instanceName) {
  if (!instanceName) {
    console.error("  Usage: nemoclaw deploy <instance-name>");
    console.error("");
    console.error("  Examples:");
    console.error("    nemoclaw deploy my-gpu-box");
    console.error("    nemoclaw deploy nemoclaw-prod");
    console.error("    nemoclaw deploy nemoclaw-test");
    process.exit(1);
  }
  await ensureApiKey();
  if (isRepoPrivate("NVIDIA/OpenShell")) {
    await ensureGithubToken();
  }
  const name = instanceName;
  const gpu = process.env.NEMOCLAW_GPU || "a2-highgpu-1g:nvidia-tesla-a100:1";

  console.log("");
  console.log(`  Deploying NemoClaw to Brev instance: ${name}`);
  console.log("");

  try {
    execSync("which brev", { stdio: "ignore" });
  } catch {
    console.error("brev CLI not found. Install: https://brev.nvidia.com");
    process.exit(1);
  }

  let exists = false;
  try {
    const out = execSync("brev ls 2>&1", { encoding: "utf-8" });
    exists = out.includes(name);
  } catch {}

  if (!exists) {
    console.log(`  Creating Brev instance '${name}' (${gpu})...`);
    run(`brev create ${name} --gpu "${gpu}"`);
  } else {
    console.log(`  Brev instance '${name}' already exists.`);
  }

  run(`brev refresh`, { ignoreError: true });

  console.log("  Waiting for SSH...");
  for (let i = 0; i < 60; i++) {
    try {
      execSync(`ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${name} 'echo ok' 2>/dev/null`, { encoding: "utf-8", stdio: "pipe" });
      break;
    } catch {
      if (i === 59) {
        console.error(`  Timed out waiting for SSH to ${name}`);
        process.exit(1);
      }
      spawnSync("sleep", ["3"]);
    }
  }

  console.log("  Syncing NemoClaw to VM...");
  run(`ssh -o StrictHostKeyChecking=no -o LogLevel=ERROR ${name} 'mkdir -p /home/ubuntu/nemoclaw'`);
  run(`rsync -az --delete --exclude node_modules --exclude .git --exclude src -e "ssh -o StrictHostKeyChecking=no -o LogLevel=ERROR" "${ROOT}/scripts" "${ROOT}/Dockerfile" "${ROOT}/nemoclaw" "${ROOT}/nemoclaw-blueprint" "${ROOT}/bin" "${ROOT}/package.json" ${name}:/home/ubuntu/nemoclaw/`);

  const envLines = [`NVIDIA_API_KEY=${process.env.NVIDIA_API_KEY}`];
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) envLines.push(`GITHUB_TOKEN=${ghToken}`);
  const tgToken = getCredential("TELEGRAM_BOT_TOKEN");
  if (tgToken) envLines.push(`TELEGRAM_BOT_TOKEN=${tgToken}`);
  const envTmp = path.join(os.tmpdir(), `nemoclaw-env-${Date.now()}`);
  fs.writeFileSync(envTmp, envLines.join("\n") + "\n", { mode: 0o600 });
  run(`scp -q -o StrictHostKeyChecking=no -o LogLevel=ERROR "${envTmp}" ${name}:/home/ubuntu/nemoclaw/.env`);
  fs.unlinkSync(envTmp);

  console.log("  Running setup...");
  run(`ssh -t -o StrictHostKeyChecking=no -o LogLevel=ERROR ${name} 'cd /home/ubuntu/nemoclaw && set -a && . .env && set +a && bash scripts/brev-setup.sh'`);

  if (tgToken) {
    console.log("  Starting services...");
    run(`ssh -o StrictHostKeyChecking=no -o LogLevel=ERROR ${name} 'cd /home/ubuntu/nemoclaw && set -a && . .env && set +a && bash scripts/start-services.sh'`);
  }

  console.log("");
  console.log("  Connecting to sandbox...");
  console.log("");
  run(`ssh -t -o StrictHostKeyChecking=no -o LogLevel=ERROR ${name} 'cd /home/ubuntu/nemoclaw && set -a && . .env && set +a && openshell sandbox connect nemoclaw'`);
}

async function start() {
  await ensureApiKey();
  run(`bash "${SCRIPTS}/start-services.sh"`);
}

function stop() {
  run(`bash "${SCRIPTS}/start-services.sh" --stop`);
}

function showStatus() {
  // Show sandbox registry
  const { sandboxes, defaultSandbox } = registry.listSandboxes();
  if (sandboxes.length > 0) {
    console.log("");
    console.log("  Sandboxes:");
    for (const sb of sandboxes) {
      const def = sb.name === defaultSandbox ? " *" : "";
      const model = sb.model ? ` (${sb.model})` : "";
      console.log(`    ${sb.name}${def}${model}`);
    }
    console.log("");
  }

  // Show service status
  run(`bash "${SCRIPTS}/start-services.sh" --status`);
}

function listSandboxes() {
  const { sandboxes, defaultSandbox } = registry.listSandboxes();
  if (sandboxes.length === 0) {
    console.log("");
    console.log("  No sandboxes registered. Run `nemoclaw onboard` to get started.");
    console.log("");
    return;
  }

  console.log("");
  console.log("  Sandboxes:");
  for (const sb of sandboxes) {
    const def = sb.name === defaultSandbox ? " *" : "";
    const model = sb.model || "unknown";
    const provider = sb.provider || "unknown";
    const gpu = sb.gpuEnabled ? "GPU" : "CPU";
    const presets = sb.policies && sb.policies.length > 0 ? sb.policies.join(", ") : "none";
    console.log(`    ${sb.name}${def}`);
    console.log(`      model: ${model}  provider: ${provider}  ${gpu}  policies: ${presets}`);
  }
  console.log("");
  console.log("  * = default sandbox");
  console.log("");
}

// ── Sandbox-scoped actions ───────────────────────────────────────

function sandboxConnect(sandboxName) {
  // Ensure port forward is alive before connecting
  run(`openshell forward start --background 18789 "${sandboxName}" 2>/dev/null || true`, { ignoreError: true });
  run(`openshell sandbox connect "${sandboxName}"`);
}

function sandboxStatus(sandboxName) {
  const sb = registry.getSandbox(sandboxName);
  if (sb) {
    console.log("");
    console.log(`  Sandbox: ${sb.name}`);
    console.log(`    Model:    ${sb.model || "unknown"}`);
    console.log(`    Provider: ${sb.provider || "unknown"}`);
    console.log(`    GPU:      ${sb.gpuEnabled ? "yes" : "no"}`);
    console.log(`    Policies: ${(sb.policies || []).join(", ") || "none"}`);
  }

  // openshell info
  run(`openshell sandbox get "${sandboxName}" 2>/dev/null || true`, { ignoreError: true });

  // NIM health
  const nimStat = nim.nimStatus(sandboxName);
  console.log(`    NIM:      ${nimStat.running ? `running (${nimStat.container})` : "not running"}`);
  if (nimStat.running) {
    console.log(`    Healthy:  ${nimStat.healthy ? "yes" : "no"}`);
  }
  console.log("");
}

function sandboxLogs(sandboxName, follow) {
  const followFlag = follow ? " --follow" : "";
  run(`openshell sandbox logs "${sandboxName}"${followFlag}`);
}

async function sandboxPolicyAdd(sandboxName) {
  const allPresets = policies.listPresets();
  const applied = policies.getAppliedPresets(sandboxName);

  console.log("");
  console.log("  Available presets:");
  allPresets.forEach((p) => {
    const marker = applied.includes(p.name) ? "●" : "○";
    console.log(`    ${marker} ${p.name} — ${p.description}`);
  });
  console.log("");

  const { prompt: askPrompt } = require("./lib/credentials");
  const answer = await askPrompt("  Preset to apply: ");
  if (!answer) return;

  const confirm = await askPrompt(`  Apply '${answer}' to sandbox '${sandboxName}'? [Y/n]: `);
  if (confirm.toLowerCase() === "n") return;

  policies.applyPreset(sandboxName, answer);
}

function sandboxPolicyList(sandboxName) {
  const allPresets = policies.listPresets();
  const applied = policies.getAppliedPresets(sandboxName);

  console.log("");
  console.log(`  Policy presets for sandbox '${sandboxName}':`);
  allPresets.forEach((p) => {
    const marker = applied.includes(p.name) ? "●" : "○";
    console.log(`    ${marker} ${p.name} — ${p.description}`);
  });
  console.log("");
}

function sandboxDestroy(sandboxName) {
  console.log(`  Stopping NIM for '${sandboxName}'...`);
  nim.stopNimContainer(sandboxName);

  console.log(`  Deleting sandbox '${sandboxName}'...`);
  run(`openshell sandbox delete "${sandboxName}" 2>/dev/null || true`, { ignoreError: true });

  registry.removeSandbox(sandboxName);
  console.log(`  ✓ Sandbox '${sandboxName}' destroyed`);
}

function sandboxSolanaAgent(sandboxName) {
  const envValues = buildSolanaRuntimeEnv();

  validateSandboxEnv(
    "the Solana agent",
    envValues,
    ["AGENT_TOKEN_MINT_ADDRESS", "DEVELOPER_WALLET", "TELEGRAM_BOT_TOKEN"],
    "SOLANA_RPC_URL, TELEGRAM_NOTIFY_CHAT_IDS, PRICE_AMOUNT, CURRENCY_MINT."
  );

  runSandboxScript(sandboxName, envValues, "nemoclaw-solana-agent");
}

function sandboxPaymentApp(sandboxName) {
  const envValues = {
    ...buildSolanaRuntimeEnv(),
    DEFI_AGENT_ID: getCredential("DEFI_AGENT_ID") || process.env.DEFI_AGENT_ID,
    PORT: getCredential("PAYMENT_APP_PORT") || process.env.PAYMENT_APP_PORT || process.env.PORT,
  };

  validateSandboxEnv(
    "the payment app",
    envValues,
    ["AGENT_TOKEN_MINT_ADDRESS"],
    "SOLANA_RPC_URL, NEXT_PUBLIC_SOLANA_RPC_URL, CURRENCY_MINT, PRICE_AMOUNT, DEFI_AGENT_ID, PAYMENT_APP_PORT."
  );

  runSandboxScript(sandboxName, envValues, "nemoclaw-payment-app");
}

function sandboxTelegramBot(sandboxName) {
  const envValues = {
    ...buildSolanaRuntimeEnv(),
    ALLOWED_USER_IDS: getCredential("ALLOWED_USER_IDS"),
    ENABLE_API: getCredential("ENABLE_API") || process.env.ENABLE_API,
    ENABLE_LAUNCH_MONITOR: getCredential("ENABLE_LAUNCH_MONITOR") || process.env.ENABLE_LAUNCH_MONITOR,
    ENABLE_GRADUATION_ALERTS:
      getCredential("ENABLE_GRADUATION_ALERTS") || process.env.ENABLE_GRADUATION_ALERTS,
    ENABLE_TRADE_ALERTS: getCredential("ENABLE_TRADE_ALERTS") || process.env.ENABLE_TRADE_ALERTS,
    ENABLE_FEE_DISTRIBUTION_ALERTS:
      getCredential("ENABLE_FEE_DISTRIBUTION_ALERTS") || process.env.ENABLE_FEE_DISTRIBUTION_ALERTS,
    GITHUB_ONLY_FILTER: getCredential("GITHUB_ONLY_FILTER") || process.env.GITHUB_ONLY_FILTER,
    WHALE_THRESHOLD_SOL: getCredential("WHALE_THRESHOLD_SOL") || process.env.WHALE_THRESHOLD_SOL,
    POLL_INTERVAL_SECONDS: getCredential("POLL_INTERVAL_SECONDS") || process.env.POLL_INTERVAL_SECONDS,
    PORT: getCredential("TELEGRAM_API_PORT") || process.env.TELEGRAM_API_PORT || process.env.PORT,
    LOG_LEVEL: getCredential("LOG_LEVEL") || process.env.LOG_LEVEL,
  };

  validateSandboxEnv(
    "the Telegram bot",
    envValues,
    ["TELEGRAM_BOT_TOKEN"],
    "SOLANA_RPC_URL, SOLANA_WS_URL, ALLOWED_USER_IDS, ENABLE_API, ENABLE_LAUNCH_MONITOR, ENABLE_GRADUATION_ALERTS, ENABLE_TRADE_ALERTS, ENABLE_FEE_DISTRIBUTION_ALERTS, WHALE_THRESHOLD_SOL, POLL_INTERVAL_SECONDS, TELEGRAM_API_PORT."
  );

  const stagedApp = "/sandbox/pumpfun-telegram-bot-live";
  const localTelegramBotDir = path.join(ROOT, "Pump-Fun", "telegram-bot");
  run(`openshell sandbox upload "${sandboxName}" "${localTelegramBotDir}" "${stagedApp}"`, {
    ignoreError: false,
  });
  runSandboxCommand(
    sandboxName,
    envValues,
    [
      "unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy grpc_proxy GRPC_PROXY NODE_USE_ENV_PROXY",
      "export RES_OPTIONS='ndots:1 timeout:1 attempts:2'",
      "export NODE_OPTIONS=\"${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first\"",
      "for proc in /proc/[0-9]*; do cmd=$(tr '\\0' ' ' < \"$proc/cmdline\" 2>/dev/null || true); case \"$cmd\" in *'/sandbox/pumpfun-telegram-bot-live/node_modules/.bin/tsx src/index.ts'*|*'npm exec tsx src/index.ts'*) kill \"${proc#/proc/}\" 2>/dev/null || true;; esac; done",
      "sleep 1",
      `ln -sfn /opt/pump-fun/telegram-bot/node_modules "${stagedApp}/node_modules"`,
      `cd "${stagedApp}"`,
      "exec npx tsx src/index.ts",
    ].join(" && ")
  );
}

function sandboxSwarmBot(sandboxName) {
  const envValues = {
    ...buildSolanaRuntimeEnv(),
    PORT: getCredential("SWARM_BOT_PORT") || process.env.SWARM_BOT_PORT || process.env.PORT,
    DB_PATH: getCredential("DB_PATH") || process.env.DB_PATH,
    DEFAULT_SLIPPAGE_BPS: getCredential("DEFAULT_SLIPPAGE_BPS") || process.env.DEFAULT_SLIPPAGE_BPS,
    MAX_POSITION_SOL_PER_BOT:
      getCredential("MAX_POSITION_SOL_PER_BOT") || process.env.MAX_POSITION_SOL_PER_BOT,
    MAX_TOTAL_POSITION_SOL:
      getCredential("MAX_TOTAL_POSITION_SOL") || process.env.MAX_TOTAL_POSITION_SOL,
    POLL_INTERVAL_MS: getCredential("POLL_INTERVAL_MS") || process.env.POLL_INTERVAL_MS,
    LOG_LEVEL: getCredential("LOG_LEVEL") || process.env.LOG_LEVEL,
  };

  runSandboxScript(sandboxName, envValues, "nemoclaw-swarm-bot");
}

function sandboxWebsocketServer(sandboxName) {
  const baseEnv = buildSolanaRuntimeEnv();
  const envValues = {
    ...baseEnv,
    SOLANA_RPC_WS:
      getCredential("SOLANA_RPC_WS") ||
      baseEnv.SOLANA_WS_URL,
    PORT: getCredential("WEBSOCKET_SERVER_PORT") || process.env.WEBSOCKET_SERVER_PORT || process.env.PORT,
    IPFS_GATEWAY: getCredential("IPFS_GATEWAY") || process.env.IPFS_GATEWAY,
  };

  runSandboxScript(sandboxName, envValues, "nemoclaw-websocket-server");
}

function sandboxSolanaStack(sandboxName) {
  const envValues = {
    ...buildSolanaRuntimeEnv(),
    START_TELEGRAM_BOT: process.env.START_TELEGRAM_BOT,
    START_SOLANA_BRIDGE: process.env.START_SOLANA_BRIDGE,
    START_WEBSOCKET_SERVER: process.env.START_WEBSOCKET_SERVER,
    START_PAYMENT_APP: process.env.START_PAYMENT_APP,
    START_SWARM_BOT: process.env.START_SWARM_BOT,
  };

  validateSandboxEnv(
    "the Solana one-shot stack",
    envValues,
    ["TELEGRAM_BOT_TOKEN"],
    "SOLANA_RPC_URL, SOLANA_WS_URL, Helius/Privy config, START_PAYMENT_APP, START_SWARM_BOT."
  );

  runSandboxScript(sandboxName, envValues, "nemoclaw-solana-stack");
}

// ── One-shot Solana quick-start ──────────────────────────────────

async function quickStartSolana(actionArgs = []) {
  const subcommand = actionArgs[0] || "overview";

  if (subcommand === "start" || subcommand === "up") {
    let sandboxName = resolveSandboxName(actionArgs[1]);
    if (!sandboxName) {
      console.log("");
      console.log("  No sandbox found. Running onboard first...");
      console.log("");
      const { onboard: runOnboard } = require("./lib/onboard");
      await runOnboard();
      sandboxName = resolveSandboxName(actionArgs[1]);
      if (!sandboxName) {
        console.error("  Failed to resolve a sandbox after onboarding.");
        process.exit(1);
      }
    }

    console.log("");
    console.log(`  One-shot Solana startup → ${sandboxName}`);
    console.log("");
    sandboxSolanaStack(sandboxName);
    return;
  }

  console.log("");
  console.log("  ⚡ NemoClaw Solana Quick Start");
  console.log("  ═══════════════════════════════");
  console.log("");

  // Check if already onboarded
  const { sandboxes } = registry.listSandboxes();
  if (sandboxes.length === 0) {
    console.log("  No sandbox found. Running full onboard first...");
    console.log("");
    const { onboard: runOnboard } = require("./lib/onboard");
    await runOnboard();
    return;
  }

  // Use default sandbox
  const sb = sandboxes[0];
  console.log(`  Using sandbox: ${sb.name}`);

  // Show Solana status
  const solConfig = solana.loadSolanaConfig();
  const wallet = solana.getDefaultWallet();

  if (solConfig) {
    console.log(`  RPC:    ${solConfig.rpcUrl.substring(0, 50)}...`);
  } else {
    console.log("  RPC:    https://rpc.solanatracker.io/public");
  }

  if (wallet) {
    console.log(`  Wallet: ${wallet.address} (Privy)`);
  } else {
    console.log("  Wallet: not configured (run nemoclaw onboard)");
  }

  console.log("");
  console.log("  Available actions:");
  console.log(`    nemoclaw solana start ${sb.name}   One-shot startup (bridge + bot + relay)`);
  console.log(`    nemoclaw ${sb.name} connect          Open sandbox shell`);
  console.log(`    nemoclaw ${sb.name} solana-stack     One-shot startup inside sandbox`);
  console.log(`    nemoclaw ${sb.name} solana-agent     Start Pump-Fun tracker bot`);
  console.log(`    nemoclaw ${sb.name} telegram-bot     Start Telegram monitor`);
  console.log(`    nemoclaw ${sb.name} solana-bridge    Real-time Telegram wallet narration`);
  console.log(`    nemoclaw ${sb.name} payment-app      Payment-gated agent`);
  console.log(`    nemoclaw ${sb.name} swarm-bot        PumpFun swarm dashboard`);
  console.log(`    nemoclaw ${sb.name} websocket-server PumpFun launch relay`);
  console.log(`    nemoclaw ${sb.name} status           Show full status`);
  console.log("");
  console.log("  Quick connect:");
  console.log(`    nemoclaw ${sb.name} connect`);
  console.log("");
}

// ── Solana-Telegram Bridge ───────────────────────────────────────

function sandboxSolanaBridge(sandboxName) {
  const envValues = {
    ...buildSolanaRuntimeEnv(),
    BRIDGE_MODE: "natural-language",
  };

  validateSandboxEnv(
    "the Solana-Telegram bridge",
    envValues,
    ["TELEGRAM_BOT_TOKEN"],
    "SOLANA_RPC_URL, DEVELOPER_WALLET, AGENT_TOKEN_MINT_ADDRESS, TELEGRAM_NOTIFY_CHAT_IDS."
  );

  runSandboxScript(sandboxName, envValues, "nemoclaw-solana-bridge");
}

// ── Wallet Management ────────────────────────────────────────────

async function walletCommand(actionArgs = []) {
  const { prompt: askPrompt } = require("./lib/credentials");
  const sub = actionArgs[0] || "status";

  switch (sub) {
    case "create": {
      console.log("");
      console.log("  🔐 Create Agentic Wallet (Privy)");
      console.log("  ═════════════════════════════════");

      let privyConfig = solana.loadPrivyConfig();
      if (!privyConfig || !privyConfig.appId) {
        console.log("  Get credentials from: https://dashboard.privy.io");
        const appId = await askPrompt("  Privy App ID: ");
        const appSecret = await askPrompt("  Privy App Secret: ");
        if (!appId || !appSecret) {
          console.error("  Privy credentials required.");
          process.exit(1);
        }
        privyConfig = {
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          configuredAt: new Date().toISOString(),
        };
        solana.savePrivyConfig(privyConfig);
        console.log("  ✓ Privy credentials saved");
      } else {
        console.log(`  Using existing Privy config (app: ${privyConfig.appId.substring(0, 12)}...)`);
      }

      console.log("  Creating Solana wallet via Privy...");
      const wallet = await solana.createPrivyWallet({ chainType: "solana" });
      if (wallet) {
        console.log(`  ✓ Wallet created: ${wallet.address}`);
        console.log("  ⓘ Private keys managed by Privy — never stored locally.");

        const wantPolicy = await askPrompt("  Create spending policy (0.1 SOL/tx limit)? [Y/n]: ");
        if (wantPolicy.toLowerCase() !== "n") {
          const policy = await solana.createPrivyPolicy({
            name: "NemoClaw Default",
            maxLamports: 100_000_000,
          });
          if (policy) {
            console.log(`  ✓ Policy created: ${policy.name || policy.id}`);
          }
        }
      }
      console.log("");
      break;
    }

    case "list": {
      const wallets = solana.listWallets();
      console.log("");
      if (wallets.length === 0) {
        console.log("  No wallets found. Run: nemoclaw wallet create");
      } else {
        console.log("  Agentic Wallets:");
        wallets.forEach((w, i) => {
          const marker = i === 0 ? " (default)" : "";
          console.log(`    ${i + 1}. ${w.address} [${w.chainType}]${marker}`);
          console.log(`       ID: ${w.walletId}  Created: ${w.createdAt}`);
        });
      }
      console.log("");
      break;
    }

    case "status":
    default: {
      const wallet = solana.getDefaultWallet();
      const privyConfig = solana.loadPrivyConfig();
      const solConfig = solana.loadSolanaConfig();
      const allWallets = solana.listWallets();

      console.log("");
      console.log("  🔐 Wallet Status");
      console.log("  ════════════════");
      console.log(`  Privy:    ${privyConfig ? `configured (${privyConfig.appId.substring(0, 12)}...)` : 'not configured'}`);
      console.log(`  Wallets:  ${allWallets.length} created`);
      if (wallet) {
        console.log(`  Default:  ${wallet.address}`);
        console.log(`  Chain:    ${wallet.chainType}`);
      }
      if (solConfig) {
        console.log(`  RPC:      ${solConfig.rpcUrl ? solConfig.rpcUrl.substring(0, 50) + '...' : 'not set'}`);
      }
      console.log("");
      if (!privyConfig) {
        console.log("  Get started: nemoclaw wallet create");
      }
      console.log("");
      break;
    }
  }
}

// ── Help ─────────────────────────────────────────────────────────

function help() {
  console.log(`
  nemoclaw — Autonomous Solana Trading Agent

  ⚡ One command to deploy:
    npm install -g @mawdbotsonsolana/nemoclaw
    nemoclaw onboard

  Getting Started:
    nemoclaw solana                  Solana status + available commands
    nemoclaw solana start            One-shot startup (bridge + bot + relay)
    nemoclaw wallet create           Create an encrypted Privy agentic wallet
    nemoclaw wallet list             List all wallets
    nemoclaw onboard                 Full interactive setup wizard

  Sandbox Management:
    nemoclaw list                    List all sandboxes
    nemoclaw <name> connect          Open sandbox shell
    nemoclaw <name> solana-stack     Start bridge + bot + relay together
    nemoclaw <name> solana-agent     Pump-Fun tracker bot
    nemoclaw <name> solana-bridge    Natural-language Telegram wallet narration
    nemoclaw <name> telegram-bot     Pump-Fun Telegram monitor + API
    nemoclaw <name> payment-app      Payment-gated agent app
    nemoclaw <name> swarm-bot        Pump-Fun swarm dashboard
    nemoclaw <name> websocket-server Pump-Fun WebSocket relay
    nemoclaw <name> status           Sandbox + Solana + wallet status
    nemoclaw <name> logs [--follow]  View sandbox logs
    nemoclaw <name> destroy          Stop NIM + delete sandbox

  Policy Presets:
    nemoclaw <name> policy-add       Add network policy preset
    nemoclaw <name> policy-list      List presets (● = applied)

  Deploy:
    nemoclaw deploy <instance>       Deploy to a Brev GPU VM

  Services:
    nemoclaw start / stop / status   Manage auxiliary services

  Inside the sandbox you get:
    helius-cli, plus Solana CLI tools when the target architecture supports them
    Pump-Fun SDK, 43 DeFi agent personas, Privy wallet skill

  Default model: 8bit/DeepSolana (via Ollama, auto-pulled on onboard)

  Credentials: ~/.nemoclaw/ (mode 600)
  Wallet keys: managed by Privy — never stored locally
`);
}

// ── Dispatch ─────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

(async () => {
  // No command → help
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }

  // Global commands
  if (GLOBAL_COMMANDS.has(cmd)) {
    switch (cmd) {
      case "onboard":     await onboard(); break;
      case "setup":       await setup(); break;
      case "setup-spark": await setupSpark(); break;
      case "deploy":      await deploy(args[0]); break;
      case "start":       await start(); break;
      case "stop":        stop(); break;
      case "status":      showStatus(); break;
      case "list":        listSandboxes(); break;
      case "solana":      await quickStartSolana(args); break;
      case "wallet":      await walletCommand(args); break;
      default:            help(); break;
    }
    return;
  }

  // Sandbox-scoped commands: nemoclaw <name> <action>
  const sandbox = registry.getSandbox(cmd);
  if (sandbox) {
    const action = args[0] || "connect";
    const actionArgs = args.slice(1);

    switch (action) {
      case "connect":     sandboxConnect(cmd); break;
      case "solana-stack": sandboxSolanaStack(cmd); break;
      case "solana-agent": sandboxSolanaAgent(cmd); break;
      case "solana-bridge": sandboxSolanaBridge(cmd); break;
      case "telegram-bot": sandboxTelegramBot(cmd); break;
      case "payment-app": sandboxPaymentApp(cmd); break;
      case "swarm-bot":   sandboxSwarmBot(cmd); break;
      case "websocket-server": sandboxWebsocketServer(cmd); break;
      case "status":      sandboxStatus(cmd); break;
      case "logs":        sandboxLogs(cmd, actionArgs.includes("--follow")); break;
      case "policy-add":  await sandboxPolicyAdd(cmd); break;
      case "policy-list": sandboxPolicyList(cmd); break;
      case "destroy":     sandboxDestroy(cmd); break;
      default:
        console.error(`  Unknown action: ${action}`);
        console.error(`  Valid actions: connect, solana-stack, solana-agent, solana-bridge, telegram-bot, payment-app, swarm-bot, websocket-server, status, logs, policy-add, policy-list, destroy`);
        process.exit(1);
    }
    return;
  }

  // Unknown command — suggest
  console.error(`  Unknown command: ${cmd}`);
  console.error("");

  // Check if it looks like a sandbox name with missing action
  const allNames = registry.listSandboxes().sandboxes.map((s) => s.name);
  if (allNames.length > 0) {
    console.error(`  Registered sandboxes: ${allNames.join(", ")}`);
    console.error(`  Try: nemoclaw <sandbox-name> connect`);
    console.error("");
  }

  console.error(`  Run 'nemoclaw help' for usage.`);
  process.exit(1);
})();
