/**
 * NemoClaw Agent Registry — Main Entry Point
 *
 * Runs registration at startup, then enters heartbeat loop.
 * Designed to be started as a background service in the solana-stack.
 */
import { registerAgent } from './register.js';
import { startHeartbeat } from './heartbeat.js';

async function main(): Promise<void> {
  console.log('');
  console.log('  ╔════════════════════════════════════════════════╗');
  console.log('  ║  🦀 NemoClaw Agent Registry + Heartbeat        ║');
  console.log('  ╚════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Register agent (idempotent)
  const result = await registerAgent();

  // Step 2: Start heartbeat loop
  await startHeartbeat(result.assetPubkey ?? undefined);

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
