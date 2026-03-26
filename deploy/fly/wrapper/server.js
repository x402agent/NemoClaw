#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// NemoClaw Fly.io wrapper — setup wizard + reverse proxy to OpenClaw gateway.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");
const crypto = require("crypto");

// ── Config ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3000", 10);
const GATEWAY_PORT = 18789;
const DATA_DIR = process.env.DATA_DIR || "/data";
const CONFIG_PATH = path.join(DATA_DIR, "nemoclaw.json");
const SETUP_PASSWORD = process.env.SETUP_PASSWORD || "";
const GATEWAY_TOKEN =
  process.env.NEMOCLAW_GATEWAY_TOKEN ||
  crypto.randomBytes(24).toString("hex");

let gatewayProc = null;

// ── Helpers ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function checkBasicAuth(req) {
  if (!SETUP_PASSWORD) return true;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const [, pass] = decoded.split(":");
  return pass === SETUP_PASSWORD;
}

function unauthorized(res) {
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="NemoClaw Setup"',
    "Content-Type": "text/plain",
  });
  res.end("Unauthorized");
}

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.container{max-width:720px;width:100%;padding:2rem}
h1{font-size:1.75rem;margin-bottom:0.5rem;color:#7c3aed}
h2{font-size:1.25rem;margin:1.5rem 0 0.75rem;color:#a78bfa}
p{margin:0.5rem 0;line-height:1.6}
a{color:#7c3aed}
.card{background:#16161e;border:1px solid #2a2a3a;border-radius:8px;padding:1.5rem;margin:1rem 0}
label{display:block;margin:0.75rem 0 0.25rem;font-weight:500;font-size:0.9rem}
input,select,textarea{width:100%;padding:0.5rem 0.75rem;background:#0e0e16;border:1px solid #333;
  border-radius:4px;color:#e0e0e0;font-size:0.9rem}
textarea{min-height:120px;font-family:monospace;font-size:0.8rem}
button{background:#7c3aed;color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:4px;
  cursor:pointer;font-size:0.9rem;margin-top:1rem}
button:hover{background:#6d28d9}
button.danger{background:#dc2626}
button.danger:hover{background:#b91c1c}
.status{display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.8rem}
.status.ok{background:#065f46;color:#6ee7b7}
.status.err{background:#7f1d1d;color:#fca5a5}
.banner{text-align:center;padding:2rem 1rem 1rem;opacity:0.6}
.banner pre{font-size:0.7rem;line-height:1.2}
pre.log{background:#0e0e16;padding:1rem;border-radius:4px;overflow-x:auto;font-size:0.8rem;max-height:300px;overflow-y:auto}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
.copy-btn{font-size:0.75rem;padding:0.25rem 0.5rem;margin-left:0.5rem;background:#333}
</style>
</head>
<body>
<div class="banner"><pre>
 _  _                     ___ _
| \\| |___ _ __  ___  / __| |__ ___ __ __
| .  / -_| '  \\/ _ \\| (__| / _\` \\ V  V /
|_|\\_\\___|_|_|_\\___/ \\___|_\\__,_|\\_/\\_/
</pre></div>
<div class="container">${body}</div>
</body></html>`;
}

// ── Gateway management ─────────────────────────────────────────────
function startGateway() {
  if (gatewayProc && !gatewayProc.killed) {
    try { gatewayProc.kill(); } catch {}
  }

  const cfg = loadConfig();
  const env = { ...process.env, HOME: DATA_DIR };

  // Set LLM provider env vars based on config
  if (cfg.provider && cfg.apiKey) {
    const providerEnvMap = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GOOGLE_API_KEY",
      nvidia: "NVIDIA_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      moonshot: "MOONSHOT_API_KEY",
      minimax: "MINIMAX_API_KEY",
    };
    const envKey = providerEnvMap[cfg.provider];
    if (envKey) env[envKey] = cfg.apiKey;
  }

  // Channel tokens
  if (cfg.discordToken) env.DISCORD_TOKEN = cfg.discordToken;
  if (cfg.telegramToken) env.TELEGRAM_BOT_TOKEN = cfg.telegramToken;
  if (cfg.slackBotToken) env.SLACK_BOT_TOKEN = cfg.slackBotToken;
  if (cfg.slackAppToken) env.SLACK_APP_TOKEN = cfg.slackAppToken;

  // Solana / Privy
  if (cfg.solanaRpcUrl) env.SOLANA_RPC_URL = cfg.solanaRpcUrl;
  if (cfg.privyAppId) env.PRIVY_APP_ID = cfg.privyAppId;
  if (cfg.privyAppSecret) env.PRIVY_APP_SECRET = cfg.privyAppSecret;
  if (cfg.heliusApiKey) env.HELIUS_API_KEY = cfg.heliusApiKey;

  env.NEMOCLAW_GATEWAY_TOKEN = GATEWAY_TOKEN;
  env.PUBLIC_PORT = String(GATEWAY_PORT);
  env.CHAT_UI_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

  const logFile = fs.openSync(path.join(DATA_DIR, "gateway.log"), "a");
  gatewayProc = spawn("/usr/local/bin/nemoclaw-start", [], {
    env,
    stdio: ["ignore", logFile, logFile],
    detached: true,
  });
  gatewayProc.unref();
  console.log(`[wrapper] Gateway started (pid ${gatewayProc.pid})`);
}

function isGatewayRunning() {
  if (!gatewayProc || gatewayProc.killed) return false;
  try {
    process.kill(gatewayProc.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getGatewayLogs(lines = 100) {
  try {
    const logPath = path.join(DATA_DIR, "gateway.log");
    const content = fs.readFileSync(logPath, "utf-8");
    return content.split("\n").slice(-lines).join("\n");
  } catch {
    return "(no logs yet)";
  }
}

// ── Setup wizard HTML ──────────────────────────────────────────────
function renderSetupPage() {
  const cfg = loadConfig();
  const running = isGatewayRunning();
  const statusClass = running ? "ok" : "err";
  const statusText = running ? "Running" : "Stopped";

  return htmlPage(
    "NemoClaw Setup",
    `
<h1>NemoClaw Setup</h1>
<p>Configure your NemoClaw deployment on Fly.io.</p>

<div class="card">
  <h2>Gateway Status</h2>
  <p>Status: <span class="status ${statusClass}">${statusText}</span></p>
  <p>Gateway token: <code>${GATEWAY_TOKEN.slice(0, 8)}...</code>
    <button class="copy-btn" onclick="navigator.clipboard.writeText('${GATEWAY_TOKEN}')">Copy full token</button></p>
  <p>WebSocket URL: <code>wss://${process.env.FLY_APP_NAME || "your-app"}.fly.dev</code></p>
</div>

<form method="POST" action="/setup/save">
<div class="card">
  <h2>LLM Provider</h2>
  <div class="grid">
    <div>
      <label for="provider">Provider</label>
      <select name="provider" id="provider">
        <option value="anthropic" ${cfg.provider === "anthropic" ? "selected" : ""}>Anthropic</option>
        <option value="openai" ${cfg.provider === "openai" ? "selected" : ""}>OpenAI</option>
        <option value="nvidia" ${cfg.provider === "nvidia" ? "selected" : ""}>NVIDIA</option>
        <option value="gemini" ${cfg.provider === "gemini" ? "selected" : ""}>Google Gemini</option>
        <option value="openrouter" ${cfg.provider === "openrouter" ? "selected" : ""}>OpenRouter</option>
        <option value="moonshot" ${cfg.provider === "moonshot" ? "selected" : ""}>Moonshot AI</option>
        <option value="minimax" ${cfg.provider === "minimax" ? "selected" : ""}>MiniMax</option>
      </select>
    </div>
    <div>
      <label for="apiKey">API Key</label>
      <input type="password" name="apiKey" id="apiKey" value="${cfg.apiKey || ""}" placeholder="sk-...">
    </div>
  </div>
</div>

<div class="card">
  <h2>Solana Configuration</h2>
  <div class="grid">
    <div>
      <label for="solanaRpcUrl">Solana RPC URL</label>
      <input type="text" name="solanaRpcUrl" id="solanaRpcUrl" value="${cfg.solanaRpcUrl || ""}" placeholder="https://rpc.solanatracker.io/public">
    </div>
    <div>
      <label for="heliusApiKey">Helius API Key (optional)</label>
      <input type="password" name="heliusApiKey" id="heliusApiKey" value="${cfg.heliusApiKey || ""}" placeholder="your-helius-key">
    </div>
  </div>
  <div class="grid">
    <div>
      <label for="privyAppId">Privy App ID (optional)</label>
      <input type="text" name="privyAppId" id="privyAppId" value="${cfg.privyAppId || ""}" placeholder="clx...">
    </div>
    <div>
      <label for="privyAppSecret">Privy App Secret (optional)</label>
      <input type="password" name="privyAppSecret" id="privyAppSecret" value="${cfg.privyAppSecret || ""}" placeholder="secret...">
    </div>
  </div>
</div>

<div class="card">
  <h2>Channel Connections</h2>
  <label for="telegramToken">Telegram Bot Token</label>
  <input type="password" name="telegramToken" id="telegramToken" value="${cfg.telegramToken || ""}" placeholder="123456:ABC-...">

  <label for="discordToken">Discord Bot Token</label>
  <input type="password" name="discordToken" id="discordToken" value="${cfg.discordToken || ""}" placeholder="MTA...">

  <div class="grid">
    <div>
      <label for="slackBotToken">Slack Bot Token</label>
      <input type="password" name="slackBotToken" id="slackBotToken" value="${cfg.slackBotToken || ""}" placeholder="xoxb-...">
    </div>
    <div>
      <label for="slackAppToken">Slack App Token</label>
      <input type="password" name="slackAppToken" id="slackAppToken" value="${cfg.slackAppToken || ""}" placeholder="xapp-...">
    </div>
  </div>
</div>

<div class="card">
  <h2>Raw Configuration</h2>
  <textarea name="rawConfig" id="rawConfig">${JSON.stringify(cfg, null, 2)}</textarea>
</div>

<button type="submit">Save &amp; Restart Gateway</button>
<button type="button" class="danger" onclick="if(confirm('Reset all config?'))fetch('/setup/reset',{method:'POST'}).then(()=>location.reload())">Reset</button>
</form>

<div class="card">
  <h2>Gateway Logs</h2>
  <pre class="log" id="logs">${escapeHtml(getGatewayLogs(60))}</pre>
  <button type="button" onclick="fetch('/setup/logs').then(r=>r.text()).then(t=>document.getElementById('logs').textContent=t)">Refresh Logs</button>
</div>

<div class="card">
  <h2>Connect Local CLI</h2>
  <pre class="log">nemoclaw config set gateway.mode remote
nemoclaw config set gateway.remote.url wss://${process.env.FLY_APP_NAME || "your-app"}.fly.dev
nemoclaw config set gateway.remote.token ${GATEWAY_TOKEN}
nemoclaw health</pre>
</div>
`
  );
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Parse form body ────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        if (req.headers["content-type"]?.includes("json")) {
          resolve(JSON.parse(body));
        } else {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [k, v] of params) obj[k] = v;
          resolve(obj);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ── HTTP proxy to gateway ──────────────────────────────────────────
function proxyToGateway(req, res) {
  const opts = {
    hostname: "127.0.0.1",
    port: GATEWAY_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${GATEWAY_PORT}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Gateway unavailable — check /setup for status.");
  });

  req.pipe(proxyReq, { end: true });
}

// ── WebSocket upgrade proxy ────────────────────────────────────────
function proxyUpgrade(req, socket, head) {
  const proxySocket = require("net").connect(GATEWAY_PORT, "127.0.0.1", () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    proxySocket.write(reqLine + headers + "\r\n\r\n");
    if (head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxySocket.on("error", () => socket.destroy());
  socket.on("error", () => proxySocket.destroy());
}

// ── Main server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check — no auth
  if (url.pathname === "/healthz") {
    return json(res, {
      status: "ok",
      gateway: isGatewayRunning() ? "running" : "stopped",
      uptime: process.uptime(),
    });
  }

  // Setup routes — require auth
  if (url.pathname.startsWith("/setup")) {
    if (!checkBasicAuth(req)) return unauthorized(res);

    if (url.pathname === "/setup" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(renderSetupPage());
    }

    if (url.pathname === "/setup/save" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        let cfg;

        // If rawConfig is provided and was edited, use that
        if (body.rawConfig && body.rawConfig.trim().startsWith("{")) {
          try {
            cfg = JSON.parse(body.rawConfig);
          } catch {
            cfg = loadConfig();
          }
        } else {
          cfg = loadConfig();
        }

        // Overlay form fields
        const fields = [
          "provider", "apiKey", "solanaRpcUrl", "heliusApiKey",
          "privyAppId", "privyAppSecret",
          "telegramToken", "discordToken", "slackBotToken", "slackAppToken",
        ];
        for (const f of fields) {
          if (body[f] !== undefined) {
            if (body[f]) cfg[f] = body[f];
            else delete cfg[f];
          }
        }

        saveConfig(cfg);
        startGateway();

        // Redirect back to setup
        res.writeHead(303, { Location: "/setup" });
        return res.end();
      } catch (e) {
        return json(res, { error: e.message }, 400);
      }
    }

    if (url.pathname === "/setup/reset" && req.method === "POST") {
      try { fs.unlinkSync(CONFIG_PATH); } catch {}
      if (gatewayProc && !gatewayProc.killed) {
        try { gatewayProc.kill(); } catch {}
      }
      return json(res, { status: "reset" });
    }

    if (url.pathname === "/setup/logs" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(getGatewayLogs(200));
    }

    if (url.pathname === "/setup/restart" && req.method === "POST") {
      startGateway();
      return json(res, { status: "restarting" });
    }

    if (url.pathname === "/setup/config" && req.method === "GET") {
      return json(res, loadConfig());
    }

    if (url.pathname === "/setup/config" && req.method === "PUT") {
      const body = await parseBody(req);
      saveConfig(body);
      return json(res, { status: "saved" });
    }

    if (url.pathname === "/setup/export" && req.method === "GET") {
      const cfg = loadConfig();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=nemoclaw-config.json",
      });
      return res.end(JSON.stringify(cfg, null, 2));
    }

    return json(res, { error: "Not found" }, 404);
  }

  // Everything else proxies to the gateway
  proxyToGateway(req, res);
});

// WebSocket upgrade
server.on("upgrade", proxyUpgrade);

// ── Boot ───────────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });

// Auto-start gateway if config exists
const cfg = loadConfig();
if (cfg.provider && cfg.apiKey) {
  console.log("[wrapper] Config found — starting gateway automatically");
  startGateway();
} else {
  console.log("[wrapper] No config found — visit /setup to configure");
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[wrapper] NemoClaw wrapper listening on :${PORT}`);
  console.log(`[wrapper] Setup wizard: http://0.0.0.0:${PORT}/setup`);
  console.log(`[wrapper] Health check: http://0.0.0.0:${PORT}/healthz`);
});
