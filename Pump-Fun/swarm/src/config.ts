// ── PumpFun Swarm — Configuration ──────────────────────────────────

import 'dotenv/config';
import type { BotId, SwarmConfig } from './types.js';

export function loadConfig(): SwarmConfig {
  const autoStart = process.env.SWARM_AUTO_START;
  const autoStartBots: BotId[] = autoStart
    ? (autoStart.split(',').map(s => s.trim()).filter(Boolean) as BotId[])
    : [];

  return {
    port: parseInt(process.env.SWARM_PORT || '4000', 10),
    wsPort: parseInt(process.env.SWARM_WS_PORT || '4001', 10),
    logLevel: (process.env.SWARM_LOG_LEVEL || 'info') as SwarmConfig['logLevel'],
    healthCheckInterval: parseInt(process.env.SWARM_HEALTH_INTERVAL || '10000', 10),
    maxEventBuffer: parseInt(process.env.SWARM_MAX_EVENTS || '5000', 10),
    apiKey: process.env.SWARM_API_KEY || null,
    autoStartBots,
    corsOrigins: process.env.SWARM_CORS_ORIGINS || '*',
  };
}
