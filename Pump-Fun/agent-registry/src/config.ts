/**
 * NemoClaw Agent Registry — Configuration
 *
 * Reads from env vars and ~/.nemoclaw/ credential files.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RegistryConfig {
  // Solana
  solanaRpcUrl: string;
  solanaWsUrl: string;
  cluster: 'mainnet-beta' | 'devnet';

  // Agent identity
  agentTokenMint: string;
  developerWallet: string;
  walletPrivateKey: string | null;

  // 8004 registry
  registryCluster: 'mainnet-beta' | 'devnet';
  ipfsPinataJwt: string | null;

  // Heartbeat
  heartbeatIntervalSeconds: number;
  heartbeatEnabled: boolean;

  // Agent metadata
  agentName: string;
  agentDescription: string;
  agentVersion: string;

  // Pump.fun
  pumpfunRegistration: boolean;
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getCredential(key: string, creds: Record<string, unknown> | null): string {
  return (process.env[key] || (creds && creds[key] as string) || '') as string;
}

export function loadConfig(): RegistryConfig {
  const home = process.env.HOME || '/sandbox';
  const nemoDir = resolve(home, '.nemoclaw');
  const credsJson = readJson(resolve(nemoDir, 'credentials.json')) as Record<string, string> | null;
  const solanaJson = readJson(resolve(nemoDir, 'solana.json')) as Record<string, string> | null;

  const solanaRpcUrl = getCredential('SOLANA_RPC_URL', credsJson)
    || solanaJson?.rpcUrl
    || 'https://api.mainnet-beta.solana.com';

  const solanaWsUrl = getCredential('SOLANA_WS_URL', credsJson)
    || solanaJson?.wsUrl
    || '';

  const cluster = (process.env.SOLANA_CLUSTER || 'mainnet-beta') as 'mainnet-beta' | 'devnet';

  return {
    solanaRpcUrl,
    solanaWsUrl,
    cluster,

    agentTokenMint: getCredential('AGENT_TOKEN_MINT_ADDRESS', credsJson)
      || solanaJson?.agentTokenMint as string || '',
    developerWallet: getCredential('DEVELOPER_WALLET', credsJson)
      || solanaJson?.walletAddress as string
      || solanaJson?.developerWallet as string || '',
    walletPrivateKey: getCredential('SOLANA_PRIVATE_KEY', credsJson) || null,

    registryCluster: (process.env.REGISTRY_CLUSTER || cluster) as 'mainnet-beta' | 'devnet',
    ipfsPinataJwt: getCredential('PINATA_JWT', credsJson) || null,

    heartbeatIntervalSeconds: Number(process.env.HEARTBEAT_INTERVAL_SECONDS || '60'),
    heartbeatEnabled: process.env.HEARTBEAT_ENABLED !== 'false',

    agentName: process.env.AGENT_NAME || 'NemoClaw',
    agentDescription: process.env.AGENT_DESCRIPTION
      || 'Autonomous Solana Trading Agent — Sandboxed, Wallet-Enabled, Telegram-Native',
    agentVersion: process.env.AGENT_VERSION || '0.4.0',

    pumpfunRegistration: process.env.PUMPFUN_REGISTRATION !== 'false',
  };
}
