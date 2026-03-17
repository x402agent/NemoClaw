/**
 * MAYHEM MODE BRIDGE
 *
 * Connects the Pump SDK's bonding curve / AMM operations
 * with the MAWDhem Mode on-chain agent protocol.
 *
 * Provides:
 *   - Token creation with Mayhem Mode enabled
 *   - Revenue tracking from trade events
 *   - Bonding curve state queries for the $MAWD token
 *   - Fee sharing config for flywheel revenue routing
 *
 * $MAWD CA: 5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

import { PumpSdk, PUMP_SDK, MAYHEM_PROGRAM_ID } from "./sdk";
import { OnlinePumpSdk } from "./onlineSdk";
import {
  bondingCurvePda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  getGlobalParamsPda,
  feeSharingConfigPda,
} from "./pda";
import {
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "./bondingCurve";
import type { BondingCurve, Global, FeeConfig, SharingConfig } from "./state";

// ============================================================================
// CONSTANTS
// ============================================================================

/** $MAWD token mint address */
export const MAWD_MINT = new PublicKey(
  "5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump",
);

/** USDC mint */
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

/** Wrapped SOL mint */
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

/** Mayhem Mode program for agent registry / task invoices */
export const MAYHEM_MODE_PROGRAM_ID = new PublicKey(
  "7K2NbfyjZiFdxY8CLR3KXLrVXWBdnhv9zAncSRkZZ3Sv",
);

// ============================================================================
// TYPES
// ============================================================================

export interface MayhemTokenState {
  mint: PublicKey;
  bondingCurve: BondingCurve;
  isMayhemMode: boolean;
  isGraduated: boolean;
  pricePerToken: BN;
  marketCap: BN;
  mayhemStatePda: PublicKey;
}

export interface RevenueTrack {
  source: "trade_fee" | "creator_fee" | "task_completion" | "direct_deposit";
  amount: BN;
  currencyMint: PublicKey;
  timestamp: number;
  signature?: string;
}

export interface MayhemBridgeConfig {
  /** RPC connection */
  connection: Connection;
  /** Authority keypair for signing transactions */
  authority?: Keypair;
  /** $MAWD token mint (defaults to MAWD_MINT) */
  agentMint?: PublicKey;
  /** Revenue callback — fires whenever revenue is detected */
  onRevenue?: (revenue: RevenueTrack) => void;
}

// ============================================================================
// MAYHEM BRIDGE
// ============================================================================

export class MayhemBridge {
  private connection: Connection;
  private authority: Keypair | null;
  private agentMint: PublicKey;
  private onlineSdk: OnlinePumpSdk;
  private onRevenue: ((revenue: RevenueTrack) => void) | null;
  private revenueHistory: RevenueTrack[] = [];
  private logSubscriptionId: number | null = null;

  constructor(config: MayhemBridgeConfig) {
    this.connection = config.connection;
    this.authority = config.authority || null;
    this.agentMint = config.agentMint || MAWD_MINT;
    this.onlineSdk = new OnlinePumpSdk(config.connection);
    this.onRevenue = config.onRevenue || null;
  }

  // ==========================================================================
  // TOKEN STATE
  // ==========================================================================

  /**
   * Fetch $MAWD bonding curve state from on-chain
   */
  async getTokenState(): Promise<MayhemTokenState> {
    const bc = await this.onlineSdk.fetchBondingCurve(this.agentMint);
    const mayhemPda = getMayhemStatePda(this.agentMint);

    // Calculate price: virtualSolReserves / virtualTokenReserves
    const pricePerToken = bc.virtualSolReserves.mul(new BN(1_000_000_000)).div(
      bc.virtualTokenReserves,
    );

    // Market cap = price * total supply
    const marketCap = pricePerToken
      .mul(bc.tokenTotalSupply)
      .div(new BN(1_000_000_000));

    return {
      mint: this.agentMint,
      bondingCurve: bc,
      isMayhemMode: bc.isMayhemMode,
      isGraduated: bc.complete,
      pricePerToken,
      marketCap,
      mayhemStatePda: mayhemPda,
    };
  }

  /**
   * Get the Mayhem state PDA for the agent token
   */
  getMayhemStatePda(): PublicKey {
    return getMayhemStatePda(this.agentMint);
  }

  /**
   * Get the fee sharing config PDA for the agent token
   */
  getFeeSharingConfigPda(): PublicKey {
    return feeSharingConfigPda(this.agentMint);
  }

  // ==========================================================================
  // TOKEN CREATION WITH MAYHEM MODE
  // ==========================================================================

  /**
   * Build instructions to create a new token with Mayhem Mode enabled
   */
  async createMayhemToken(params: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
  }): Promise<TransactionInstruction> {
    return PUMP_SDK.createV2Instruction({
      ...params,
      mayhemMode: true,
      cashback: false,
    });
  }

  /**
   * Build instructions to create a token with mayhem mode AND initial buy
   */
  async createMayhemTokenAndBuy(params: {
    mint: PublicKey;
    name: string;
    symbol: string;
    uri: string;
    creator: PublicKey;
    user: PublicKey;
    solAmount: BN;
    tokenAmount: BN;
  }): Promise<TransactionInstruction[]> {
    const global = await this.onlineSdk.fetchGlobal();
    return PUMP_SDK.createV2AndBuyInstructions({
      global,
      mint: params.mint,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
      creator: params.creator,
      user: params.user,
      amount: params.tokenAmount,
      solAmount: params.solAmount,
      mayhemMode: true,
      cashback: false,
    });
  }

  // ==========================================================================
  // TRADING (for buyback engine integration)
  // ==========================================================================

  /**
   * Build buy instructions for $MAWD via bonding curve
   * Used by the flywheel's buyback engine when token hasn't graduated
   */
  async buildBuyInstructions(params: {
    user: PublicKey;
    solAmount: BN;
    slippage?: number;
  }): Promise<TransactionInstruction[]> {
    const global = await this.onlineSdk.fetchGlobal();
    const { bondingCurve, bondingCurveAccountInfo, associatedUserAccountInfo } =
      await this.onlineSdk.fetchBuyState(this.agentMint, params.user);

    if (bondingCurve.complete) {
      throw new Error(
        "Token has graduated to AMM — use Jupiter or PumpAMM for trades",
      );
    }

    const feeConfig = await this.onlineSdk.fetchFeeConfig();
    const mintSupply = bondingCurve.tokenTotalSupply;

    const tokenAmount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply,
      bondingCurve,
      amount: params.solAmount,
    });

    return PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      associatedUserAccountInfo,
      mint: this.agentMint,
      user: params.user,
      amount: tokenAmount,
      solAmount: params.solAmount,
      slippage: params.slippage ?? 3,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
  }

  /**
   * Build sell instructions for $MAWD via bonding curve
   */
  async buildSellInstructions(params: {
    user: PublicKey;
    tokenAmount: BN;
    slippage?: number;
  }): Promise<TransactionInstruction[]> {
    const global = await this.onlineSdk.fetchGlobal();
    const bc = await this.onlineSdk.fetchBondingCurve(this.agentMint);

    if (bc.complete) {
      throw new Error(
        "Token has graduated to AMM — use Jupiter or PumpAMM for trades",
      );
    }

    const feeConfig = await this.onlineSdk.fetchFeeConfig();
    const mintSupply = bc.tokenTotalSupply;

    const solAmount = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply,
      bondingCurve: bc,
      amount: params.tokenAmount,
    });

    return PUMP_SDK.sellInstructions({
      global,
      mint: this.agentMint,
      user: params.user,
      amount: params.tokenAmount,
      minSolOutput: solAmount,
      slippage: params.slippage ?? 3,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
  }

  // ==========================================================================
  // FEE SHARING CONFIG
  // ==========================================================================

  /**
   * Build instructions to set up fee sharing for the agent token.
   * Revenue split goes to the flywheel authority for buyback & burn.
   */
  async buildFeeSharingConfig(params: {
    user: PublicKey;
    shareholders: { address: PublicKey; shareBps: number }[];
  }): Promise<TransactionInstruction[]> {
    return PUMP_SDK.createFeeSharingConfig({
      mint: this.agentMint,
      shareholders: params.shareholders,
      user: params.user,
    });
  }

  // ==========================================================================
  // REVENUE MONITORING
  // ==========================================================================

  /**
   * Start monitoring on-chain events for revenue from $MAWD trades.
   * Fires the onRevenue callback whenever revenue flows are detected.
   */
  async startRevenueMonitor(): Promise<void> {
    if (this.logSubscriptionId !== null) return;

    // Subscribe to Mayhem Mode program logs
    this.logSubscriptionId = this.connection.onLogs(
      MAYHEM_MODE_PROGRAM_ID,
      (logs) => {
        this.parseRevenueLogs(logs);
      },
      "confirmed",
    );

    console.log(
      `[MAYHEM-BRIDGE] Revenue monitor started — watching ${MAYHEM_MODE_PROGRAM_ID.toBase58()}`,
    );
  }

  /**
   * Stop revenue monitoring
   */
  async stopRevenueMonitor(): Promise<void> {
    if (this.logSubscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.logSubscriptionId);
      this.logSubscriptionId = null;
      console.log("[MAYHEM-BRIDGE] Revenue monitor stopped");
    }
  }

  /**
   * Get accumulated revenue history
   */
  getRevenueHistory(): RevenueTrack[] {
    return [...this.revenueHistory];
  }

  /**
   * Get total revenue tracked (in lamports for SOL, smallest units for SPL)
   */
  getTotalRevenue(): Map<string, BN> {
    const totals = new Map<string, BN>();
    for (const rev of this.revenueHistory) {
      const key = rev.currencyMint.toBase58();
      const existing = totals.get(key) || new BN(0);
      totals.set(key, existing.add(rev.amount));
    }
    return totals;
  }

  // ==========================================================================
  // PRIVATE — Log Parsing
  // ==========================================================================

  private parseRevenueLogs(logs: { signature: string; logs: string[] }): void {
    // Look for TaskCompleted, StreamWithdrawal, DisputeResolved events
    // These indicate revenue that should flow to the flywheel
    const logStr = logs.logs.join("\n");

    if (
      logStr.includes("TaskCompleted") ||
      logStr.includes("StreamWithdrawal") ||
      logStr.includes("DisputeResolved")
    ) {
      // Extract amount from program data (simplified — full parsing in EventListenerBridge)
      const revenue: RevenueTrack = {
        source: "task_completion",
        amount: new BN(0), // Parsed from event data in production
        currencyMint: WSOL_MINT,
        timestamp: Date.now(),
        signature: logs.signature,
      };

      this.revenueHistory.push(revenue);

      if (this.onRevenue) {
        this.onRevenue(revenue);
      }
    }
  }
}

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

/**
 * Create a MayhemBridge instance pre-configured for the $MAWD token.
 *
 * Usage:
 *   const bridge = createMayhemBridge(connection, authorityKeypair);
 *   const state = await bridge.getTokenState();
 */
export function createMayhemBridge(
  connection: Connection,
  authority?: Keypair,
  onRevenue?: (revenue: RevenueTrack) => void,
): MayhemBridge {
  return new MayhemBridge({
    connection,
    authority,
    agentMint: MAWD_MINT,
    onRevenue,
  });
}
