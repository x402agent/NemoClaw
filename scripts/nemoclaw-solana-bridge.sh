#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Solana-Telegram Bridge: real-time wallet and trade narration.

set -euo pipefail

APP_DIR="/opt/pump-fun/agent-app"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://rpc.solanatracker.io/public}"
SOLANA_WS_URL="${SOLANA_WS_URL:-$SOLANA_RPC_URL}"
BRIDGE_MODE="${BRIDGE_MODE:-natural-language}"
POLL_MS="${POLL_MS:-15000}"
NEMOCLAW_HOME="${HOME:-/sandbox}/.nemoclaw"
NEMOCLAW_VAULT_DIR="${NEMOCLAW_VAULT_DIR:-${NEMOCLAW_HOME}/vault}"
HEARTBEAT_SECONDS="${HEARTBEAT_SECONDS:-60}"
MIN_WALLET_SOL="${MIN_WALLET_SOL:-0.01}"
STOP_BALANCE_SOL="${STOP_BALANCE_SOL:-0.002}"

mkdir -p "${NEMOCLAW_VAULT_DIR}"
export NEMOCLAW_VAULT_DIR HEARTBEAT_SECONDS MIN_WALLET_SOL STOP_BALANCE_SOL

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "[solana-bridge] Missing required env: $key" >&2
    exit 1
  fi
}

require_env TELEGRAM_BOT_TOKEN

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[solana-bridge] NemoClaw Solana ↔ Telegram Bridge"
echo "[solana-bridge] Mode: ${BRIDGE_MODE}"
echo "[solana-bridge] RPC:  ${SOLANA_RPC_URL:0:70}"
echo "[solana-bridge] WS:   ${SOLANA_WS_URL:0:70}"
echo "[solana-bridge] Vault: ${NEMOCLAW_VAULT_DIR}"
echo "[solana-bridge] Heartbeat: every ${HEARTBEAT_SECONDS}s"
if [ -n "${HELIUS_API_KEY:-}" ]; then
  echo "[solana-bridge] Helius: configured"
fi
if [ -n "${DEVELOPER_WALLET:-}" ]; then
  echo "[solana-bridge] Wallet: ${DEVELOPER_WALLET}"
fi
if [ -n "${AGENT_TOKEN_MINT_ADDRESS:-}" ]; then
  echo "[solana-bridge] Mint:   ${AGENT_TOKEN_MINT_ADDRESS}"
fi
if [ -n "${PRIVY_APP_ID:-}" ]; then
  echo "[solana-bridge] Privy:  configured"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "${APP_DIR}"

node <<'NODE'
const fs = require("fs");
const path = require("path");
const { Bot } = require("grammy");
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const RPC = process.env.SOLANA_RPC_URL;
const WALLET = process.env.DEVELOPER_WALLET || "";
const TARGET_MINT = process.env.AGENT_TOKEN_MINT_ADDRESS || "";
const CHAT_IDS = (process.env.TELEGRAM_NOTIFY_CHAT_IDS || "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter(Boolean);
const POLL_MS = Number.parseInt(process.env.POLL_MS || "15000", 10);
const HEARTBEAT_SECONDS = Number.parseInt(process.env.HEARTBEAT_SECONDS || "60", 10);
const MIN_WALLET_SOL = Number.parseFloat(process.env.MIN_WALLET_SOL || "0.01");
const STOP_BALANCE_SOL = Number.parseFloat(process.env.STOP_BALANCE_SOL || "0.002");
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const VAULT_DIR = process.env.NEMOCLAW_VAULT_DIR || path.join(process.env.HOME || "/sandbox", ".nemoclaw", "vault");
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const conn = new Connection(RPC, "confirmed");
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
const DAY = new Date().toISOString().slice(0, 10);
const EVENTS_FILE = path.join(VAULT_DIR, `events-${DAY}.jsonl`);
const HEARTBEAT_FILE = path.join(VAULT_DIR, `heartbeats-${DAY}.jsonl`);
const SESSION_FILE = path.join(VAULT_DIR, `sessions-${DAY}.jsonl`);

let lastSeen = new Set();
let started = Date.now();
let txCount = 0;
let lastProtectionState = null;
let lastFundingState = null;

fs.mkdirSync(VAULT_DIR, { recursive: true });

function appendJsonl(file, payload) {
  fs.appendFileSync(
    file,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      runId: RUN_ID,
      ...payload,
    })}\n`,
    "utf8",
  );
}

function logSession(kind, extra = {}) {
  appendJsonl(SESSION_FILE, {
    kind,
    wallet: WALLET || null,
    rpc: RPC,
    provider: HELIUS_API_KEY ? "helius" : "configured-rpc",
    ...extra,
  });
}

function logEvent(kind, extra = {}) {
  appendJsonl(EVENTS_FILE, {
    kind,
    wallet: WALLET || null,
    targetMint: TARGET_MINT || null,
    ...extra,
  });
}

function logHeartbeat(extra = {}) {
  appendJsonl(HEARTBEAT_FILE, {
    kind: "heartbeat",
    wallet: WALLET || null,
    targetMint: TARGET_MINT || null,
    ...extra,
  });
}

function shortAddr(value) {
  return value ? `${value.slice(0, 4)}...${value.slice(-4)}` : "unknown";
}

function formatTokenAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  if (Math.abs(num) >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function solscanLink(signature) {
  return `https://solscan.io/tx/${signature}`;
}

function extractTokenChanges(meta, owner) {
  const pre = new Map();
  const post = new Map();

  for (const entry of meta.preTokenBalances || []) {
    if (entry.owner !== owner) continue;
    pre.set(entry.mint, Number(entry.uiTokenAmount?.uiAmountString || entry.uiTokenAmount?.uiAmount || 0));
  }
  for (const entry of meta.postTokenBalances || []) {
    if (entry.owner !== owner) continue;
    post.set(entry.mint, Number(entry.uiTokenAmount?.uiAmountString || entry.uiTokenAmount?.uiAmount || 0));
  }

  const mints = new Set([...pre.keys(), ...post.keys()]);
  return [...mints]
    .map((mint) => ({
      mint,
      delta: (post.get(mint) || 0) - (pre.get(mint) || 0),
    }))
    .filter((item) => item.delta !== 0);
}

function classifyEvent(signature, tx) {
  const keys = tx.transaction.message.accountKeys || [];
  const walletIdx = keys.findIndex((entry) => entry.pubkey.toBase58() === WALLET);
  if (walletIdx < 0) return null;

  const pre = tx.meta.preBalances[walletIdx] || 0;
  const post = tx.meta.postBalances[walletIdx] || 0;
  const lamports = post - pre;
  const signer = keys[0] ? keys[0].pubkey.toBase58() : "";
  const tokenChanges = extractTokenChanges(tx.meta, WALLET);
  const focusToken = tokenChanges.find((entry) => entry.mint === TARGET_MINT) || tokenChanges[0] || null;
  const logs = tx.meta.logMessages || [];

  let type = "activity";
  let counterpart = null;

  if (focusToken) {
    if (focusToken.delta > 0 && lamports < 0) type = "buy";
    else if (focusToken.delta < 0 && lamports > 0) type = "sell";
    else type = "token";
  } else if (lamports > 0 && signer !== WALLET) {
    type = "received";
    counterpart = signer;
  } else if (lamports < 0 && signer === WALLET) {
    type = "sent";
    counterpart = keys[1] ? keys[1].pubkey.toBase58() : null;
  } else if (logs.some((line) => line.includes("Program") && line.includes("invoke"))) {
    type = "program";
  }

  return {
    type,
    signature,
    lamports,
    counterpart,
    token: focusToken,
    tokenChanges,
    isTrade: type === "buy" || type === "sell",
  };
}

function narrate(event) {
  const solDelta = Math.abs(event.lamports / LAMPORTS_PER_SOL).toFixed(4);
  const tokenLine = event.token
    ? `\nToken: <code>${shortAddr(event.token.mint)}</code>\nAmount: <b>${formatTokenAmount(Math.abs(event.token.delta))}</b>`
    : "";

  switch (event.type) {
    case "buy":
      return `🟢 <b>Wallet Buy Detected</b>\n\n` +
        `Our agent wallet just spent <b>${solDelta} SOL</b> to buy a token.${tokenLine}\n` +
        `Wallet: <code>${shortAddr(WALLET)}</code>\n` +
        `Provider: ${HELIUS_API_KEY ? "<b>Helius RPC</b>" : "<b>Standard RPC</b>"}\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    case "sell":
      return `🔴 <b>Wallet Sell Detected</b>\n\n` +
        `Our agent wallet just sold tokens and realized <b>${solDelta} SOL</b>.${tokenLine}\n` +
        `Wallet: <code>${shortAddr(WALLET)}</code>\n` +
        `Provider: ${HELIUS_API_KEY ? "<b>Helius RPC</b>" : "<b>Standard RPC</b>"}\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    case "received":
      return `💰 <b>Incoming Transfer</b>\n\n` +
        `The wallet received <b>${solDelta} SOL</b>.\n` +
        `From: <code>${shortAddr(event.counterpart)}</code>\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    case "sent":
      return `📤 <b>Outgoing Transfer</b>\n\n` +
        `The wallet sent <b>${solDelta} SOL</b>.\n` +
        `To: <code>${shortAddr(event.counterpart)}</code>\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    case "token":
      return `🪙 <b>Token Position Update</b>\n\n` +
        `The wallet changed a token balance.${tokenLine}\n` +
        `SOL delta: <b>${solDelta}</b>\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    case "program":
      return `⚡ <b>Program Interaction</b>\n\n` +
        `The wallet executed an on-chain program interaction.\n` +
        `SOL delta: <b>${solDelta}</b>\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
    default:
      return `📋 <b>Wallet Activity</b>\n\n` +
        `A new Solana transaction touched the wallet.\n` +
        `SOL delta: <b>${solDelta}</b>${tokenLine}\n` +
        `<a href="${solscanLink(event.signature)}">View on Solscan</a>`;
  }
}

async function broadcast(message) {
  const targets = CHAT_IDS.length > 0 ? CHAT_IDS : [];
  for (const chatId of targets) {
    try {
      await bot.api.sendMessage(chatId, message, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error("[bridge] failed to send", chatId, error.message || error);
    }
  }
}

async function getWalletSnapshot() {
  if (!WALLET) {
    return {
      funded: false,
      protectMode: true,
      solBalance: 0,
      txCount,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
    };
  }

  const pubkey = new PublicKey(WALLET);
  const lamports = await conn.getBalance(pubkey, "confirmed");
  const solBalance = lamports / LAMPORTS_PER_SOL;
  return {
    funded: solBalance >= MIN_WALLET_SOL,
    protectMode: solBalance <= STOP_BALANCE_SOL,
    solBalance: Number(solBalance.toFixed(6)),
    txCount,
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
  };
}

async function heartbeat() {
  try {
    const snapshot = await getWalletSnapshot();
    logHeartbeat({
      funded: snapshot.funded,
      protectMode: snapshot.protectMode,
      solBalance: snapshot.solBalance,
      txCount: snapshot.txCount,
      uptimeSeconds: snapshot.uptimeSeconds,
      mode: process.env.BRIDGE_MODE || "natural-language",
    });

    console.log(
      `[bridge] heartbeat: balance=${snapshot.solBalance} funded=${snapshot.funded} protect=${snapshot.protectMode} tx=${snapshot.txCount}`,
    );

    if (snapshot.protectMode !== lastProtectionState || snapshot.funded !== lastFundingState) {
      logEvent("wallet_state_changed", snapshot);
      if (CHAT_IDS.length > 0) {
        const modeLine = snapshot.protectMode
          ? "🛑 <b>Protect Mode</b> — wallet balance is below the configured floor."
          : snapshot.funded
            ? "🟢 <b>Funded</b> — wallet has enough balance for active operation."
            : "🟡 <b>Standby</b> — wallet is online but not yet funded above the active threshold.";
        await broadcast(
          `💓 <b>NemoClaw Wallet Heartbeat</b>\n\n` +
          `${modeLine}\n` +
          `Balance: <b>${snapshot.solBalance} SOL</b>\n` +
          `Heartbeat: every <b>${HEARTBEAT_SECONDS}s</b>\n` +
          `Vault: <code>${VAULT_DIR}</code>`,
        );
      }
      lastProtectionState = snapshot.protectMode;
      lastFundingState = snapshot.funded;
    }
  } catch (error) {
    logEvent("heartbeat_error", { error: error.message || String(error) });
    console.error("[bridge] heartbeat error:", error.message || error);
  }
}

async function pollWallet() {
  if (!WALLET) return;

  try {
    const pubkey = new PublicKey(WALLET);
    const signatures = await conn.getSignaturesForAddress(pubkey, { limit: 5 }, "confirmed");

    for (const sigInfo of signatures.reverse()) {
      if (sigInfo.err || lastSeen.has(sigInfo.signature)) continue;

      const tx = await conn.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || !tx.meta) continue;

      const event = classifyEvent(sigInfo.signature, tx);
      if (!event) continue;

      lastSeen.add(sigInfo.signature);
      if (lastSeen.size > 50) {
        const [first] = lastSeen;
        lastSeen.delete(first);
      }

      txCount += 1;
      logEvent(event.isTrade ? "trade_activity" : "wallet_activity", {
        eventType: event.type,
        signature: sigInfo.signature,
        solDelta: Number((event.lamports / LAMPORTS_PER_SOL).toFixed(9)),
        counterpart: event.counterpart,
        tokenMint: event.token ? event.token.mint : null,
        tokenDelta: event.token ? event.token.delta : null,
        tokenChanges: event.tokenChanges,
      });
      await broadcast(narrate(event));
      console.log(`[bridge] ${event.type}: ${sigInfo.signature.slice(0, 12)}...`);
    }
  } catch (error) {
    logEvent("poll_error", { error: error.message || String(error) });
    console.error("[bridge] poll error:", error.message || error);
  }
}

async function main() {
  console.log("[bridge] starting...");
  console.log("[bridge] notify chats:", CHAT_IDS.join(", ") || "none");
  console.log("[bridge] vault:", VAULT_DIR);
  logSession("bridge_started", {
    notifyChats: CHAT_IDS,
    pollMs: POLL_MS,
    heartbeatSeconds: HEARTBEAT_SECONDS,
    minWalletSol: MIN_WALLET_SOL,
    stopBalanceSol: STOP_BALANCE_SOL,
  });

  if (CHAT_IDS.length > 0) {
    await broadcast(
      `🌊 <b>NemoClaw Solana Bridge Online</b>\n\n` +
      `Wallet: <code>${WALLET || "not configured"}</code>\n` +
      `RPC Provider: ${HELIUS_API_KEY ? "<b>Helius</b>" : "<b>Configured RPC</b>"}\n` +
      `Mode: <b>${process.env.BRIDGE_MODE || "natural-language"}</b>\n` +
      `Vault: <code>${VAULT_DIR}</code>`,
    );
  }

  if (WALLET) {
    setInterval(pollWallet, POLL_MS);
    setInterval(() => {
      heartbeat().catch((error) => {
        logEvent("heartbeat_error", { error: error.message || String(error) });
      });
    }, HEARTBEAT_SECONDS * 1000);
    await pollWallet();
    await heartbeat();
  } else {
    logSession("bridge_started_without_wallet");
    console.log("[bridge] no wallet configured; narration disabled");
  }

  console.log(`[bridge] online, polling every ${POLL_MS}ms`);
}

main().catch((error) => {
  logSession("bridge_fatal", { error: error.message || String(error) });
  console.error("[bridge] fatal:", error);
  process.exit(1);
});
NODE
