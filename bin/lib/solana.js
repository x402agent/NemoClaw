// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Solana integration — RPC config, test-validator, Privy agentic wallets.

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const NEMOCLAW_DIR = path.join(os.homedir(), ".nemoclaw");
const SOLANA_CONFIG_PATH = path.join(NEMOCLAW_DIR, "solana.json");
const WALLET_DIR = path.join(NEMOCLAW_DIR, "wallets");
const PRIVY_CONFIG_PATH = path.join(NEMOCLAW_DIR, "privy.json");

// ── RPC Configuration ────────────────────────────────────────────

const DEFAULT_RPC_OPTIONS = [
  { key: "tracker", label: "Solana Tracker (free)", url: "https://rpc.solanatracker.io/public" },
  { key: "ankr", label: "Ankr (free)", url: "https://rpc.ankr.com/solana" },
  { key: "helius", label: "Helius (requires key)", url: "https://mainnet.helius-rpc.com/?api-key=" },
  { key: "local", label: "Local test-validator", url: "http://localhost:8899" },
  { key: "custom", label: "Custom RPC URL", url: "" },
];

function deriveSolanaWsUrl(rpcUrl) {
  if (!rpcUrl) return null;
  try {
    const url = new URL(rpcUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  } catch {
    return null;
  }
}

function extractHeliusApiKey(rpcUrl) {
  try {
    const url = new URL(rpcUrl || "");
    return url.searchParams.get("api-key") || url.searchParams.get("apiKey");
  } catch {
    return null;
  }
}

function loadSolanaConfig() {
  try {
    if (fs.existsSync(SOLANA_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SOLANA_CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return null;
}

function saveSolanaConfig(config) {
  fs.mkdirSync(NEMOCLAW_DIR, { recursive: true });
  fs.writeFileSync(SOLANA_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getSolanaRpcUrl() {
  const config = loadSolanaConfig();
  return (
    process.env.SOLANA_RPC_URL ||
    (config && config.rpcUrl) ||
    "https://rpc.solanatracker.io/public"
  );
}

function getSolanaWsUrl() {
  const config = loadSolanaConfig();
  return (
    process.env.SOLANA_WS_URL ||
    (config && config.wsUrl) ||
    deriveSolanaWsUrl(getSolanaRpcUrl())
  );
}

function getHeliusApiKey() {
  const config = loadSolanaConfig();
  return (
    process.env.HELIUS_API_KEY ||
    (config && config.heliusApiKey) ||
    extractHeliusApiKey(getSolanaRpcUrl())
  );
}

function testRpcConnection(rpcUrl) {
  try {
    const result = execSync(
      `curl -sf -X POST "${rpcUrl}" -H "Content-Type: application/json" ` +
      `-d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    );
    const json = JSON.parse(result);
    return json.result === "ok" || json.result !== undefined;
  } catch {
    return false;
  }
}

function getSolanaClusterVersion(rpcUrl) {
  try {
    const result = execSync(
      `curl -sf -X POST "${rpcUrl}" -H "Content-Type: application/json" ` +
      `-d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    );
    const json = JSON.parse(result);
    return json.result ? json.result["solana-core"] : null;
  } catch {
    return null;
  }
}

// ── Test Validator ───────────────────────────────────────────────

function isSolanaCliInstalled() {
  try {
    execSync("command -v solana-test-validator", { encoding: "utf-8", stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isTestValidatorRunning() {
  return testRpcConnection("http://localhost:8899");
}

function startTestValidator(opts = {}) {
  const logPath = path.join(NEMOCLAW_DIR, "test-validator.log");
  const ledgerDir = opts.ledgerDir || path.join(NEMOCLAW_DIR, "test-ledger");

  const args = [
    "--ledger", ledgerDir,
    "--rpc-port", "8899",
    "--quiet",
  ];

  // Pre-fund a wallet if specified
  if (opts.fundWallet) {
    args.push("--mint", opts.fundWallet);
  }

  // Clone programs from mainnet if requested
  if (opts.clonePrograms && opts.clonePrograms.length > 0) {
    for (const program of opts.clonePrograms) {
      args.push("--clone", program);
    }
    args.push("--url", "https://api.mainnet-beta.solana.com");
  }

  console.log(`  Starting solana-test-validator (ledger: ${ledgerDir})...`);
  const proc = spawn("solana-test-validator", args, {
    detached: true,
    stdio: ["ignore", fs.openSync(logPath, "a"), fs.openSync(logPath, "a")],
  });
  proc.unref();

  // Wait for it to become healthy
  for (let i = 0; i < 30; i++) {
    require("child_process").spawnSync("sleep", ["1"]);
    if (isTestValidatorRunning()) {
      return { pid: proc.pid, rpcUrl: "http://localhost:8899" };
    }
  }
  return null;
}

function stopTestValidator() {
  try {
    execSync("pkill -f solana-test-validator 2>/dev/null || true", {
      encoding: "utf-8",
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

// ── Privy Agentic Wallet ─────────────────────────────────────────

function loadPrivyConfig() {
  try {
    if (fs.existsSync(PRIVY_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PRIVY_CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return null;
}

function savePrivyConfig(config) {
  fs.mkdirSync(NEMOCLAW_DIR, { recursive: true });
  fs.writeFileSync(PRIVY_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Create an agentic wallet via Privy server wallets API.
 * Returns { walletId, address, chainType } or null on failure.
 */
async function createPrivyWallet(opts = {}) {
  const config = loadPrivyConfig();
  if (!config || !config.appId || !config.appSecret) {
    console.error("  Privy credentials not configured. Run `nemoclaw onboard` first.");
    return null;
  }

  const chainType = opts.chainType || "solana";
  const authHeader = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");

  try {
    const body = JSON.stringify({ chain_type: chainType });
    const result = execSync(
      `curl -sf -X POST "https://auth.privy.io/api/v1/wallets" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Basic ${authHeader}" ` +
      `-H "privy-app-id: ${config.appId}" ` +
      `-d '${body}'`,
      { encoding: "utf-8", timeout: 15000 }
    );
    const wallet = JSON.parse(result);

    // Save wallet info locally (encrypted reference only, no private keys)
    const walletRecord = {
      walletId: wallet.id,
      address: wallet.address,
      chainType: wallet.chain_type || chainType,
      createdAt: new Date().toISOString(),
    };

    const walletsFile = path.join(WALLET_DIR, "wallets.json");
    fs.mkdirSync(WALLET_DIR, { recursive: true });
    let wallets = [];
    try {
      wallets = JSON.parse(fs.readFileSync(walletsFile, "utf-8"));
    } catch {}
    wallets.push(walletRecord);
    fs.writeFileSync(walletsFile, JSON.stringify(wallets, null, 2), { mode: 0o600 });

    return walletRecord;
  } catch (err) {
    console.error(`  Failed to create Privy wallet: ${err.message || err}`);
    return null;
  }
}

/**
 * Create a Privy policy for the wallet (spending limits, chain restriction).
 */
async function createPrivyPolicy(opts = {}) {
  const config = loadPrivyConfig();
  if (!config || !config.appId || !config.appSecret) {
    return null;
  }

  const authHeader = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");

  const policy = {
    version: "1.0",
    name: opts.name || "NemoClaw Agent Policy",
    chain_type: opts.chainType || "solana",
    rules: [
      {
        name: opts.ruleName || "Restrict SOL transfer size",
        method: opts.method || "signAndSendTransaction",
        conditions: opts.conditions || [
          {
            field_source: "solana_system_program_instruction",
            field: "Transfer.lamports",
            operator: "lte",
            value: String(opts.maxLamports || 100_000_000), // 0.1 SOL default
          },
        ],
        action: "ALLOW",
      },
    ],
  };
  if (opts.ownerPublicKey) {
    policy.owner = { public_key: opts.ownerPublicKey };
  }

  try {
    const result = execSync(
      `curl -sf -X POST "https://api.privy.io/v1/policies" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Basic ${authHeader}" ` +
      `-H "privy-app-id: ${config.appId}" ` +
      `-d '${JSON.stringify(policy)}'`,
      { encoding: "utf-8", timeout: 15000 }
    );
    return JSON.parse(result);
  } catch (err) {
    console.error(`  Failed to create Privy policy: ${err.message || err}`);
    return null;
  }
}

/**
 * List all wallets created by this agent.
 */
function listWallets() {
  const walletsFile = path.join(WALLET_DIR, "wallets.json");
  try {
    return JSON.parse(fs.readFileSync(walletsFile, "utf-8"));
  } catch {
    return [];
  }
}

/**
 * Get the default (first) wallet address.
 */
function getDefaultWallet() {
  const wallets = listWallets();
  return wallets.length > 0 ? wallets[0] : null;
}

// ── Pump-Fun Integration ─────────────────────────────────────────

const PUMP_PROGRAMS = {
  pump: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  pumpAmm: "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  pumpFees: "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
  agentPayments: "AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7",
};

function getPumpPrograms() {
  return PUMP_PROGRAMS;
}

/**
 * Get the full Solana environment config for injection into sandbox.
 */
function getSolanaEnvVars() {
  const solConfig = loadSolanaConfig() || {};
  const privyConfig = loadPrivyConfig() || {};
  const wallet = getDefaultWallet();

  const env = {
    SOLANA_RPC_URL: getSolanaRpcUrl(),
    NEXT_PUBLIC_SOLANA_RPC_URL: getSolanaRpcUrl(),
    SOLANA_WS_URL: getSolanaWsUrl(),
  };

  const heliusApiKey = getHeliusApiKey();
  if (heliusApiKey) env.HELIUS_API_KEY = heliusApiKey;

  // Pump-Fun agent env
  if (solConfig.agentTokenMint) env.AGENT_TOKEN_MINT_ADDRESS = solConfig.agentTokenMint;
  if (solConfig.currencyMint) env.CURRENCY_MINT = solConfig.currencyMint;
  if (solConfig.priceAmount) env.PRICE_AMOUNT = solConfig.priceAmount;
  if (wallet) env.DEVELOPER_WALLET = wallet.address;

  // Privy env
  if (privyConfig.appId) env.PRIVY_APP_ID = privyConfig.appId;
  if (privyConfig.appSecret) env.PRIVY_APP_SECRET = privyConfig.appSecret;

  return env;
}

module.exports = {
  DEFAULT_RPC_OPTIONS,
  loadSolanaConfig,
  saveSolanaConfig,
  getSolanaRpcUrl,
  getSolanaWsUrl,
  getHeliusApiKey,
  deriveSolanaWsUrl,
  extractHeliusApiKey,
  testRpcConnection,
  getSolanaClusterVersion,
  isSolanaCliInstalled,
  isTestValidatorRunning,
  startTestValidator,
  stopTestValidator,
  loadPrivyConfig,
  savePrivyConfig,
  createPrivyWallet,
  createPrivyPolicy,
  listWallets,
  getDefaultWallet,
  getPumpPrograms,
  getSolanaEnvVars,
};
