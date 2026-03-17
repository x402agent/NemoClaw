/**
 * @pumpkit/core — Instruction Discriminator Types
 *
 * Structured instruction definitions for claim, CTO (creator takeover),
 * and event discriminators. Extracted from telegram-bot and channel-bot
 * production implementations.
 */

import {
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEE_PROGRAM_ID,
} from '../solana/programs.js';

// ── Claim Instruction Types ──────────────────────────────────────────

/** Claim type identifiers across Pump and PumpSwap programs */
export type ClaimType =
  | 'collect_creator_fee'
  | 'claim_cashback'
  | 'claim_social_fee_pda'
  | 'collect_coin_creator_fee'
  | 'distribute_creator_fees'
  | 'transfer_creator_fees_to_pump';

/** Structured instruction definition for claim detection */
export interface InstructionDef {
  /** Hex string of the 8-byte Anchor discriminator */
  discriminator: string;
  /** Human-readable label */
  label: string;
  /** Which claim type this instruction represents */
  claimType: ClaimType;
  /** Which program this instruction belongs to */
  programId: string;
  /** Whether the claimer is a creator (true) or trader getting cashback (false) */
  isCreatorClaim: boolean;
}

/**
 * All claim/collect instructions monitored across Pump and PumpSwap programs.
 * Discriminators from official IDL files (pump.json, pump_amm.json).
 */
export const CLAIM_INSTRUCTIONS: InstructionDef[] = [
  { claimType: 'collect_creator_fee', discriminator: '1416567bc61cdb84', isCreatorClaim: true, label: 'Collect Creator Fee (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', isCreatorClaim: false, label: 'Claim Cashback (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'distribute_creator_fees', discriminator: 'a572670079cef751', isCreatorClaim: true, label: 'Distribute Creator Fees (Pump)', programId: PUMP_PROGRAM_ID },
  { claimType: 'collect_coin_creator_fee', discriminator: 'a039592ab58b2b42', isCreatorClaim: true, label: 'Collect Creator Fee (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'claim_cashback', discriminator: '253a237ebe35e4c5', isCreatorClaim: false, label: 'Claim Cashback (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'transfer_creator_fees_to_pump', discriminator: '8b348655e4e56cf1', isCreatorClaim: true, label: 'Transfer Creator Fees to Pump', programId: PUMP_AMM_PROGRAM_ID },
  { claimType: 'claim_social_fee_pda', discriminator: 'e115fb85a11ec7e2', isCreatorClaim: true, label: 'Claim Social Fee PDA (GitHub)', programId: PUMP_FEE_PROGRAM_ID },
];

// ── CTO (Creator Takeover) Instruction Types ─────────────────────────

/** Creator change type identifiers */
export type CreatorChangeType =
  | 'set_creator'
  | 'admin_set_creator'
  | 'set_coin_creator'
  | 'admin_set_coin_creator'
  | 'migrate_pool_coin_creator';

/** Structured instruction definition for creator change detection */
export interface CreatorChangeInstructionDef {
  /** Hex string of the 8-byte Anchor discriminator */
  discriminator: string;
  /** Human-readable label */
  label: string;
  /** Which creator change type this instruction represents */
  changeType: CreatorChangeType;
  /** Which program this instruction belongs to */
  programId: string;
  /** Whether the new creator pubkey is in the instruction args (vs derived from metadata) */
  hasCreatorArg: boolean;
}

/**
 * All set_creator / admin_set_creator instructions across Pump and PumpSwap.
 * These change who receives future creator fees for a token (CTO).
 */
export const CTO_INSTRUCTIONS: CreatorChangeInstructionDef[] = [
  { changeType: 'admin_set_creator', discriminator: '4519ab8e39ef0d04', hasCreatorArg: true, label: 'Admin Set Creator (Pump)', programId: PUMP_PROGRAM_ID },
  { changeType: 'set_creator', discriminator: 'fe94ff70cf8eaaa5', hasCreatorArg: true, label: 'Set Creator (Pump)', programId: PUMP_PROGRAM_ID },
  { changeType: 'admin_set_coin_creator', discriminator: 'f228759149606968', hasCreatorArg: true, label: 'Admin Set Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { changeType: 'set_coin_creator', discriminator: 'd295802dbc3a4eaf', hasCreatorArg: false, label: 'Set Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
  { changeType: 'migrate_pool_coin_creator', discriminator: 'd0089f044aaf103a', hasCreatorArg: false, label: 'Migrate Pool Coin Creator (PumpSwap)', programId: PUMP_AMM_PROGRAM_ID },
];

// ── Claim Event Discriminators ───────────────────────────────────────

/**
 * Event discriminators emitted by Anchor CPI self-invoke in program data logs.
 * Used to detect claim events from transaction logs.
 */
export const CLAIM_EVENT_DISCRIMINATORS: Record<string, { label: string; isCreatorClaim: boolean }> = {
  '7a027f010ebf0caf': { isCreatorClaim: true, label: 'CollectCreatorFeeEvent' },
  'a537817004b3ca28': { isCreatorClaim: true, label: 'DistributeCreatorFeesEvent' },
  'e2d6f62107f293e5': { isCreatorClaim: false, label: 'ClaimCashbackEvent' },
  'e8f5c2eeeada3a59': { isCreatorClaim: true, label: 'CollectCoinCreatorFeeEvent' },
  '3212c141edd2eaec': { isCreatorClaim: true, label: 'SocialFeePdaClaimed' },
};
