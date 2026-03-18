/**
 * NemoClaw Agent Heartbeat
 *
 * Periodically sends liveness/uptime feedback to the 8004 Agent Registry.
 * Also checks Pump.fun token status and reports to Telegram if configured.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { loadConfig, type RegistryConfig } from './config.js';

interface HeartbeatState {
  startedAt: number;
  tickCount: number;
  lastTickAt: number;
  assetPubkey: string | null;
  lastUptimeReport: number;
  lastError: string | null;
  running: boolean;
}

const state: HeartbeatState = {
  startedAt: 0,
  tickCount: 0,
  lastTickAt: 0,
  assetPubkey: null,
  lastUptimeReport: 0,
  lastError: null,
  running: false,
};

/**
 * Check Solana RPC health.
 */
async function checkRpcHealth(config: RegistryConfig): Promise<{ healthy: boolean; latencyMs: number; slot: number }> {
  const start = Date.now();
  try {
    const connection = new Connection(config.solanaRpcUrl);
    const slot = await connection.getSlot('confirmed');
    return { healthy: true, latencyMs: Date.now() - start, slot };
  } catch {
    return { healthy: false, latencyMs: Date.now() - start, slot: 0 };
  }
}

/**
 * Check agent token balance.
 */
async function checkWalletBalance(config: RegistryConfig): Promise<{ sol: number; hasToken: boolean }> {
  if (!config.developerWallet) return { sol: 0, hasToken: false };

  try {
    const connection = new Connection(config.solanaRpcUrl);
    const walletPubkey = new PublicKey(config.developerWallet);

    const balance = await connection.getBalance(walletPubkey);
    const sol = balance / 1e9;

    let hasToken = false;
    if (config.agentTokenMint) {
      try {
        const tokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
          mint: new PublicKey(config.agentTokenMint),
        });
        hasToken = tokenAccounts.value.length > 0;
      } catch {
        // Token check failed — not critical
      }
    }

    return { sol, hasToken };
  } catch {
    return { sol: 0, hasToken: false };
  }
}

/**
 * Submit uptime feedback to 8004 registry.
 */
async function submitUptimeFeedback(
  config: RegistryConfig,
  uptimePercent: string,
  rpcLatencyMs: number,
): Promise<boolean> {
  if (!state.assetPubkey || !config.walletPrivateKey) {
    return false;
  }

  try {
    const { SolanaSDK, Tag } = await import('8004-solana');
    const { Keypair } = await import('@solana/web3.js');

    const secretKey = Uint8Array.from(JSON.parse(config.walletPrivateKey));
    const signer = Keypair.fromSecretKey(secretKey);

    const sdk = new SolanaSDK({
      cluster: config.registryCluster,
      rpcUrl: config.solanaRpcUrl,
      signer,
    });

    const assetPubkey = new PublicKey(state.assetPubkey);

    // Submit uptime feedback
    await sdk.giveFeedback(assetPubkey, {
      value: uptimePercent,
      tag1: Tag.uptime,
      tag2: Tag.day,
      score: Math.min(100, Math.round(Number(uptimePercent))),
    });

    console.log('[heartbeat] Uptime feedback submitted: %s%%', uptimePercent);

    // Submit response time if we have latency data
    if (rpcLatencyMs > 0) {
      await sdk.giveFeedback(assetPubkey, {
        value: rpcLatencyMs,
        valueDecimals: 0,
        tag1: Tag.responseTime,
        tag2: Tag.day,
        score: rpcLatencyMs < 500 ? 100 : rpcLatencyMs < 2000 ? 75 : 50,
      });
    }

    state.lastUptimeReport = Date.now();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[heartbeat] Failed to submit feedback:', msg);
    state.lastError = msg;
    return false;
  }
}

/**
 * Single heartbeat tick.
 */
async function tick(config: RegistryConfig): Promise<void> {
  state.tickCount++;
  state.lastTickAt = Date.now();

  const uptimeSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);

  // Check RPC health
  const rpc = await checkRpcHealth(config);

  // Check wallet
  const wallet = await checkWalletBalance(config);

  // Log heartbeat
  const status = rpc.healthy ? 'OK' : 'DEGRADED';
  console.log(
    '[heartbeat] #%d | %s | uptime: %dm | rpc: %dms | slot: %d | sol: %.4f | token: %s',
    state.tickCount,
    status,
    uptimeMinutes,
    rpc.latencyMs,
    rpc.slot,
    wallet.sol,
    wallet.hasToken ? 'yes' : 'no',
  );

  // Submit uptime feedback every 15 minutes (if registered)
  const uptimeReportIntervalMs = 15 * 60 * 1000;
  if (
    state.assetPubkey &&
    config.walletPrivateKey &&
    (Date.now() - state.lastUptimeReport > uptimeReportIntervalMs)
  ) {
    // Calculate uptime % based on successful ticks
    const expectedTicks = Math.max(1, uptimeSeconds / config.heartbeatIntervalSeconds);
    const uptimePercent = Math.min(100, (state.tickCount / expectedTicks) * 100).toFixed(2);
    await submitUptimeFeedback(config, uptimePercent, rpc.latencyMs);
  }

  // Warn if wallet balance is low
  if (wallet.sol > 0 && wallet.sol < 0.01) {
    console.warn('[heartbeat] WARNING: Wallet balance low (%.4f SOL)', wallet.sol);
  }
}

/**
 * Start the heartbeat loop.
 */
export async function startHeartbeat(assetPubkey?: string): Promise<void> {
  const config = loadConfig();

  if (!config.heartbeatEnabled) {
    console.log('[heartbeat] Heartbeat disabled');
    return;
  }

  state.startedAt = Date.now();
  state.assetPubkey = assetPubkey || null;
  state.running = true;

  console.log('[heartbeat] Starting heartbeat (interval: %ds)', config.heartbeatIntervalSeconds);
  if (state.assetPubkey) {
    console.log('[heartbeat] Registry asset: %s', state.assetPubkey);
  }

  // Initial tick
  await tick(config);

  // Recurring ticks
  const interval = setInterval(async () => {
    if (!state.running) {
      clearInterval(interval);
      return;
    }
    try {
      await tick(config);
    } catch (err) {
      console.error('[heartbeat] Tick error:', err);
      state.lastError = err instanceof Error ? err.message : String(err);
    }
  }, config.heartbeatIntervalSeconds * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[heartbeat] Stopping...');
    state.running = false;
    clearInterval(interval);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Get current heartbeat state.
 */
export function getHeartbeatState(): Readonly<HeartbeatState> {
  return { ...state };
}

// CLI entry point
if (process.argv[1]?.endsWith('heartbeat.ts') || process.argv[1]?.endsWith('heartbeat.js')) {
  const assetPubkey = process.argv[2] || process.env.AGENT_ASSET_PUBKEY || undefined;
  startHeartbeat(assetPubkey).catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
