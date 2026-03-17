/**
 * Pump Fun Agent Tracker Bot — Type Definitions
 *
 * Types for tracking claims, buybacks, and developer wallet activity
 * for the tokenized agent payment system.
 */

/** The Pump AMM program (post-graduation liquidity) */
export const PUMP_AMM_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

/** The Pump bonding-curve program */
export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/** Wrapped SOL mint */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/** Claim instruction discriminators (from official IDL) */
export const CLAIM_DISCRIMINATORS: Record<string, string> = {
    '1416567bc61cdb84': 'Collect Creator Fee (Pump)',
    '253a237ebe35e4c5': 'Claim Cashback',
    'a039592ab58b2b42': 'Collect Creator Fee (PumpSwap)',
    'a572670079cef751': 'Distribute Creator Fees (Pump)',
    '8b348655e4e56cf1': 'Transfer Creator Fees to Pump',
};

/** Trade event discriminator for buy/sell detection */
export const TRADE_EVENT_DISCRIMINATOR = 'bddb7fd34ee661ee';

/** An agent payment event detected on-chain */
export interface AgentPaymentEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    payerWallet: string;
    amountLamports: number;
    amountSol: number;
    memo: string;
    agentMint: string;
}

/** A claim event (creator collecting fees) */
export interface ClaimEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    claimerWallet: string;
    amountSol: number;
    claimType: string;
    tokenMint: string;
}

/** A buyback event (tokens being purchased) */
export interface BuybackEvent {
    txSignature: string;
    slot: number;
    timestamp: number;
    buyerWallet: string;
    solAmount: number;
    tokenAmount: number;
    tokenMint: string;
    isBuy: boolean;
}

/** Developer wallet balance snapshot */
export interface WalletSnapshot {
    address: string;
    solBalance: number;
    timestamp: number;
}

/** Tracker state persisted in memory */
export interface TrackerState {
    totalPaymentsReceived: number;
    totalSolCollected: number;
    totalClaims: number;
    totalClaimsSol: number;
    totalBuybacks: number;
    totalBuybackSol: number;
    lastPayment: AgentPaymentEvent | null;
    lastClaim: ClaimEvent | null;
    lastBuyback: BuybackEvent | null;
    startedAt: number;
}

export interface BotConfig {
    telegramToken: string;
    solanaRpcUrl: string;
    agentTokenMint: string;
    developerWallet: string;
    notifyChatIds: number[];
    pollIntervalSeconds: number;
}
