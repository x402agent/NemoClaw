import { Connection } from '@solana/web3.js';
import { loadConfig } from './config.js';
import { logger, setLogLevel } from './logger.js';
import { SwarmDb } from './store/db.js';
import { BotManager } from './engine/bot-manager.js';
import { TokenFeed } from './market/token-feed.js';
import { PriceFeed } from './market/price-feed.js';
import { PumpKitBridge } from './market/pumpkit-bridge.js';
import { ApiServer } from './api/server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel as 'debug' | 'info' | 'warn' | 'error');

  logger.info('═══════════════════════════════════════════');
  logger.info('  PumpFun Swarm Bot + PumpKit — Starting');
  logger.info('═══════════════════════════════════════════');
  logger.info(`RPC:      ${config.rpcUrl.slice(0, 30)}…`);
  logger.info(`Port:     ${config.port}`);
  logger.info(`DB:       ${config.dbPath}`);
  logger.info(`Slippage: ${config.defaultSlippageBps} bps`);
  logger.info(`Max/bot:  ${config.maxPositionSolPerBot} SOL`);
  logger.info(`Max/total:${config.maxTotalPositionSol} SOL`);

  // ── Initialize core components ─────────────────────────────────────────────

  // 1. Solana RPC connection
  const connection = new Connection(config.rpcUrl, 'confirmed');

  // Validate connection
  try {
    const slot = await connection.getSlot();
    logger.info(`Connected to Solana (slot: ${slot})`);
  } catch (err) {
    logger.error(`Failed to connect to Solana RPC: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // 2. Database
  const db = new SwarmDb(config.dbPath);
  logger.info('Database initialized');

  // 3. Bot Manager
  const botManager = new BotManager(db, connection);
  logger.info('Bot manager ready');

  // 4. Token Feed — detects new token launches (HTTP polling fallback)
  const tokenFeed = new TokenFeed({
    pollIntervalMs: config.pollIntervalMs,
  });

  // 5. Price Feed — polls bonding curves for tracked mints
  const priceFeed = new PriceFeed({
    connection,
    pollIntervalMs: config.pollIntervalMs,
  });

  // 6. PumpKit Bridge — on-chain event detection (WebSocket + fallback)
  //    Provides real-time launch, graduation, and whale trade detection
  //    using proven patterns from @pumpkit/core monitors
  const pumpKitBridge = new PumpKitBridge({
    connection,
    enableLaunchMonitor: true,
    enableGraduationMonitor: true,
    enableWhaleMonitor: process.env.ENABLE_WHALE_MONITOR === 'true',
    whaleThresholdSol: parseFloat(process.env.WHALE_THRESHOLD_SOL || '10'),
    pollIntervalMs: config.pollIntervalMs,
  });

  // ── Wire feeds to bot manager ──────────────────────────────────────────────

  // Token Feed: HTTP API polling for new token metadata
  tokenFeed.on('token', (launch) => {
    botManager.onNewToken(launch.mint, {
      name: launch.name,
      symbol: launch.symbol,
    });
    priceFeed.track(launch.mint);
  });

  // PumpKit Bridge: WebSocket-first on-chain launch detection
  // This fires faster than the HTTP feed since it monitors Solana logs directly
  pumpKitBridge.on('launch', (event) => {
    if (event.mint) {
      botManager.onNewToken(event.mint, {
        name: event.name,
        symbol: event.symbol,
      });
      priceFeed.track(event.mint);
    }
    logger.debug(`PumpKit: New launch detected via WS — ${event.mint ? event.mint.slice(0, 8) + '…' : 'sig=' + event.signature.slice(0, 8) + '…'}`);
  });

  // PumpKit Bridge: Graduation events — tokens moving from bonding curve to AMM
  pumpKitBridge.on('graduation', (event) => {
    logger.info(`PumpKit: Graduation detected — ${event.mint ? event.mint.slice(0, 8) + '…' : 'sig=' + event.signature.slice(0, 8) + '…'}`);
  });

  // PumpKit Bridge: Whale trade alerts
  pumpKitBridge.on('whaleTrade', (event) => {
    logger.info(`PumpKit: Whale ${event.side} detected — ${event.mint ? event.mint.slice(0, 8) + '…' : 'sig=' + event.signature.slice(0, 8) + '…'}`);
  });

  // Price Feed: graduation tracking
  priceFeed.on('graduation', ({ mint }) => {
    logger.info(`Token ${mint.slice(0, 8)}… graduated to AMM`);
  });

  // ── Start API server ───────────────────────────────────────────────────────

  const apiServer = new ApiServer({
    port: config.port,
    botManager,
    tokenFeed,
    priceFeed,
  });

  await apiServer.start();

  // ── Start feeds ────────────────────────────────────────────────────────────

  tokenFeed.start();
  priceFeed.start();
  pumpKitBridge.start();

  logger.info('═══════════════════════════════════════════');
  logger.info('  All systems operational');
  logger.info(`  Dashboard: http://localhost:${config.port}`);
  logger.info('  PumpKit: on-chain monitors active');
  logger.info('═══════════════════════════════════════════');

  // ── Graceful shutdown ──────────────────────────────────────────────────────

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`\n${signal} received — shutting down gracefully…`);

    // 1. Stop all bots
    botManager.stopAll();
    logger.info('All bots stopped');

    // 2. Stop feeds
    tokenFeed.stop();
    priceFeed.stop();
    pumpKitBridge.stop();
    logger.info('Feeds stopped (PumpKit stats: %o)', pumpKitBridge.getStats());

    // 3. Stop API server
    await apiServer.stop();
    logger.info('API server stopped');

    // 4. Close database
    db.close();
    logger.info('Database closed');

    logger.info('Shutdown complete');
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Keep process alive
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    logger.error(err.stack ?? '');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}

main().catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
