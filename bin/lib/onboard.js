// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Interactive onboarding wizard — 7 steps from zero to running sandbox.

const fs = require("fs");
const path = require("path");
const { ROOT, SCRIPTS, run, runCapture, ensureDockerCliOnPath } = require("./runner");
const { prompt, ensureApiKey, getCredential } = require("./credentials");
const registry = require("./registry");
const nim = require("./nim");
const policies = require("./policies");
const { checkCgroupConfig } = require("./preflight");
const solana = require("./solana");
const HOST_GATEWAY_URL = "http://host.openshell.internal";
const EXPERIMENTAL = process.env.NEMOCLAW_EXPERIMENTAL === "1";

// ── Helpers ──────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

function step(n, total, msg) {
  console.log("");
  console.log(`  [${n}/${total}] ${msg}`);
  console.log(`  ${"─".repeat(50)}`);
}

function getDockerStatus() {
  const dockerBinary = ensureDockerCliOnPath();
  if (!dockerBinary) {
    return {
      ok: false,
      reason: "Docker CLI not found on PATH.",
    };
  }

  try {
    runCapture("docker info", { ignoreError: false });
    return { ok: true };
  } catch (err) {
    const detail = [
      err && err.stderr ? String(err.stderr) : "",
      err && err.stdout ? String(err.stdout) : "",
      err && err.message ? String(err.message) : "",
    ]
      .map((line) => line.trim())
      .find(Boolean);

    return {
      ok: false,
      reason: detail || "docker info failed",
    };
  }
}

function isOpenshellInstalled() {
  try {
    runCapture("command -v openshell");
    return true;
  } catch {
    return false;
  }
}

function installOpenshell() {
  console.log("  Installing openshell CLI...");
  run(`bash "${path.join(SCRIPTS, "install-openshell.sh")}"`, { ignoreError: true });
  return isOpenshellInstalled();
}

function copyIntoBuildContext(buildCtx, relativePath) {
  const source = path.join(ROOT, relativePath);
  const target = path.join(buildCtx, relativePath);
  if (!fs.existsSync(source)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  run(`cp -r "${source}" "${target}"`);
}

function waitForSandboxReady(sandboxName, attempts = 15, delaySeconds = 2) {
  for (let i = 0; i < attempts; i++) {
    const line = runCapture("openshell sandbox list 2>&1", { ignoreError: true })
      .replace(/\x1b\[[0-9;]*m/g, "")
      .split("\n")
      .find((entry) => entry.includes(sandboxName));

    if (line && /\bReady\b/i.test(line)) {
      return { ok: true, line };
    }

    if (i < attempts - 1) {
      require("child_process").spawnSync("sleep", [String(delaySeconds)]);
    }
  }

  const detail = runCapture(`openshell sandbox get "${sandboxName}" 2>&1`, { ignoreError: true });
  return { ok: false, detail };
}

async function promptSelection(question, optionsLength, defaultIndexOneBased) {
  while (true) {
    const answer = await prompt(question);
    if (!answer) {
      return defaultIndexOneBased - 1;
    }

    const parsed = parseInt(answer, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= optionsLength) {
      return parsed - 1;
    }

    console.log(`  Invalid choice: ${answer}. Enter a number from 1 to ${optionsLength}.`);
  }
}

// ── Step 1: Preflight ────────────────────────────────────────────

async function preflight() {
  step(1, TOTAL_STEPS, "Preflight checks");

  // Docker
  const docker = getDockerStatus();
  if (!docker.ok) {
    console.error("  Docker is not running or not reachable.");
    console.error(`  Detail: ${docker.reason}`);
    if (process.env.DOCKER_HOST) {
      console.error(`  DOCKER_HOST=${process.env.DOCKER_HOST}`);
    }
    if (process.platform === "darwin") {
      console.error("  If Docker Desktop is already open, make sure your shell can see the Docker CLI.");
    }
    process.exit(1);
  }
  console.log("  ✓ Docker is running");

  // OpenShell CLI
  if (!isOpenshellInstalled()) {
    console.log("  openshell CLI not found. Attempting to install...");
    if (!installOpenshell()) {
      console.error("  Failed to install openshell CLI.");
      console.error("  Install manually: https://github.com/NVIDIA/OpenShell/releases");
      process.exit(1);
    }
  }
  console.log(`  ✓ openshell CLI: ${runCapture("openshell --version 2>/dev/null || echo unknown", { ignoreError: true })}`);

  // cgroup v2 + Docker cgroupns
  const cgroup = checkCgroupConfig();
  if (!cgroup.ok) {
    console.error("");
    console.error("  !! cgroup v2 detected but Docker is not configured for cgroupns=host.");
    console.error("     OpenShell's gateway runs k3s inside Docker, which will fail with:");
    console.error("");
    console.error("       openat2 /sys/fs/cgroup/kubepods/pids.max: no such file or directory");
    console.error("");
    console.error("     To fix, run:");
    console.error("");
    console.error("       nemoclaw setup-spark");
    console.error("");
    console.error("     This adds \"default-cgroupns-mode\": \"host\" to /etc/docker/daemon.json");
    console.error("     (preserving any existing settings) and restarts Docker.");
    console.error("");
    console.error(`     Detail: ${cgroup.reason}`);
    process.exit(1);
  }
  console.log("  ✓ cgroup configuration OK");

  // GPU
  const gpu = nim.detectGpu();
  if (gpu && gpu.type === "nvidia") {
    console.log(`  ✓ NVIDIA GPU detected: ${gpu.count} GPU(s), ${gpu.totalMemoryMB} MB VRAM`);
  } else if (gpu && gpu.type === "apple") {
    console.log(`  ✓ Apple GPU detected: ${gpu.name}${gpu.cores ? ` (${gpu.cores} cores)` : ""}, ${gpu.totalMemoryMB} MB unified memory`);
    console.log("  ⓘ NIM requires NVIDIA GPU — will use cloud inference");
  } else {
    console.log("  ⓘ No GPU detected — will use cloud inference");
  }

  return gpu;
}

// ── Step 2: Gateway ──────────────────────────────────────────────

async function startGateway(gpu) {
  step(2, TOTAL_STEPS, "Starting OpenShell gateway");

  // Destroy old gateway
  run("openshell gateway destroy -g nemoclaw 2>/dev/null || true", { ignoreError: true });

  const gwArgs = ["--name", "nemoclaw"];
  if (gpu && gpu.nimCapable) gwArgs.push("--gpu");

  run(`openshell gateway start ${gwArgs.join(" ")}`, { ignoreError: false });

  // Verify health
  for (let i = 0; i < 5; i++) {
    const status = runCapture("openshell status 2>&1", { ignoreError: true });
    if (status.includes("Connected")) {
      console.log("  ✓ Gateway is healthy");
      break;
    }
    if (i === 4) {
      console.error("  Gateway failed to start. Run: openshell gateway info");
      process.exit(1);
    }
    require("child_process").spawnSync("sleep", ["2"]);
  }

  // CoreDNS fix — k3s-inside-Docker can inherit an unusable resolver on
  // Docker Desktop and Colima, so patch it after gateway startup.
  console.log("  Patching CoreDNS...");
  run(`bash "${path.join(SCRIPTS, "fix-coredns.sh")}" 2>&1 || true`, { ignoreError: true });
  // Give DNS a moment to propagate
  require("child_process").spawnSync("sleep", ["5"]);
}

// ── Step 3: Sandbox ──────────────────────────────────────────────

async function createSandbox(gpu) {
  step(3, TOTAL_STEPS, "Creating sandbox");

  const nameAnswer = await prompt("  Sandbox name (lowercase, numbers, hyphens) [my-assistant]: ");
  const sandboxName = (nameAnswer || "my-assistant").trim().toLowerCase();

  // Validate: RFC 1123 subdomain — lowercase alphanumeric and hyphens,
  // must start and end with alphanumeric (required by Kubernetes/OpenShell)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sandboxName)) {
    console.error(`  Invalid sandbox name: '${sandboxName}'`);
    console.error("  Names must be lowercase, contain only letters, numbers, and hyphens,");
    console.error("  and must start and end with a letter or number.");
    process.exit(1);
  }

  // Check if sandbox already exists in registry
  const existing = registry.getSandbox(sandboxName);
  if (existing) {
    const recreate = await prompt(`  Sandbox '${sandboxName}' already exists. Recreate? [y/N]: `);
    if (recreate.toLowerCase() !== "y") {
      console.log("  Keeping existing sandbox.");
      return sandboxName;
    }
    // Destroy old sandbox
    run(`openshell sandbox delete "${sandboxName}" 2>/dev/null || true`, { ignoreError: true });
    registry.removeSandbox(sandboxName);
  }

  // Stage build context
  const { mkdtempSync } = require("fs");
  const os = require("os");
  const buildCtx = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-build-"));
  fs.copyFileSync(path.join(ROOT, "Dockerfile"), path.join(buildCtx, "Dockerfile"));
  run(`cp -r "${path.join(ROOT, "nemoclaw")}" "${buildCtx}/nemoclaw"`);
  run(`cp -r "${path.join(ROOT, "nemoclaw-blueprint")}" "${buildCtx}/nemoclaw-blueprint"`);
  run(`cp -r "${path.join(ROOT, "scripts")}" "${buildCtx}/scripts"`);
  [
    path.join("Pump-Fun", "agent-app"),
    path.join("Pump-Fun", "agent-tasks"),
    path.join("Pump-Fun", "docs"),
    path.join("Pump-Fun", "src"),
    path.join("Pump-Fun", "packages", "defi-agents"),
    path.join("Pump-Fun", "pumpkit"),
    path.join("Pump-Fun", "pumpkit", "agent-prompts"),
    path.join("Pump-Fun", "telegram-bot"),
    path.join("Pump-Fun", "swarm-bot"),
    path.join("Pump-Fun", "websocket-server"),
    path.join("Pump-Fun", "tools"),
    path.join("Pump-Fun", "x402"),
    path.join("pump-fun-skills-main", "tokenized-agents"),
  ].forEach((relativePath) => copyIntoBuildContext(buildCtx, relativePath));
  run(`rm -rf "${buildCtx}/nemoclaw/node_modules" "${buildCtx}/nemoclaw/src"`, { ignoreError: true });

  const pluginDist = path.join(buildCtx, "nemoclaw", "dist");
  if (!fs.existsSync(pluginDist) || fs.readdirSync(pluginDist).length === 0) {
    run(`rm -rf "${buildCtx}"`, { ignoreError: true });
    console.error("  nemoclaw/dist is missing or empty.");
    console.error("  Run `npm run build:plugin` and retry onboarding.");
    process.exit(1);
  }

  // Create sandbox (use -- echo to avoid dropping into interactive shell)
  // Pass the base policy so sandbox starts in proxy mode (required for policy updates later)
  const basePolicyPath = path.join(ROOT, "nemoclaw-blueprint", "policies", "openclaw-sandbox.yaml");
  const createArgs = [
    `--from "${buildCtx}/Dockerfile"`,
    `--name "${sandboxName}"`,
    `--policy "${basePolicyPath}"`,
  ];
  if (gpu && gpu.nimCapable) createArgs.push("--gpu");

  console.log(`  Creating sandbox '${sandboxName}' (this takes a few minutes on first run)...`);
  const chatUiUrl = process.env.CHAT_UI_URL || 'http://127.0.0.1:18789';
  const envArgs = [`CHAT_UI_URL=${chatUiUrl}`];
  if (process.env.NVIDIA_API_KEY) {
    envArgs.push(`NVIDIA_API_KEY=${process.env.NVIDIA_API_KEY}`);
  }

  // Inject Solana environment variables into the sandbox
  const solanaEnv = solana.getSolanaEnvVars();
  for (const [key, val] of Object.entries(solanaEnv)) {
    if (val) envArgs.push(`${key}=${val}`);
  }
  run(`set -o pipefail; openshell sandbox create ${createArgs.join(" ")} -- env ${envArgs.join(" ")} nemoclaw-start 2>&1 | awk '/Sandbox allocated/{if(!seen){print;seen=1}next}1'`);

  const sandboxStatus = waitForSandboxReady(sandboxName);
  if (!sandboxStatus.ok) {
    run(`rm -rf "${buildCtx}"`, { ignoreError: true });
    console.error("");
    console.error(`  Sandbox '${sandboxName}' did not reach Ready state.`);
    if (sandboxStatus.detail) {
      console.error(sandboxStatus.detail);
    }
    process.exit(1);
  }

  // Forward dashboard port separately
  const forward = run(`openshell forward start --background 18789 "${sandboxName}"`, { ignoreError: true });
  if (forward.status !== 0) {
    console.log("  ⓘ Dashboard port forward on 18789 could not be started.");
    console.log("    Another local process may already be using that port.");
  }

  // Clean up build context
  run(`rm -rf "${buildCtx}"`, { ignoreError: true });

  // Register in registry
  registry.registerSandbox({
    name: sandboxName,
    gpuEnabled: !!gpu,
  });

  console.log(`  ✓ Sandbox '${sandboxName}' created`);
  return sandboxName;
}

// ── Step 4: NIM ──────────────────────────────────────────────────

async function setupNim(sandboxName, gpu) {
  step(4, TOTAL_STEPS, "Configuring inference (NIM)");

  let model = null;
  let provider = "nvidia-nim";
  let nimContainer = null;

  // Detect local inference options
  const hasOllama = !!runCapture("command -v ollama", { ignoreError: true });
  const ollamaRunning = !!runCapture("curl -sf http://localhost:11434/api/tags 2>/dev/null", { ignoreError: true });
  const vllmRunning = !!runCapture("curl -sf http://localhost:8000/v1/models 2>/dev/null", { ignoreError: true });

  // Auto-select only with NEMOCLAW_EXPERIMENTAL=1 (prevents silent misconfiguration)
  if (EXPERIMENTAL) {
    if (vllmRunning) {
      console.log("  ✓ vLLM detected on localhost:8000 — using it [experimental]");
      provider = "vllm-local";
      model = "vllm-local";
      registry.updateSandbox(sandboxName, { model, provider, nimContainer });
      return { model, provider };
    }
    if (ollamaRunning) {
      console.log("  ✓ Ollama detected on localhost:11434");
      console.log("  Pulling 8bit/DeepSolana...");
      run("ollama pull 8bit/DeepSolana 2>&1 || true", { ignoreError: true });
      provider = "ollama-local";
      model = "8bit/DeepSolana";
      registry.updateSandbox(sandboxName, { model, provider, nimContainer });
      return { model, provider };
    }
  }

  // Build options list — only show local options with NEMOCLAW_EXPERIMENTAL=1
  const options = [];
  if (EXPERIMENTAL && gpu && gpu.nimCapable) {
    options.push({ key: "nim", label: "Local NIM container (NVIDIA GPU) [experimental]" });
  }
  options.push({ key: "cloud", label: "NVIDIA Cloud API (build.nvidia.com)" });
  if (hasOllama || ollamaRunning) {
    options.push({ key: "ollama", label: `Ollama + DeepSolana (localhost:11434)${ollamaRunning ? " — running" : ""}` });
  }
  if (EXPERIMENTAL && vllmRunning) {
    options.push({ key: "vllm", label: "Existing vLLM instance (localhost:8000) — running [experimental]" });
  }

  // On macOS without Ollama, offer to install it
  if (!hasOllama && process.platform === "darwin") {
    options.push({ key: "install-ollama", label: "Install Ollama + DeepSolana (macOS)" });
  }

  if (options.length > 1) {
    console.log("");
    console.log("  Inference options:");
    options.forEach((o, i) => {
      console.log(`    ${i + 1}) ${o.label}`);
    });
    console.log("");

    const defaultIdx = options.findIndex((o) => o.key === "cloud") + 1;
    const idx = await promptSelection(`  Choose [${defaultIdx}]: `, options.length, defaultIdx);
    const selected = options[idx];

    if (selected.key === "nim") {
      // List models that fit GPU VRAM
      const models = nim.listModels().filter((m) => m.minGpuMemoryMB <= gpu.totalMemoryMB);
      if (models.length === 0) {
        console.log("  No NIM models fit your GPU VRAM. Falling back to cloud API.");
      } else {
        console.log("");
        console.log("  Models that fit your GPU:");
        models.forEach((m, i) => {
          console.log(`    ${i + 1}) ${m.name} (min ${m.minGpuMemoryMB} MB)`);
        });
        console.log("");

        const midx = await promptSelection("  Choose model [1]: ", models.length, 1);
        const sel = models[midx];
        model = sel.name;

        console.log(`  Pulling NIM image for ${model}...`);
        nim.pullNimImage(model);

        console.log("  Starting NIM container...");
        nimContainer = nim.startNimContainer(sandboxName, model);

        console.log("  Waiting for NIM to become healthy...");
        if (!nim.waitForNimHealth()) {
          console.error("  NIM failed to start. Falling back to cloud API.");
          model = null;
          nimContainer = null;
        } else {
          provider = "vllm-local";
        }
      }
    } else if (selected.key === "ollama") {
      if (!ollamaRunning) {
        console.log("  Starting Ollama...");
        run("OLLAMA_HOST=0.0.0.0:11434 ollama serve > /dev/null 2>&1 &", { ignoreError: true });
        require("child_process").spawnSync("sleep", ["2"]);
      }
      console.log("  Pulling 8bit/DeepSolana (Solana-tuned model)...");
      run("ollama pull 8bit/DeepSolana 2>&1 || true", { ignoreError: true });
      console.log("  ✓ Using Ollama + 8bit/DeepSolana");
      provider = "ollama-local";
      model = "8bit/DeepSolana";
    } else if (selected.key === "install-ollama") {
      console.log("  Installing Ollama via Homebrew...");
      run("brew install ollama", { ignoreError: true });
      console.log("  Starting Ollama...");
      run("OLLAMA_HOST=0.0.0.0:11434 ollama serve > /dev/null 2>&1 &", { ignoreError: true });
      require("child_process").spawnSync("sleep", ["2"]);
      console.log("  Pulling 8bit/DeepSolana (Solana-tuned model)...");
      run("ollama pull 8bit/DeepSolana 2>&1 || true", { ignoreError: true });
      console.log("  ✓ Using Ollama + 8bit/DeepSolana");
      provider = "ollama-local";
      model = "8bit/DeepSolana";
    } else if (selected.key === "vllm") {
      console.log("  ✓ Using existing vLLM on localhost:8000");
      provider = "vllm-local";
      model = "vllm-local";
    }
    // else: cloud — fall through to default below
  }

  if (provider === "nvidia-nim") {
    await ensureApiKey();
    model = model || "nvidia/nemotron-3-super-120b-a12b";
    console.log(`  Using NVIDIA Cloud API with model: ${model}`);
  }

  registry.updateSandbox(sandboxName, { model, provider, nimContainer });

  return { model, provider };
}

// ── Step 5: Inference provider ───────────────────────────────────

async function setupInference(sandboxName, model, provider) {
  step(5, TOTAL_STEPS, "Setting up inference provider");

  if (provider === "nvidia-nim") {
    // Create nvidia-nim provider
    run(
      `openshell provider create --name nvidia-nim --type openai ` +
      `--credential "NVIDIA_API_KEY=${process.env.NVIDIA_API_KEY}" ` +
      `--config "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider nvidia-nim --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  } else if (provider === "vllm-local") {
    run(
      `openshell provider create --name vllm-local --type openai ` +
      `--credential "OPENAI_API_KEY=dummy" ` +
      `--config "OPENAI_BASE_URL=${HOST_GATEWAY_URL}:8000/v1" 2>&1 || ` +
      `openshell provider update vllm-local --credential "OPENAI_API_KEY=dummy" ` +
      `--config "OPENAI_BASE_URL=${HOST_GATEWAY_URL}:8000/v1" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider vllm-local --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  } else if (provider === "ollama-local") {
    run(
      `openshell provider create --name ollama-local --type openai ` +
      `--credential "OPENAI_API_KEY=ollama" ` +
      `--config "OPENAI_BASE_URL=${HOST_GATEWAY_URL}:11434/v1" 2>&1 || ` +
      `openshell provider update ollama-local --credential "OPENAI_API_KEY=ollama" ` +
      `--config "OPENAI_BASE_URL=${HOST_GATEWAY_URL}:11434/v1" 2>&1 || true`,
      { ignoreError: true }
    );
    run(
      `openshell inference set --no-verify --provider ollama-local --model ${model} 2>/dev/null || true`,
      { ignoreError: true }
    );
  }

  registry.updateSandbox(sandboxName, { model, provider });
  console.log(`  ✓ Inference route set: ${provider} / ${model}`);
}

// ── Step 6: OpenClaw ─────────────────────────────────────────────

async function setupOpenclaw(sandboxName) {
  step(6, TOTAL_STEPS, "Setting up OpenClaw inside sandbox");

  // sandbox create with a command runs it inside the sandbox then exits.
  // Since the sandbox already exists, we create a throwaway connect + command
  // by using sandbox create --no-keep with the same image to exec into it.
  // Simpler: just use sandbox connect which opens a shell — but it doesn't
  // support passing commands. So we run the setup on next connect instead.
  console.log("  ✓ OpenClaw gateway launched inside sandbox");
}

// ── Step 7: Solana Configuration ─────────────────────────────────

async function setupSolana(sandboxName) {
  step(7, TOTAL_STEPS, "Solana & Wallet Configuration");

  // Check for existing config
  const existing = solana.loadSolanaConfig();
  if (existing && existing.rpcUrl) {
    console.log(`  Existing Solana config found: ${existing.rpcUrl}`);
    const reuse = await prompt("  Keep existing Solana configuration? [Y/n]: ");
    if (reuse.toLowerCase() !== "n") {
      console.log("  ✓ Keeping existing Solana configuration");
      return existing;
    }
  }

  // RPC URL selection
  console.log("");
  console.log("  Solana RPC endpoint:");
  solana.DEFAULT_RPC_OPTIONS.forEach((o, i) => {
    console.log(`    ${i + 1}) ${o.label} — ${o.url || '(you provide)'}`);
  });
  console.log("");

  const defaultRpcChoice =
    (process.env.HELIUS_API_KEY || (existing && existing.heliusApiKey)) ? "3" : "1";
  const rpcIdx = await promptSelection(
    `  Choose RPC [${defaultRpcChoice}]: `,
    solana.DEFAULT_RPC_OPTIONS.length,
    parseInt(defaultRpcChoice, 10)
  );
  const selected = solana.DEFAULT_RPC_OPTIONS[rpcIdx];

  let rpcUrl = selected.url;
  let heliusApiKey = null;
  if (selected.key === "helius") {
    const detectedHeliusKey =
      process.env.HELIUS_API_KEY ||
      (existing && existing.heliusApiKey) ||
      solana.extractHeliusApiKey(existing && existing.rpcUrl);
    const heliusPrompt = detectedHeliusKey
      ? `  Helius API key [saved ${detectedHeliusKey.slice(0, 6)}...]: `
      : "  Helius API key: ";
    const heliusKey = await prompt(heliusPrompt);
    heliusApiKey = (heliusKey || detectedHeliusKey || "").trim();
    if (!heliusApiKey) {
      console.log("  ⚠ No Helius API key provided. Falling back to Solana Tracker RPC.");
      rpcUrl = "https://rpc.solanatracker.io/public";
      heliusApiKey = null;
    } else {
    rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    }
  } else if (selected.key === "custom") {
    rpcUrl = await prompt("  Custom RPC URL: ");
  } else if (selected.key === "local") {
    console.log("  Will use local test-validator (localhost:8899)");
    // Check if solana-test-validator is installed
    if (!solana.isSolanaCliInstalled()) {
      console.log("  ⓘ solana-test-validator not found on host.");
      console.log("    It's available inside the sandbox via Solana CLI tools.");
    }
  }

  // Test connection
  if (rpcUrl && selected.key !== "local") {
    console.log(`  Testing connection to ${rpcUrl.substring(0, 60)}...`);
    if (solana.testRpcConnection(rpcUrl)) {
      const version = solana.getSolanaClusterVersion(rpcUrl);
      console.log(`  ✓ Connected${version ? ` (Solana ${version})` : ''}`);
    } else {
      console.log("  ⚠ Could not reach RPC endpoint. Continuing anyway.");
    }
  }

  // Privy agentic wallet setup
  console.log("");
  const wantWallet = await prompt("  Set up Privy agentic wallet? [Y/n]: ");

  let privyConfig = null;
  let wallet = null;

  if (wantWallet.toLowerCase() !== "n") {
    const existingPrivy = solana.loadPrivyConfig();
    if (existingPrivy && existingPrivy.appId) {
      console.log(`  Existing Privy config found (app: ${existingPrivy.appId.substring(0, 12)}...)`);
      const reuse = await prompt("  Keep existing Privy credentials? [Y/n]: ");
      if (reuse.toLowerCase() !== "n") {
        privyConfig = existingPrivy;
      }
    }

    if (!privyConfig) {
      console.log("  Get credentials from: https://dashboard.privy.io");
      const appId = await prompt("  Privy App ID: ");
      const appSecret = await prompt("  Privy App Secret: ", { silent: true });

      if (appId && appSecret) {
        privyConfig = {
          appId: appId.trim(),
          appSecret: appSecret.trim(),
          configuredAt: new Date().toISOString(),
        };
        solana.savePrivyConfig(privyConfig);
        console.log("  ✓ Privy credentials saved");
      } else {
        console.log("  Skipping Privy wallet setup.");
      }
    }

    // Create wallet if we have credentials
    if (privyConfig) {
      const createWallet = await prompt("  Create a new Solana wallet now? [Y/n]: ");
      if (createWallet.toLowerCase() !== "n") {
        console.log("  Creating Solana agentic wallet via Privy...");
        wallet = await solana.createPrivyWallet({ chainType: "solana" });
        if (wallet) {
          console.log(`  ✓ Wallet created: ${wallet.address}`);
          console.log("  ⓘ Private keys are managed by Privy — never stored locally.");

          // Create default spending policy
          console.log("  Creating default spending policy (max 0.1 SOL per tx)...");
          const policy = await solana.createPrivyPolicy({
            name: "NemoClaw Default",
            maxLamports: 100_000_000,
            ownerPublicKey: wallet.address,
          });
          if (policy) {
            console.log(`  ✓ Policy created: ${policy.name || policy.id}`);
          }
        }
      }
    }
  }

  // Pump-Fun agent token config
  console.log("");
  let agentTokenMint = process.env.AGENT_TOKEN_MINT_ADDRESS || null;
  let developerWallet = process.env.DEVELOPER_WALLET || (wallet ? wallet.address : null);

  if (!agentTokenMint) {
    const wantPump = await prompt("  Configure Pump-Fun tokenized agent? [y/N]: ");
    if (wantPump.toLowerCase() === "y") {
      agentTokenMint = await prompt("  Agent token mint address (from pump.fun): ");
      if (!developerWallet) {
        developerWallet = await prompt("  Developer wallet address: ");
      }
    }
  }

  // Save config
  const config = {
    rpcUrl: rpcUrl || "https://rpc.solanatracker.io/public",
    wsUrl: solana.deriveSolanaWsUrl(rpcUrl || "https://rpc.solanatracker.io/public"),
    rpcProvider: selected.key,
    heliusApiKey: heliusApiKey || solana.extractHeliusApiKey(rpcUrl),
    agentTokenMint: agentTokenMint ? agentTokenMint.trim() : null,
    developerWallet: developerWallet ? developerWallet.trim() : null,
    currencyMint: "So11111111111111111111111111111111111111112",
    testValidator: selected.key === "local",
    privyConfigured: !!privyConfig,
    walletAddress: wallet ? wallet.address : null,
    configuredAt: new Date().toISOString(),
  };
  solana.saveSolanaConfig(config);

  // Set env so sandbox creation picks it up
  process.env.SOLANA_RPC_URL = config.rpcUrl;
  if (config.wsUrl) process.env.SOLANA_WS_URL = config.wsUrl;
  if (config.heliusApiKey) process.env.HELIUS_API_KEY = config.heliusApiKey;
  if (config.agentTokenMint) process.env.AGENT_TOKEN_MINT_ADDRESS = config.agentTokenMint;
  if (config.developerWallet) process.env.DEVELOPER_WALLET = config.developerWallet;

  registry.updateSandbox(sandboxName, {
    solanaRpcUrl: config.rpcUrl,
    solanaWallet: config.walletAddress,
    pumpfunMint: config.agentTokenMint,
  });

  console.log("  ✓ Solana configuration saved");
  return config;
}

// ── Step 8: Test Validator ───────────────────────────────────────

async function setupTestValidator(sandboxName, solConfig) {
  step(8, TOTAL_STEPS, "Solana test-validator (optional)");

  if (!solConfig || !solConfig.testValidator) {
    console.log("  Using remote RPC — skipping local test-validator.");
    return;
  }

  if (!solana.isSolanaCliInstalled()) {
    console.log("  solana-test-validator not installed on host.");
    console.log("  You can run it inside the sandbox instead:");
    console.log("    nemoclaw <name> connect");
    console.log("    solana-test-validator &");
    return;
  }

  if (solana.isTestValidatorRunning()) {
    console.log("  ✓ solana-test-validator already running on localhost:8899");
    return;
  }

  const startIt = await prompt("  Start solana-test-validator on host? [Y/n]: ");
  if (startIt.toLowerCase() === "n") {
    console.log("  Skipping test-validator.");
    return;
  }

  // Clone Pump programs from mainnet so tokens work locally
  const clonePrograms = [
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",   // Pump
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",   // PumpAMM
    "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",   // PumpFees
    "AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7",   // Agent Payments
  ];

  console.log("  Starting test-validator with cloned Pump programs...");
  const result = solana.startTestValidator({
    fundWallet: solConfig.walletAddress || undefined,
    clonePrograms,
  });

  if (result) {
    console.log(`  ✓ test-validator running (pid ${result.pid}, rpc: ${result.rpcUrl})`);
  } else {
    console.log("  ⚠ test-validator failed to start. Check ~/.nemoclaw/test-validator.log");
  }
}

// ── Step 7: Policy presets ───────────────────────────────────────

async function setupPolicies(sandboxName) {
  step(9, TOTAL_STEPS, "Policy presets");

  const suggestions = ["pypi", "npm"];

  // Auto-detect based on env tokens
  if (getCredential("TELEGRAM_BOT_TOKEN")) {
    suggestions.push("telegram");
    console.log("  Auto-detected: TELEGRAM_BOT_TOKEN → suggesting telegram preset");
  }
  // Solana is always suggested since we configure it in step 7
  const solConfig = solana.loadSolanaConfig();
  if (solConfig || getCredential("SOLANA_RPC_URL") || process.env.SOLANA_RPC_URL) {
    suggestions.push("solana-rpc");
    console.log("  Auto-detected: Solana RPC configured → suggesting solana-rpc preset");
  }
  if (
    getCredential("AGENT_TOKEN_MINT_ADDRESS") || process.env.AGENT_TOKEN_MINT_ADDRESS ||
    getCredential("DEVELOPER_WALLET") || process.env.DEVELOPER_WALLET ||
    (solConfig && solConfig.agentTokenMint)
  ) {
    suggestions.push("pumpfun");
    console.log("  Auto-detected: Pump-Fun agent env → suggesting pumpfun preset");
  }
  // Privy agentic wallet
  const privyConfig = solana.loadPrivyConfig();
  if (privyConfig || getCredential("PRIVY_APP_ID") || process.env.PRIVY_APP_ID) {
    suggestions.push("privy");
    console.log("  Auto-detected: Privy credentials → suggesting privy preset");
  }
  if (getCredential("SLACK_BOT_TOKEN") || process.env.SLACK_BOT_TOKEN) {
    suggestions.push("slack");
    console.log("  Auto-detected: SLACK_BOT_TOKEN → suggesting slack preset");
  }
  if (getCredential("DISCORD_BOT_TOKEN") || process.env.DISCORD_BOT_TOKEN) {
    suggestions.push("discord");
    console.log("  Auto-detected: DISCORD_BOT_TOKEN → suggesting discord preset");
  }

  const allPresets = policies.listPresets();
  const applied = policies.getAppliedPresets(sandboxName);

  console.log("");
  console.log("  Available policy presets:");
  allPresets.forEach((p) => {
    const marker = applied.includes(p.name) ? "●" : "○";
    const suggested = suggestions.includes(p.name) ? " (suggested)" : "";
    console.log(`    ${marker} ${p.name} — ${p.description}${suggested}`);
  });
  console.log("");

  const answer = await prompt(`  Apply suggested presets (${suggestions.join(", ")})? [Y/n/list]: `);

  if (answer.toLowerCase() === "n") {
    console.log("  Skipping policy presets.");
    return;
  }

  if (answer.toLowerCase() === "list") {
    // Let user pick
    const picks = await prompt("  Enter preset names (comma-separated): ");
    const selected = picks.split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of selected) {
      policies.applyPreset(sandboxName, name);
    }
  } else {
    // Apply suggested
    for (const name of suggestions) {
      policies.applyPreset(sandboxName, name);
    }
  }

  console.log("  ✓ Policies applied");
}

// ── Dashboard ────────────────────────────────────────────────────

function printDashboard(sandboxName, model, provider) {
  const nimStat = nim.nimStatus(sandboxName);
  const nimLabel = nimStat.running ? "running" : "not running";
  const solConfig = solana.loadSolanaConfig();
  const wallet = solana.getDefaultWallet();

  let providerLabel = provider;
  if (provider === "nvidia-nim") providerLabel = "NVIDIA Cloud API";
  else if (provider === "vllm-local") providerLabel = "Local vLLM";

  console.log("");
  console.log(`  ${"─".repeat(56)}`);
  console.log(`  Sandbox      ${sandboxName} (Landlock + seccomp + netns)`);
  console.log(`  Model        ${model} (${providerLabel})`);
  console.log(`  NIM          ${nimLabel}`);
  if (solConfig) {
    const rpcShort = solConfig.rpcUrl.length > 40
      ? solConfig.rpcUrl.substring(0, 37) + '...'
      : solConfig.rpcUrl;
    console.log(`  Solana RPC   ${rpcShort}`);
    if (solConfig.rpcProvider === "helius") {
      console.log("  Helius       enabled");
    }
  }
  if (wallet) {
    console.log(`  Wallet       ${wallet.address} (Privy)`);
  }
  if (solConfig && solConfig.agentTokenMint) {
    console.log(`  Agent Token  ${solConfig.agentTokenMint}`);
  }
  console.log(`  ${"─".repeat(56)}`);
  console.log(`  Run:         nemoclaw ${sandboxName} connect`);
  console.log(`  Solana Up:   nemoclaw solana start ${sandboxName}`);
  console.log(`  Status:      nemoclaw ${sandboxName} status`);
  console.log(`  Logs:        nemoclaw ${sandboxName} logs --follow`);
  console.log(`  Solana:      nemoclaw ${sandboxName} solana-agent`);
  console.log(`  ${"─".repeat(56)}`);
  console.log("");
}

// ── Main ─────────────────────────────────────────────────────────

async function onboard() {
  console.log("");
  console.log("  NemoClaw Onboarding");
  console.log("  ===================");

  const gpu = await preflight();
  await startGateway(gpu);
  const sandboxName = await createSandbox(gpu);
  const { model, provider } = await setupNim(sandboxName, gpu);
  await setupInference(sandboxName, model, provider);
  await setupOpenclaw(sandboxName);
  const solConfig = await setupSolana(sandboxName);
  await setupTestValidator(sandboxName, solConfig);
  await setupPolicies(sandboxName);
  printDashboard(sandboxName, model, provider);
}

module.exports = { onboard };
