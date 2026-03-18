// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { execSync, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPTS = path.join(ROOT, "scripts");

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findBinaryOnPath(name, envPath = process.env.PATH || "") {
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getDockerCliCandidates(home = process.env.HOME || "/tmp") {
  return [
    "/Applications/Docker.app/Contents/Resources/bin/docker",
    path.join(home, ".docker", "bin", "docker"),
    "/opt/homebrew/bin/docker",
    "/usr/local/bin/docker",
  ];
}

function ensureDockerCliOnPath(opts = {}) {
  const env = opts.env || process.env;
  const home = opts.home || env.HOME || "/tmp";
  const existing = findBinaryOnPath("docker", env.PATH || "");
  if (existing) {
    return existing;
  }

  const candidates = opts.candidates || getDockerCliCandidates(home);
  for (const candidate of candidates) {
    if (!isExecutable(candidate)) continue;
    const dir = path.dirname(candidate);
    env.PATH = env.PATH ? `${dir}${path.delimiter}${env.PATH}` : dir;
    return candidate;
  }

  return null;
}

function getColimaSocketCandidates(home = process.env.HOME || "/tmp") {
  return [
    path.join(home, ".colima/default/docker.sock"),
    path.join(home, ".config/colima/default/docker.sock"),
  ];
}

function probeDockerHost(host, dockerBinary = findBinaryOnPath("docker")) {
  if (!dockerBinary) {
    return false;
  }

  const result = spawnSync(dockerBinary, ["--host", host, "info"], {
    stdio: "ignore",
    env: { ...process.env, DOCKER_HOST: host },
  });

  return result.status === 0;
}

function resolveColimaDockerHost(opts = {}) {
  const env = opts.env || process.env;
  if (env.DOCKER_HOST) {
    return env.DOCKER_HOST;
  }

  const home = opts.home || env.HOME || "/tmp";
  const dockerBinary = opts.dockerBinary || findBinaryOnPath("docker", env.PATH || "");
  const probe = opts.probe || ((host) => probeDockerHost(host, dockerBinary));
  const candidates = opts.sockets || getColimaSocketCandidates(home);

  for (const sock of candidates) {
    if (!fs.existsSync(sock)) continue;
    const host = `unix://${sock}`;
    if (probe(host)) {
      return host;
    }
  }

  return null;
}

const dockerBinary = ensureDockerCliOnPath();
if (!process.env.DOCKER_HOST) {
  const colimaHost = resolveColimaDockerHost({ dockerBinary });
  if (colimaHost) {
    process.env.DOCKER_HOST = colimaHost;
  }
}

function run(cmd, opts = {}) {
  const result = spawnSync("bash", ["-c", cmd], {
    stdio: "inherit",
    cwd: ROOT,
    env: { ...process.env, ...opts.env },
    ...opts,
  });
  if (result.status !== 0 && !opts.ignoreError) {
    console.error(`  Command failed (exit ${result.status}): ${cmd.slice(0, 80)}`);
    process.exit(result.status || 1);
  }
  return result;
}

function runCapture(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      cwd: ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch (err) {
    if (opts.ignoreError) return "";
    throw err;
  }
}

module.exports = {
  ROOT,
  SCRIPTS,
  run,
  runCapture,
  ensureDockerCliOnPath,
  findBinaryOnPath,
  getColimaSocketCandidates,
  getDockerCliCandidates,
  probeDockerHost,
  resolveColimaDockerHost,
};
