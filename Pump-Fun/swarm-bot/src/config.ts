import 'dotenv/config';

export interface SwarmConfig {
  /** Solana RPC HTTP endpoint */
  rpcUrl: string;
  /** Solana RPC WebSocket endpoint */
  wsUrl: string;
  /** Dashboard HTTP+WS port */
  port: number;
  /** Path to SQLite database file */
  dbPath: string;
  /** Default slippage tolerance in basis points (e.g. 500 = 5%) */
  defaultSlippageBps: number;
  /** Maximum SOL a single bot can hold in positions */
  maxPositionSolPerBot: number;
  /** Global maximum SOL across all bots */
  maxTotalPositionSol: number;
  /** How often bots poll for price updates (ms) */
  pollIntervalMs: number;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): SwarmConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  let wsUrl = process.env.SOLANA_WS_URL || '';
  if (!wsUrl) {
    wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  return {
    rpcUrl,
    wsUrl,
    port: parseInt(process.env.PORT || '3100', 10),
    dbPath: process.env.DB_PATH || './data/swarm.db',
    defaultSlippageBps: parseInt(process.env.DEFAULT_SLIPPAGE_BPS || '500', 10),
    maxPositionSolPerBot: parseFloat(process.env.MAX_POSITION_SOL_PER_BOT || '5'),
    maxTotalPositionSol: parseFloat(process.env.MAX_TOTAL_POSITION_SOL || '50'),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
    logLevel: (process.env.LOG_LEVEL || 'info') as SwarmConfig['logLevel'],
  };
}
