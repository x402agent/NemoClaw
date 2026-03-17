/**
 * @pumpkit/core — Pump Protocol Log Decoders
 *
 * Decodes raw Solana program log lines ("Program data: ...") into typed
 * PumpKit events. Uses Borsh binary parsing with discriminator matching,
 * extracted from proven telegram-bot and channel-bot implementations.
 *
 * Usage:
 *   const events = decodePumpLogs(logLines);
 *   for (const { type, event } of events) {
 *     if (type === 'launch') handleLaunch(event);
 *   }
 */

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import type {
  LaunchEvent,
  GraduationEvent,
  WhaleTradeEvent,
  FeeDistEvent,
  PumpEventType,
} from '../types/events.js';
import {
  CREATE_V2_DISCRIMINATOR,
  CREATE_DISCRIMINATOR,
  COMPLETE_EVENT_DISCRIMINATOR,
  COMPLETE_AMM_MIGRATION_DISCRIMINATOR,
  TRADE_EVENT_DISCRIMINATOR,
  DISTRIBUTE_FEES_EVENT_DISCRIMINATOR,
  DEFAULT_TOKEN_TOTAL_SUPPLY,
  DEFAULT_GRADUATION_SOL_THRESHOLD,
} from './programs.js';

// ── Public Types ─────────────────────────────────────────────────────

/** A decoded event with its type discriminator */
export type DecodedPumpEvent =
  | { type: 'launch'; event: LaunchEvent }
  | { type: 'graduation'; event: GraduationEvent }
  | { type: 'whale'; event: WhaleTradeEvent }
  | { type: 'distribution'; event: FeeDistEvent };

// ── Main Decoder ─────────────────────────────────────────────────────

/**
 * Decode raw Solana program log lines into typed Pump protocol events.
 *
 * Scans for "Program data:" entries, base64-decodes them, matches the
 * 8-byte Anchor discriminator, and Borsh-deserializes the payload.
 *
 * @param logs      Raw log lines from a Solana transaction
 * @param signature Transaction signature (for event metadata)
 * @returns Array of decoded, typed events found in the logs
 */
export function decodePumpLogs(
  logs: string[],
  signature = '',
): DecodedPumpEvent[] {
  const events: DecodedPumpEvent[] = [];

  for (const line of logs) {
    if (!line.includes('Program data:')) continue;
    const b64 = line.split('Program data: ')[1]?.trim();
    if (!b64) continue;

    try {
      const bytes = Buffer.from(b64, 'base64');
      if (bytes.length < 8) continue;
      const disc = Buffer.from(bytes.subarray(0, 8)).toString('hex');

      if (disc === CREATE_V2_DISCRIMINATOR || disc === CREATE_DISCRIMINATOR) {
        const event = decodeLaunch(bytes, signature);
        if (event) events.push({ type: 'launch', event });
      } else if (disc === COMPLETE_EVENT_DISCRIMINATOR) {
        const event = decodeCompleteEvent(bytes, signature);
        if (event) events.push({ type: 'graduation', event });
      } else if (disc === COMPLETE_AMM_MIGRATION_DISCRIMINATOR) {
        const event = decodeMigrationEvent(bytes, signature);
        if (event) events.push({ type: 'graduation', event });
      } else if (disc === TRADE_EVENT_DISCRIMINATOR) {
        const event = decodeTrade(bytes, signature);
        if (event) events.push({ type: 'whale', event });
      } else if (disc === DISTRIBUTE_FEES_EVENT_DISCRIMINATOR) {
        const event = decodeFeeDist(bytes, signature);
        if (event) events.push({ type: 'distribution', event });
      }
    } catch {
      // Skip unparseable log entries
    }
  }

  return events;
}

// ── Individual Decoders ──────────────────────────────────────────────

/**
 * Decode CreateEvent / CreateV2Event.
 *
 * Layout (after 8-byte discriminator):
 *   name: string (4-byte LE len + data)
 *   symbol: string
 *   uri: string
 *   mint: Pubkey (32)
 *   bondingCurve: Pubkey (32)
 *   user: Pubkey (32)
 *   creator: Pubkey (32)
 *   timestamp: i64 (8)
 *   virtualTokenReserves: u64, virtualSolReserves: u64
 *   realTokenReserves: u64, tokenTotalSupply: u64
 *   tokenProgram: Pubkey (32)
 *   isMayhemMode: bool (1)
 *   isCashbackEnabled: bool (1)
 */
function decodeLaunch(
  bytes: Buffer,
  signature: string,
): LaunchEvent | null {
  if (bytes.length < 20) return null;

  let offset = 8;

  const name = readBorshString(bytes, offset);
  offset = name.end;

  const symbol = readBorshString(bytes, offset);
  offset = symbol.end;

  const uri = readBorshString(bytes, offset);
  offset = uri.end;

  // Fixed-size fields: mint + bondingCurve + user + creator + timestamp
  if (offset + 32 + 32 + 32 + 32 + 8 > bytes.length) return null;

  const mint = readPubkey(bytes, offset); offset += 32;
  /* skip bondingCurve */ offset += 32;
  const user = readPubkey(bytes, offset); offset += 32;
  const creator = readPubkey(bytes, offset); offset += 32;
  const timestamp = readI64(bytes, offset); offset += 8;

  // Optional trailing fields: 4 × u64 reserves + tokenProgram(32) + bools
  let isMayhemMode = false;
  let hasCashback = false;
  if (offset + 32 + 32 + 1 + 1 <= bytes.length) {
    offset += 32; // reserves (4 × u64 = 32 bytes)
    offset += 32; // tokenProgram
    isMayhemMode = bytes[offset] === 1; offset += 1;
    hasCashback = bytes[offset] === 1;
  }

  return {
    signature,
    mint,
    creator: creator || user,
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
    isMayhemMode,
    hasCashback,
    timestamp,
  };
}

/**
 * Decode CompleteEvent (bonding curve graduation).
 *
 * Layout (after 8-byte discriminator):
 *   user: Pubkey (32)
 *   mint: Pubkey (32)
 *   bondingCurve: Pubkey (32)
 *   timestamp: i64 (8)
 */
function decodeCompleteEvent(
  bytes: Buffer,
  signature: string,
): GraduationEvent | null {
  const MIN_SIZE = 8 + 32 + 32 + 32 + 8;
  if (bytes.length < MIN_SIZE) return null;

  let offset = 8;
  /* skip user */ offset += 32;
  const mint = readPubkey(bytes, offset); offset += 32;
  /* skip bondingCurve */ offset += 32;
  const timestamp = readI64(bytes, offset);

  return {
    signature,
    mint,
    tokenName: '',
    tokenSymbol: '',
    poolAddress: '',
    timestamp,
  };
}

/**
 * Decode CompletePumpAmmMigrationEvent (AMM pool creation).
 *
 * Layout (after 8-byte discriminator):
 *   user: Pubkey (32)
 *   mint: Pubkey (32)
 *   mintAmount: u64 (8)
 *   solAmount: u64 (8)
 *   poolMigrationFee: u64 (8)
 *   bondingCurve: Pubkey (32)
 *   timestamp: i64 (8)
 *   pool: Pubkey (32)
 */
function decodeMigrationEvent(
  bytes: Buffer,
  signature: string,
): GraduationEvent | null {
  const MIN_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 32 + 8 + 32;
  if (bytes.length < MIN_SIZE) return null;

  let offset = 8;
  /* skip user */ offset += 32;
  const mint = readPubkey(bytes, offset); offset += 32;
  /* skip mintAmount */ offset += 8;
  const solAmount = readU64(bytes, offset); offset += 8;
  /* skip poolMigrationFee */ offset += 8;
  /* skip bondingCurve */ offset += 32;
  const timestamp = readI64(bytes, offset); offset += 8;
  const pool = readPubkey(bytes, offset);

  return {
    signature,
    mint,
    tokenName: '',
    tokenSymbol: '',
    poolAddress: pool,
    finalMcap: solAmount / LAMPORTS_PER_SOL,
    timestamp,
  };
}

/**
 * Decode TradeEvent (buy/sell on bonding curve).
 *
 * Layout (after 8-byte discriminator):
 *   mint: Pubkey (32)
 *   solAmount: u64 (8)
 *   tokenAmount: u64 (8)
 *   isBuy: bool (1)
 *   user: Pubkey (32)
 *   timestamp: i64 (8)
 *   virtualSolReserves: u64 (8)
 *   virtualTokenReserves: u64 (8)
 *   realSolReserves: u64 (8)
 *   realTokenReserves: u64 (8)
 *   ...remaining optional fields
 */
function decodeTrade(
  bytes: Buffer,
  signature: string,
): WhaleTradeEvent | null {
  const MIN_SIZE = 8 + 32 + 8 + 8 + 1 + 32 + 8 + 8 + 8 + 8 + 8;
  if (bytes.length < MIN_SIZE) return null;

  let offset = 8;
  const mint = readPubkey(bytes, offset); offset += 32;
  const solAmountLamports = readU64(bytes, offset); offset += 8;
  const tokenAmount = readU64(bytes, offset); offset += 8;
  const isBuy = bytes[offset] === 1; offset += 1;
  const trader = readPubkey(bytes, offset); offset += 32;
  const timestamp = readI64(bytes, offset); offset += 8;
  const virtualSolReserves = readU64(bytes, offset); offset += 8;
  const virtualTokenReserves = readU64(bytes, offset); offset += 8;
  const realSolReserves = readU64(bytes, offset);

  const solAmount = solAmountLamports / LAMPORTS_PER_SOL;

  // Compute bonding curve progress
  const progress = DEFAULT_GRADUATION_SOL_THRESHOLD > 0
    ? Math.min(100, Math.round(
        (realSolReserves / LAMPORTS_PER_SOL / DEFAULT_GRADUATION_SOL_THRESHOLD) * 1000,
      ) / 10)
    : 0;

  return {
    signature,
    mint,
    trader,
    side: isBuy ? 'buy' : 'sell',
    solAmount,
    tokenAmount,
    progress,
    timestamp,
  };
}

/**
 * Decode DistributeCreatorFeesEvent.
 *
 * Layout (after 8-byte discriminator):
 *   timestamp: i64 (8)
 *   mint: Pubkey (32)
 *   bondingCurve: Pubkey (32)
 *   sharingConfig: Pubkey (32)
 *   admin: Pubkey (32)
 *   shareholders: Vec<{ address: Pubkey(32), shareBps: u16(2) }>
 *   distributed: u64 (8)
 */
function decodeFeeDist(
  bytes: Buffer,
  signature: string,
): FeeDistEvent | null {
  const MIN_SIZE = 8 + 8 + 32 + 32 + 32 + 32 + 4;
  if (bytes.length < MIN_SIZE) return null;

  let offset = 8;
  const timestamp = readI64(bytes, offset); offset += 8;
  const mint = readPubkey(bytes, offset); offset += 32;
  /* skip bondingCurve */ offset += 32;
  /* skip sharingConfig */ offset += 32;
  /* skip admin */ offset += 32;

  // Parse shareholders Vec: 4-byte LE count + { Pubkey(32) + u16(2) } each
  const shareholders: Array<{ address: string; amount: number }> = [];
  if (offset + 4 <= bytes.length) {
    const vecLen = bytes.readUInt32LE(offset); offset += 4;
    for (let i = 0; i < vecLen && offset + 34 <= bytes.length; i++) {
      const address = readPubkey(bytes, offset); offset += 32;
      const shareBps = bytes.readUInt16LE(offset); offset += 2;
      shareholders.push({ address, amount: shareBps });
    }
  }

  // distributedAmount follows the shareholders vec
  let totalAmount = 0;
  if (offset + 8 <= bytes.length) {
    totalAmount = readU64(bytes, offset) / LAMPORTS_PER_SOL;
  }

  return {
    signature,
    mint,
    totalAmount,
    shareholders,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
  };
}

// ── Borsh Helpers ────────────────────────────────────────────────────

/** Read a 32-byte public key as base58 string */
function readPubkey(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
}

/** Read a little-endian u64 as a JavaScript number */
function readU64(buf: Buffer, offset: number): number {
  const lo =
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>> 0;
  const hi =
    (buf[offset + 4]! |
      (buf[offset + 5]! << 8) |
      (buf[offset + 6]! << 16) |
      (buf[offset + 7]! << 24)) >>> 0;
  return hi * 0x1_0000_0000 + lo;
}

/** Read a little-endian i64 as a JavaScript number (safe for timestamps) */
function readI64(buf: Buffer, offset: number): number {
  return readU64(buf, offset);
}

/** Read a Borsh-encoded string: 4-byte LE length prefix + UTF-8 data */
function readBorshString(
  buf: Buffer,
  offset: number,
): { value: string; end: number } {
  if (offset + 4 > buf.length) return { value: '', end: offset };
  const len = buf.readUInt32LE(offset);
  offset += 4;
  if (len > 1000 || offset + len > buf.length) return { value: '', end: offset };
  const value = buf.subarray(offset, offset + len).toString('utf8');
  return { value, end: offset + len };
}
