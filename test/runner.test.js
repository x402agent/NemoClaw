// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  ensureDockerCliOnPath,
  findBinaryOnPath,
  resolveColimaDockerHost,
} = require("../bin/lib/runner");

function makeExecutable(filePath) {
  fs.writeFileSync(filePath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

describe("findBinaryOnPath", () => {
  it("finds an executable in PATH", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-runner-path-"));
    const dockerPath = path.join(dir, "docker");
    makeExecutable(dockerPath);

    assert.equal(findBinaryOnPath("docker", dir), dockerPath);
  });
});

describe("ensureDockerCliOnPath", () => {
  it("prepends a discovered Docker CLI directory when PATH is missing docker", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-runner-docker-"));
    const dockerPath = path.join(dir, "docker");
    const env = { PATH: "/usr/bin", HOME: dir };
    makeExecutable(dockerPath);

    const resolved = ensureDockerCliOnPath({
      env,
      candidates: [dockerPath],
    });

    assert.equal(resolved, dockerPath);
    assert.equal(env.PATH.split(path.delimiter)[0], dir);
  });
});

describe("resolveColimaDockerHost", () => {
  it("ignores stale Colima sockets that fail probing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-runner-colima-"));
    const sock = path.join(dir, "docker.sock");
    fs.writeFileSync(sock, "");

    const host = resolveColimaDockerHost({
      env: { HOME: dir, PATH: "" },
      sockets: [sock],
      probe: () => false,
    });

    assert.equal(host, null);
  });

  it("uses a Colima socket only when probing succeeds", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-runner-colima-"));
    const sock = path.join(dir, "docker.sock");
    fs.writeFileSync(sock, "");

    const host = resolveColimaDockerHost({
      env: { HOME: dir, PATH: "" },
      sockets: [sock],
      probe: () => true,
    });

    assert.equal(host, `unix://${sock}`);
  });
});
