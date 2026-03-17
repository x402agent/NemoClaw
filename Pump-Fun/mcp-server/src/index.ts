#!/usr/bin/env node

import { SolanaWalletMCPServer } from "./server.js";

async function main(): Promise<void> {
  const server = new SolanaWalletMCPServer();

  try {
    await server.start();
  } catch (err) {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
  }
}

main();
