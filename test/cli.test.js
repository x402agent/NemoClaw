// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const CLI = path.join(__dirname, "..", "bin", "nemoclaw.js");

function run(args) {
  try {
    const out = execSync(`node "${CLI}" ${args}`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: "/tmp/nemoclaw-cli-test-" + Date.now() },
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: (err.stdout || "") + (err.stderr || "") };
  }
}

describe("CLI dispatch", () => {
  it("help exits 0 and shows sections", () => {
    const r = run("help");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("Getting Started"), "missing Getting Started section");
    assert.ok(r.out.includes("Sandbox Management"), "missing Sandbox Management section");
    assert.ok(r.out.includes("Policy Presets"), "missing Policy Presets section");
    assert.ok(r.out.includes("doctor"), "missing doctor command");
    assert.ok(r.out.includes("launch"), "missing launch command");
    assert.ok(r.out.includes("solana-agent"), "missing Solana agent action");
    assert.ok(r.out.includes("solana-bridge"), "missing Solana bridge action");
    assert.ok(r.out.includes("solana start"), "missing Solana one-shot action");
    assert.ok(r.out.includes("telegram-bot"), "missing Telegram bot action");
    assert.ok(r.out.includes("payment-app"), "missing payment app action");
  });

  it("--help exits 0", () => {
    assert.equal(run("--help").code, 0);
  });

  it("-h exits 0", () => {
    assert.equal(run("-h").code, 0);
  });

  it("no args exits 0 (shows help)", () => {
    const r = run("");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes("nemoclaw"));
  });

  it("unknown command exits 1", () => {
    const r = run("boguscmd");
    assert.equal(r.code, 1);
    assert.ok(r.out.includes("Unknown command"));
  });

  it("list exits 0", () => {
    const r = run("list");
    assert.equal(r.code, 0);
    // With empty HOME, should say no sandboxes
    assert.ok(r.out.includes("No sandboxes"));
  });

  it("version exits 0 and shows package version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    const r = run("version");
    assert.equal(r.code, 0);
    assert.ok(r.out.includes(pkg.version), "missing CLI version");
  });

  it("solana overview prefers active gateway last sandbox over first registry entry", () => {
    const home = "/tmp/nemoclaw-cli-test-" + Date.now();
    const sandboxDir = path.join(home, ".nemoclaw");
    const openshellDir = path.join(home, ".config", "openshell", "gateways", "nemoclaw");
    fs.mkdirSync(sandboxDir, { recursive: true });
    fs.mkdirSync(openshellDir, { recursive: true });
    fs.writeFileSync(
      path.join(sandboxDir, "sandboxes.json"),
      JSON.stringify({
        sandboxes: {
          "my-assistant": { name: "my-assistant", model: "old-model", provider: "ollama-local", gpuEnabled: true, policies: [] },
          "nemo": { name: "nemo", model: "8bit/DeepSolana", provider: "ollama-local", gpuEnabled: true, policies: [] },
        },
        defaultSandbox: "my-assistant",
      }),
    );
    fs.mkdirSync(path.join(home, ".config", "openshell"), { recursive: true });
    fs.writeFileSync(path.join(home, ".config", "openshell", "active_gateway"), "nemoclaw\n");
    fs.writeFileSync(path.join(openshellDir, "last_sandbox"), "nemo\n");

    const out = execSync(`node "${CLI}" solana`, {
      encoding: "utf-8",
      timeout: 10000,
      env: { ...process.env, HOME: home },
    });

    assert.ok(out.includes("Using sandbox: nemo"), out);
    assert.ok(!out.includes("Using sandbox: my-assistant"), out);
  });
});
