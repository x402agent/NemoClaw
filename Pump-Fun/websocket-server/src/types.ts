// ════════════════════════════════════════════════════════════════════
// Shared types for the PumpFun WebSocket relay
// ════════════════════════════════════════════════════════════════════

/** A parsed token launch event broadcast to browser clients */
export interface TokenLaunchEvent {
  type: 'token-launch';
  signature: string;
  time: string;        // ISO timestamp
  name: string | null;
  symbol: string | null;
  metadataUri: string | null;
  mint: string | null;
  creator: string | null;
  isV2: boolean;
  hasGithub: boolean;
  githubUrls: string[];
  imageUri: string | null;
  description: string | null;
  marketCapSol: number | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

// ════════════════════════════════════════════════════════════════════
// Fee Claim Events
// ════════════════════════════════════════════════════════════════════

export type ClaimType =
  | 'collect_creator_fee'
  | 'claim_cashback'
  | 'collect_coin_creator_fee'
  | 'distribute_creator_fees'
  | 'transfer_creator_fees_to_pump'
  | 'claim_social_fee_pda';

/** A parsed fee claim event broadcast to all clients */
export interface FeeClaimEvent {
  type: 'fee-claim';
  txSignature: string;
  slot: number;
  timestamp: number;
  claimerWallet: string;
  tokenMint: string;
  tokenName?: string;
  tokenSymbol?: string;
  amountSol: number;
  amountLamports: number;
  claimType: ClaimType;
  isCashback: boolean;
  programId: string;
  claimLabel: string;
}

/** Server status broadcast */
export interface ServerStatus {
  type: 'status';
  connected: boolean;
  uptime: number;       // seconds
  totalLaunches: number;
  githubLaunches: number;
  totalClaims: number;
  clients: number;
}

/** Heartbeat / ping */
export interface Heartbeat {
  type: 'heartbeat';
  ts: number;
}

export type RelayMessage = TokenLaunchEvent | FeeClaimEvent | ServerStatus | Heartbeat;

