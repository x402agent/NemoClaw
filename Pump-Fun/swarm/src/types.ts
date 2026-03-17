// ── PumpFun Swarm — Types ──────────────────────────────────────────

// ── Bot Identity ────────────────────────────────────────────────────

export type BotId = 'telegram-bot' | 'outsiders-bot' | 'channel-bot' | 'websocket-server' | 'swarm-bot';

export type BotStatus = 'stopped' | 'starting' | 'running' | 'error' | 'stopping';

export interface BotHealth {
  status: BotStatus;
  uptime: number;           // seconds since last start
  pid: number | null;
  cpu: number;              // percentage (0-100)
  memory: number;           // bytes RSS
  restarts: number;
  lastError: string | null;
  lastErrorAt: string | null;
  lastHealthCheck: string;
  healthEndpoint: string | null;
  metrics: BotMetrics;
}

export interface BotMetrics {
  eventsProcessed: number;
  eventsEmitted: number;
  errorsTotal: number;
  lastEventAt: string | null;
  custom: Record<string, number | string>;
}

export interface BotDefinition {
  id: BotId;
  name: string;
  description: string;
  directory: string;
  startCommand: string;
  healthEndpoint: string | null;
  port: number | null;
  envFile: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
}

// ── Event Bus ───────────────────────────────────────────────────────

export type SwarmEventType =
  | 'bot:started'
  | 'bot:stopped'
  | 'bot:error'
  | 'bot:health'
  | 'bot:log'
  | 'token:launch'
  | 'token:graduation'
  | 'trade:buy'
  | 'trade:sell'
  | 'trade:whale'
  | 'fee:claim'
  | 'fee:distribution'
  | 'call:new'
  | 'call:result'
  | 'leaderboard:update'
  | 'alert:cto'
  | 'alert:whale'
  | 'system:metric';

export interface SwarmEvent<T = unknown> {
  id: string;
  type: SwarmEventType;
  source: BotId | 'orchestrator';
  timestamp: string;
  data: T;
}

// ── Bot Lifecycle Events ────────────────────────────────────────────

export interface BotStartedEvent {
  botId: BotId;
  pid: number;
}

export interface BotStoppedEvent {
  botId: BotId;
  exitCode: number | null;
  signal: string | null;
}

export interface BotErrorEvent {
  botId: BotId;
  error: string;
  fatal: boolean;
}

export interface BotLogEvent {
  botId: BotId;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

// ── Token Events ────────────────────────────────────────────────────

export interface TokenLaunchEvent {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  uri: string;
  initialBuy: number;
  signature: string;
  hasGithub: boolean;
}

export interface TokenGraduationEvent {
  mint: string;
  name: string;
  symbol: string;
  poolAddress: string;
  signature: string;
}

// ── Trade Events ────────────────────────────────────────────────────

export interface TradeEvent {
  mint: string;
  trader: string;
  type: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  pricePerToken: number;
  signature: string;
  isWhale: boolean;
}

// ── Fee Events ──────────────────────────────────────────────────────

export interface FeeClaimEvent {
  claimerWallet: string;
  mint: string;
  amount: number;
  signature: string;
}

// ── Call Events (Outsiders) ─────────────────────────────────────────

export interface CallEvent {
  callerId: number;
  callerName: string;
  tokenAddress: string;
  chain: string;
  callType: 'alpha' | 'gamble';
  entryMcap: number;
  groupId: number;
}

// ── Dashboard ───────────────────────────────────────────────────────

export interface DashboardState {
  bots: Record<BotId, BotHealth>;
  events: SwarmEvent[];
  metrics: SwarmMetrics;
  uptime: number;
  startedAt: string;
}

export interface SwarmMetrics {
  totalEvents: number;
  eventsPerMinute: number;
  totalTokenLaunches: number;
  totalTrades: number;
  totalFeeClaims: number;
  totalCalls: number;
  totalErrors: number;
  activeBots: number;
  peakMemory: number;
  eventsByType: Record<string, number>;
  eventsByBot: Record<string, number>;
}

// ── API ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ── Config ──────────────────────────────────────────────────────────

export interface SwarmConfig {
  port: number;
  wsPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckInterval: number;  // ms
  maxEventBuffer: number;
  apiKey: string | null;
  autoStartBots: BotId[];
  corsOrigins: string;
}

// ── Env Config ──────────────────────────────────────────────────────

export interface BotEnvConfig {
  botId: BotId;
  current: Record<string, string>;
  required: string[];
  optional: string[];
}

// ── Batch Operations ────────────────────────────────────────────────

export interface BatchResult {
  botId: BotId;
  success: boolean;
  message: string;
}
