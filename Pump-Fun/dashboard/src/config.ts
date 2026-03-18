/**
 * NemoClaw Dashboard Configuration
 *
 * Auto-detects sandbox services, inference provider, and wallet config.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DashboardConfig {
  port: number;
  apiKey: string;
  services: ServiceConfig[];
  processes: ProcessConfig[];
  solanaRpcUrl: string;
  walletAddress: string;
  inferenceModel: string;
  inferenceProvider: string;
  sandboxName: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  healthPath: string;
  description: string;
}

export interface ProcessConfig {
  id: string;
  name: string;
  icon: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  description: string;
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function loadConfig(): DashboardConfig {
  const home = process.env.HOME || '/sandbox';
  const nemoDir = resolve(home, '.nemoclaw');
  const solanaJson = readJson(resolve(nemoDir, 'solana.json')) as Record<string, string> | null;
  const credsJson = readJson(resolve(nemoDir, 'credentials.json')) as Record<string, string> | null;
  const registryJson = readJson(resolve(nemoDir, 'registry.json')) as Record<string, unknown> | null;

  // Detect sandbox name
  let sandboxName = process.env.SANDBOX_NAME || '';
  if (!sandboxName && registryJson) {
    const sandboxes = (registryJson as any).sandboxes;
    if (Array.isArray(sandboxes) && sandboxes.length > 0) {
      sandboxName = sandboxes[0].name || 'unknown';
    }
  }

  // Solana / wallet
  const solanaRpcUrl = process.env.SOLANA_RPC_URL
    || credsJson?.SOLANA_RPC_URL
    || solanaJson?.rpcUrl
    || 'https://api.mainnet-beta.solana.com';
  const walletAddress = process.env.DEVELOPER_WALLET
    || solanaJson?.walletAddress as string
    || solanaJson?.developerWallet as string
    || '';

  // Inference
  const inferenceModel = process.env.INFERENCE_MODEL || '8bit/DeepSolana';
  const inferenceProvider = process.env.INFERENCE_PROVIDER || 'ollama-local';

  // ── External service health checks ──
  const services: ServiceConfig[] = [];

  if (process.env.TELEGRAM_BOT_URL) {
    services.push({
      id: 'telegram-bot',
      name: 'Telegram Bot',
      url: process.env.TELEGRAM_BOT_URL,
      healthPath: '/api/v1/health',
      description: 'Pump-Fun alerts, launch tracking, whale detection',
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

  if (process.env.WEBSOCKET_SERVER_URL) {
    services.push({
      id: 'websocket-server',
      name: 'WebSocket Relay',
      url: process.env.WEBSOCKET_SERVER_URL,
      healthPath: '/health',
      description: 'Real-time token launch broadcasting',
    });
  }

  // Ollama health
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  services.push({
    id: 'ollama',
    name: 'Ollama Inference',
    url: ollamaUrl,
    healthPath: '/',
    description: `Model: ${inferenceModel}`,
  });

  // ── Managed processes (can be started/stopped from dashboard) ──
  const processes: ProcessConfig[] = [];
  const pumpFunRoot = process.env.PUMPFUN_ROOT || resolve(__dirname, '../..');
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || credsJson?.TELEGRAM_BOT_TOKEN || '';

  const sharedEnv: Record<string, string> = {};
  if (solanaRpcUrl) sharedEnv.SOLANA_RPC_URL = solanaRpcUrl;
  if (process.env.SOLANA_WS_URL || credsJson?.SOLANA_WS_URL || solanaJson?.wsUrl) {
    sharedEnv.SOLANA_WS_URL = (process.env.SOLANA_WS_URL || credsJson?.SOLANA_WS_URL || solanaJson?.wsUrl) as string;
  }
  if (telegramBotToken) sharedEnv.TELEGRAM_BOT_TOKEN = telegramBotToken;
  if (process.env.AGENT_TOKEN_MINT_ADDRESS || solanaJson?.agentTokenMint) {
    sharedEnv.AGENT_TOKEN_MINT_ADDRESS = (process.env.AGENT_TOKEN_MINT_ADDRESS || solanaJson?.agentTokenMint) as string;
  }
  if (walletAddress) sharedEnv.DEVELOPER_WALLET = walletAddress;
  if (process.env.HELIUS_API_KEY || credsJson?.HELIUS_API_KEY || solanaJson?.heliusApiKey) {
    sharedEnv.HELIUS_API_KEY = (process.env.HELIUS_API_KEY || credsJson?.HELIUS_API_KEY || solanaJson?.heliusApiKey) as string;
  }

  const telegramBotDir = resolve(pumpFunRoot, 'telegram-bot');
  if (existsSync(telegramBotDir)) {
    processes.push({
      id: 'telegram-bot',
      name: 'Telegram Bot',
      icon: '🤖',
      command: 'npx',
      args: ['tsx', 'src/index.ts'],
      cwd: telegramBotDir,
      env: sharedEnv,
      description: 'Pump-Fun Telegram monitor & alerts',
    });
  }

  const websocketDir = resolve(pumpFunRoot, 'websocket-server');
  if (existsSync(websocketDir)) {
    processes.push({
      id: 'websocket-server',
      name: 'WebSocket Relay',
      icon: '⚡',
      command: 'npx',
      args: ['tsx', 'src/server.ts'],
      cwd: websocketDir,
      env: sharedEnv,
      description: 'Real-time Pump launch relay',
    });
  }

  const agentAppDir = resolve(pumpFunRoot, 'agent-app');
  if (existsSync(agentAppDir)) {
    processes.push({
      id: 'agent-app',
      name: 'Agent App',
      icon: '🧠',
      command: 'npm',
      args: ['run', 'bot'],
      cwd: agentAppDir,
      env: sharedEnv,
      description: 'Pump-Fun tracker bot (payments, claims)',
    });
  }

  const swarmBotDir = resolve(pumpFunRoot, 'swarm-bot');
  if (existsSync(swarmBotDir)) {
    processes.push({
      id: 'swarm-bot',
      name: 'Swarm Bot',
      icon: '🐝',
      command: 'npx',
      args: ['tsx', 'src/index.ts'],
      cwd: swarmBotDir,
      env: sharedEnv,
      description: 'Multi-bot orchestration dashboard',
    });
  }

  return {
    port: Number(process.env.DASHBOARD_PORT || '18789'),
    apiKey: process.env.DASHBOARD_API_KEY || '',
    services,
    processes,
    solanaRpcUrl,
    walletAddress,
    inferenceModel,
    inferenceProvider,
    sandboxName,
  };
}
