/**
 * Lair-TG — Entry Point
 *
 * Unified Telegram bot platform for DeFi intelligence.
 *
 * Modules:
 *   - Market data: token lookups from DexScreener and other sources
 *   - Wallet:      balance checks via Solana RPC
 *   - Alerts:      price alerts with polling
 *   - AI:          DeFi agents via OpenRouter (Grok, Claude, etc.)
 *   - Launch:      token deployment via bonding curves (planned)
 *
 * Run:
 *   npm run dev          (hot reload)
 *   npm run build && npm start  (production)
 */

import { loadConfig } from './config.js';
import { setLogLevel, log } from './logger.js';
import { createBot, type BotServices } from './bot.js';
import { startHealthServer, stopHealthServer } from './health.js';
import { DataAggregator } from './data-sources.js';
import { WalletService } from './wallet.js';
import { AlertManager } from './alerts.js';
import { DefiAgentRegistry } from './defi-agents.js';

async function main(): Promise<void> {
  const config = loadConfig();
  setLogLevel(config.logLevel);

  log.info('──────────────────────────────────────');
  log.info('  Lair-TG starting…');
  log.info('──────────────────────────────────────');
  log.info('  RPC: %s', config.solanaRpcUrl.replace(/\/[^/]*$/, '/***'));
  log.info('  Modules: %s', Object.entries(config.modules)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', '));
  if (config.openrouterApiKey) {
    log.info('  AI Model: %s', config.openrouterModel);
  }

  // Initialize services
  const aggregator = new DataAggregator();

  const walletService = config.modules.wallet
    ? new WalletService(config.solanaRpcUrl)
    : null;

  const alertManager = config.modules.alerts
    ? new AlertManager(aggregator)
    : null;

  const agentRegistry = config.modules.ai && config.openrouterApiKey
    ? new DefiAgentRegistry(config.defiAgentsUrl)
    : null;

  // Pre-load agents
  if (agentRegistry) {
    await agentRegistry.loadAgents();
    log.info('  DeFi Agents: %d loaded', agentRegistry.count);
  }

  const services: BotServices = {
    aggregator,
    wallet: walletService,
    alerts: alertManager,
    agentRegistry,
  };

  const bot = createBot(config, services);

  bot.catch((err) => {
    log.error('Bot error: %s', err.message);
  });

  // Start alert polling
  if (alertManager) {
    alertManager.start();
  }

  // Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down…');
    alertManager?.stop();
    stopHealthServer();
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Health server
  const startedAt = Date.now();
  startHealthServer({
    serviceName: 'lair-tg',
    startedAt,
    port: config.healthPort,
    getStats: () => ({
      modules: config.modules,
      aiModel: config.openrouterApiKey ? config.openrouterModel : null,
      agentsLoaded: agentRegistry?.count ?? 0,
    }),
  });

  // Start polling
  await bot.start({
    onStart: () => log.info('Lair is running! Listening for messages…'),
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
