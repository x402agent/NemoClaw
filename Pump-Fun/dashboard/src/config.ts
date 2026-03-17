/**
 * Dashboard Configuration
 */
import 'dotenv/config';

export interface DashboardConfig {
  port: number;
  apiKey: string;
  services: ServiceConfig[];
  solanaRpcUrl: string;
  solanaRpcUrls: string[];
}

export interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  healthPath: string;
  description: string;
}

export function loadConfig(): DashboardConfig {
  const services: ServiceConfig[] = [];

  if (process.env.TELEGRAM_BOT_URL) {
    services.push({
      id: 'telegram-bot',
      name: 'Telegram Bot',
      url: process.env.TELEGRAM_BOT_URL,
      healthPath: '/api/v1/health',
      description: 'Fee claim monitor, CTO alerts, whale trades, graduations',
    });
  }

  if (process.env.CHANNEL_BOT_URL) {
    services.push({
      id: 'channel-bot',
      name: 'Channel Bot',
      url: process.env.CHANNEL_BOT_URL,
      healthPath: '/health',
      description: 'PumpFun channel feed with AI summaries',
    });
  }

  if (process.env.OUTSIDERS_BOT_URL) {
    services.push({
      id: 'outsiders-bot',
      name: 'Outsiders Bot',
      url: process.env.OUTSIDERS_BOT_URL,
      healthPath: '/health',
      description: 'Token call leaderboards, ATH tracking, PNL cards',
    });
  }

  if (process.env.WEBSOCKET_SERVER_URL) {
    services.push({
      id: 'websocket-server',
      name: 'WebSocket Relay',
      url: process.env.WEBSOCKET_SERVER_URL,
      healthPath: '/health',
      description: 'Real-time token launch broadcasting',
    });
  }

  const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const solanaRpcUrls = process.env.SOLANA_RPC_URLS
    ? process.env.SOLANA_RPC_URLS.split(',').map((s) => s.trim()).filter(Boolean)
    : [solanaRpcUrl];

  return {
    port: Number(process.env.DASHBOARD_PORT || '8080'),
    apiKey: process.env.DASHBOARD_API_KEY || '',
    services,
    solanaRpcUrl,
    solanaRpcUrls,
  };
}
