/**
 * PumpKit Bridge — integrates @pumpkit/core monitor patterns into the swarm-bot.
 *
 * Instead of depending on the PumpKit Turborepo build, we implement the same
 * proven patterns (WebSocket-first + HTTP-polling fallback) from PumpKit's
 * LaunchMonitor, GraduationMonitor, and WhaleMonitor directly.
 *
 * This module provides on-chain event detection for:
 *  - New token launches (createV2 instructions)
 *  - Token graduations (CompleteEvent discriminator)
 *  - Whale trades (large buy/sell above configurable SOL threshold)
 *
 * Events are emitted via EventEmitter and consumed by the BotManager
 * to feed mints into strategy evaluation loops.
 */

import { Connection, PublicKey, type Logs } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

// ── Program IDs ─────────────────────────────────────────────────────────────
// Adapted from @pumpkit/core/src/solana/programs.ts

const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

// System programs to exclude when finding mint addresses
const SYSTEM_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  'SysvarRent111111111111111111111111111111111',
  'SysvarC1ock11111111111111111111111111111111',
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  'ComputeBudget111111111111111111111111111111',
]);

// ── Types ───────────────────────────────────────────────────────────────────

export interface PumpKitLaunchEvent {
  signature: string;
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  isMayhemMode: boolean;
  timestamp: number;
}

export interface PumpKitGraduationEvent {
  signature: string;
  mint: string;
  timestamp: number;
}

export interface PumpKitWhaleTradeEvent {
  signature: string;
  mint: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface PumpKitBridgeConfig {
  connection: Connection;
  /** Enable launch detection (default: true) */
  enableLaunchMonitor?: boolean;
  /** Enable graduation detection (default: true) */
  enableGraduationMonitor?: boolean;
  /** Enable whale trade detection (default: false) */
  enableWhaleMonitor?: boolean;
  /** Minimum SOL for whale threshold (default: 10) */
  whaleThresholdSol?: number;
  /** Polling interval in ms for HTTP fallback (default: 5000) */
  pollIntervalMs?: number;
}

// ── PumpKit Bridge ──────────────────────────────────────────────────────────

const MAX_SEEN_CACHE = 10_000;
const TRIM_AMOUNT = 5_000;
const WS_HEARTBEAT_INTERVAL_MS = 60_000;
const WS_HEARTBEAT_TIMEOUT_MS = 90_000;

/**
 * PumpKitBridge — unified on-chain event monitor.
 *
 * Emits:
 *  - 'launch' (PumpKitLaunchEvent)       — new token detected
 *  - 'graduation' (PumpKitGraduationEvent) — token bonding curve completed
 *  - 'whaleTrade' (PumpKitWhaleTradeEvent) — large trade detected
 *
 * Architecture follows @pumpkit/core's proven patterns:
 *  1. WebSocket subscription to Pump program logs
 *  2. Parse log lines for instruction discriminators
 *  3. Heartbeat monitor → automatic reconnection
 *  4. HTTP polling fallback when WS is unreliable
 */
export class PumpKitBridge extends EventEmitter {
  private readonly connection: Connection;
  private readonly config: Required<PumpKitBridgeConfig>;
  private readonly programPubkey = new PublicKey(PUMP_PROGRAM_ID);

  private running = false;
  private subscriptionId: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWsEventTime = 0;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;
  private readonly seen = new Set<string>();
  private lastSignature: string | undefined;

  // Stats
  private launchCount = 0;
  private graduationCount = 0;
  private whaleTradeCount = 0;

  constructor(config: PumpKitBridgeConfig) {
    super();
    this.connection = config.connection;
    this.config = {
      connection: config.connection,
      enableLaunchMonitor: config.enableLaunchMonitor ?? true,
      enableGraduationMonitor: config.enableGraduationMonitor ?? true,
      enableWhaleMonitor: config.enableWhaleMonitor ?? false,
      whaleThresholdSol: config.whaleThresholdSol ?? 10,
      pollIntervalMs: config.pollIntervalMs ?? 5000,
    };
  }

  /** Start the WebSocket monitor */
  start(): void {
    if (this.running) return;
    this.running = true;

    logger.info('PumpKit bridge starting — monitors: launch=%s grad=%s whale=%s',
      this.config.enableLaunchMonitor, this.config.enableGraduationMonitor, this.config.enableWhaleMonitor);

    try {
      this.subscribe();
    } catch {
      logger.warn('PumpKit: WebSocket failed on start, falling back to polling');
      this.startPolling();
    }
  }

  /** Stop the monitor */
  stop(): void {
    this.running = false;
    this.cleanupWebSocket();
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('PumpKit bridge stopped — launches=%d grads=%d whales=%d',
      this.launchCount, this.graduationCount, this.whaleTradeCount);
  }

  /** Get statistics */
  getStats(): { launches: number; graduations: number; whaleTrades: number; running: boolean } {
    return {
      launches: this.launchCount,
      graduations: this.graduationCount,
      whaleTrades: this.whaleTradeCount,
      running: this.running,
    };
  }

  // ── WebSocket ──────────────────────────────────────────────────────

  private subscribe(): void {
    this.lastWsEventTime = Date.now();

    try {
      this.subscriptionId = this.connection.onLogs(
        this.programPubkey,
        (logInfo: Logs) => {
          this.lastWsEventTime = Date.now();
          this.handleLogEvent(logInfo);
        },
        'confirmed',
      );
    } catch (err) {
      logger.warn('PumpKit: WebSocket subscription failed: %s', err);
      this.startPolling();
      return;
    }

    // Heartbeat: detect silent WebSocket and reconnect
    this.heartbeatTimer = setInterval(() => {
      if (!this.running) return;
      const elapsed = Date.now() - this.lastWsEventTime;
      if (elapsed > WS_HEARTBEAT_TIMEOUT_MS) {
        logger.warn('PumpKit: WS silent for %ds — reconnecting', Math.floor(elapsed / 1000));
        this.reconnectWebSocket();
      }
    }, WS_HEARTBEAT_INTERVAL_MS);

    this.reconnectDelay = 1000;
    logger.info('PumpKit: WebSocket subscription active');
  }

  private cleanupWebSocket(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.subscriptionId !== null) {
      this.connection.removeOnLogsListener(this.subscriptionId).catch(() => {});
      this.subscriptionId = null;
    }
  }

  private reconnectWebSocket(): void {
    if (!this.running) return;
    this.cleanupWebSocket();
    try {
      this.subscribe();
    } catch {
      logger.warn('PumpKit: WS reconnect failed, falling back to polling');
      this.startPolling();
    }
  }

  // ── Event Processing ──────────────────────────────────────────────

  private handleLogEvent(logInfo: Logs): void {
    const { signature, logs, err } = logInfo;
    if (err) return;
    if (this.seen.has(signature)) return;
    this.seen.add(signature);
    this.trimSeen();

    // Classify the event based on log lines
    if (this.config.enableLaunchMonitor && this.isCreateInstruction(logs)) {
      this.emitLaunch(signature, logs);
    }

    if (this.config.enableGraduationMonitor && this.isGraduationEvent(logs)) {
      this.emitGraduation(signature);
    }

    if (this.config.enableWhaleMonitor && this.isTradeEvent(logs)) {
      this.emitWhaleTrade(signature, logs);
    }
  }

  // ── Event Classification (from @pumpkit/core patterns) ────────────

  /**
   * Check if logs indicate a create instruction.
   * Matches "Instruction: Create" and "Instruction: CreateV2" but
   * rejects false positives like "CreatePool" or "CreateIdempotent".
   */
  private isCreateInstruction(logs: string[]): boolean {
    for (const line of logs) {
      if (
        line.includes('Instruction: CreateV2') ||
        (line.includes('Instruction: Create') &&
          !line.includes('CreatePool') &&
          !line.includes('CreateIdempotent'))
      ) {
        return true;
      }
    }
    return false;
  }

  /** Check if logs indicate a graduation (CompleteEvent) */
  private isGraduationEvent(logs: string[]): boolean {
    return logs.some(
      (l) => l.includes('CompleteEvent') || l.includes('Program log: complete'),
    );
  }

  /** Check if logs indicate a trade event */
  private isTradeEvent(logs: string[]): boolean {
    return logs.some(
      (l) => l.includes('TradeEvent') || l.includes('Instruction: Buy') || l.includes('Instruction: Sell'),
    );
  }

  // ── Event Emission ────────────────────────────────────────────────

  private emitLaunch(signature: string, logs: string[]): void {
    const isMayhem = logs.some((l) => l.includes('MayhemMode') || l.includes('mayhemMode'));

    const event: PumpKitLaunchEvent = {
      signature,
      mint: '',
      creator: '',
      name: '',
      symbol: '',
      isMayhemMode: isMayhem,
      timestamp: Date.now(),
    };

    this.launchCount++;
    this.reconnectDelay = 1000;
    this.emit('launch', event);
  }

  private emitGraduation(signature: string): void {
    const event: PumpKitGraduationEvent = {
      signature,
      mint: '',
      timestamp: Date.now(),
    };

    this.graduationCount++;
    this.reconnectDelay = 1000;
    this.emit('graduation', event);
  }

  private emitWhaleTrade(signature: string, logs: string[]): void {
    const side = logs.some((l) => l.includes('Instruction: Buy')) ? 'buy' as const : 'sell' as const;

    const event: PumpKitWhaleTradeEvent = {
      signature,
      mint: '',
      side,
      timestamp: Date.now(),
    };

    this.whaleTradeCount++;
    this.reconnectDelay = 1000;
    this.emit('whaleTrade', event);
  }

  // ── Polling Fallback ──────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    const poll = async () => {
      if (!this.running) return;
      try {
        await this.pollForEvents();
      } catch (err) {
        logger.debug('PumpKit: Poll error: %s', err instanceof Error ? err.message : err);
      }
      if (this.running) {
        this.pollTimer = setTimeout(poll, this.config.pollIntervalMs);
      }
    };
    poll();
    logger.info('PumpKit: HTTP polling active (interval: %dms)', this.config.pollIntervalMs);
  }

  private async pollForEvents(): Promise<void> {
    const sigs = await this.connection.getSignaturesForAddress(
      this.programPubkey,
      { limit: 25, until: this.lastSignature },
      'confirmed',
    );
    if (sigs.length === 0) return;

    const ordered = sigs.reverse();
    this.lastSignature = sigs[0]!.signature;

    for (const info of ordered) {
      if (info.err) continue;
      if (this.seen.has(info.signature)) continue;
      this.seen.add(info.signature);

      try {
        const tx = await this.connection.getParsedTransaction(info.signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta?.logMessages) continue;

        // Process using same classification logic
        const logs = tx.meta.logMessages;

        if (this.config.enableLaunchMonitor && this.isCreateInstruction(logs)) {
          // Extract mint from account keys
          const accountKeys = tx.transaction.message.accountKeys.map((k) =>
            typeof k === 'string' ? k : k.pubkey.toBase58(),
          );
          const mint = this.findMintAddress(accountKeys);

          const event: PumpKitLaunchEvent = {
            signature: info.signature,
            mint,
            creator: accountKeys[0] ?? '',
            name: '',
            symbol: '',
            isMayhemMode: logs.some((l) => l.includes('MayhemMode')),
            timestamp: tx.blockTime ?? Math.floor(Date.now() / 1000),
          };
          this.launchCount++;
          this.emit('launch', event);
        }

        if (this.config.enableGraduationMonitor && this.isGraduationEvent(logs)) {
          this.emitGraduation(info.signature);
        }

        if (this.config.enableWhaleMonitor && this.isTradeEvent(logs)) {
          this.emitWhaleTrade(info.signature, logs);
        }
      } catch (err) {
        logger.debug('PumpKit: TX fetch failed for %s: %s', info.signature.slice(0, 8), err);
      }
    }
    this.trimSeen();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Find the mint address from transaction account keys.
   * Excludes well-known system programs and the Pump program itself.
   */
  private findMintAddress(accountKeys: string[]): string {
    for (let i = 1; i < Math.min(accountKeys.length, 5); i++) {
      const key = accountKeys[i];
      if (key && !SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
        return key;
      }
    }
    for (let i = 5; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      if (key && !SYSTEM_PROGRAMS.has(key) && key.length >= 32) {
        return key;
      }
    }
    return '';
  }

  private trimSeen(): void {
    if (this.seen.size > MAX_SEEN_CACHE) {
      const entries = [...this.seen];
      for (let i = 0; i < TRIM_AMOUNT; i++) {
        this.seen.delete(entries[i]!);
      }
    }
  }
}
