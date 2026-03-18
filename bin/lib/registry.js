// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Multi-sandbox registry at ~/.nemoclaw/sandboxes.json

const fs = require("fs");
const path = require("path");

const REGISTRY_FILE = path.join(process.env.HOME || "/tmp", ".nemoclaw", "sandboxes.json");
const OPENSHELL_CONFIG_DIR = path.join(process.env.HOME || "/tmp", ".config", "openshell");

function readTextFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const value = fs.readFileSync(filePath, "utf-8").trim();
      return value || null;
    }
  } catch {}
  return null;
}

function load() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
    }
  } catch {}
  return { sandboxes: {}, defaultSandbox: null };
}

function save(data) {
  const dir = path.dirname(REGISTRY_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function getSandbox(name) {
  const data = load();
  return data.sandboxes[name] || null;
}

function getDefault() {
  const data = load();
  if (data.defaultSandbox && data.sandboxes[data.defaultSandbox]) {
    return data.defaultSandbox;
  }
  // Fall back to first sandbox if default is missing
  const names = Object.keys(data.sandboxes);
  return names.length > 0 ? names[0] : null;
}

function getActiveGateway() {
  return readTextFile(path.join(OPENSHELL_CONFIG_DIR, "active_gateway"));
}

function getGatewayLastSandbox(gatewayName) {
  if (!gatewayName) return null;
  return readTextFile(path.join(OPENSHELL_CONFIG_DIR, "gateways", gatewayName, "last_sandbox"));
}

function getPreferredDefault() {
  const data = load();
  const gatewayName = getActiveGateway();
  const lastSandbox = getGatewayLastSandbox(gatewayName);
  if (lastSandbox && data.sandboxes[lastSandbox]) {
    return lastSandbox;
  }
  if (data.defaultSandbox && data.sandboxes[data.defaultSandbox]) {
    return data.defaultSandbox;
  }
  const names = Object.keys(data.sandboxes);
  return names.length > 0 ? names[0] : null;
}

function registerSandbox(entry) {
  const data = load();
  data.sandboxes[entry.name] = {
    name: entry.name,
    createdAt: entry.createdAt || new Date().toISOString(),
    model: entry.model || null,
    nimContainer: entry.nimContainer || null,
    provider: entry.provider || null,
    gpuEnabled: entry.gpuEnabled || false,
    policies: entry.policies || [],
  };
  if (!data.defaultSandbox) {
    data.defaultSandbox = entry.name;
  }
  save(data);
}

function updateSandbox(name, updates) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  Object.assign(data.sandboxes[name], updates);
  save(data);
  return true;
}

function removeSandbox(name) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  delete data.sandboxes[name];
  if (data.defaultSandbox === name) {
    const remaining = Object.keys(data.sandboxes);
    data.defaultSandbox = remaining.length > 0 ? remaining[0] : null;
  }
  save(data);
  return true;
}

function listSandboxes() {
  const data = load();
  return {
    sandboxes: Object.values(data.sandboxes),
    defaultSandbox: data.defaultSandbox,
  };
}

function setDefault(name) {
  const data = load();
  if (!data.sandboxes[name]) return false;
  data.defaultSandbox = name;
  save(data);
  return true;
}

module.exports = {
  load,
  save,
  getSandbox,
  getDefault,
  getPreferredDefault,
  getActiveGateway,
  getGatewayLastSandbox,
  registerSandbox,
  updateSandbox,
  removeSandbox,
  listSandboxes,
  setDefault,
};
