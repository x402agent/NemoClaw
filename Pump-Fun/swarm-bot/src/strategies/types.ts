import type BN from 'bn.js';

/**
 * A signal produced by a strategy's evaluate() method.
 */
export interface TradeSignal {
  action: 'buy' | 'sell' | 'hold';
  mint: string;
  reason: string;
  /** SOL amount for buys (lamports) */
  solAmount?: BN;
  /** Token amount for sells */
  tokenAmount?: BN;
  /** Urgency 0-100 — higher = execute sooner */
  urgency: number;
}

/**
 * A snapshot of a token's on-chain state used by strategies.
 */
export interface TokenSnapshot {
  mint: string;
  marketCapLamports: BN;
  pricePerToken: BN;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  complete: boolean;
  /** Graduation progress 0–10000 bps */
  progressBps: number;
  /** Age in seconds since token creation (approximate) */
  ageSec: number;
}

/** Parameters that every strategy can receive */
export interface StrategyConfig {
  /** Max SOL per single buy */
  maxBuySol: number;
  /** Max open positions */
  maxPositions: number;
  /** Slippage tolerance in basis points */
  slippageBps: number;
  /** Strategy-specific params (varies by strategy) */
  params: Record<string, unknown>;
}

/**
 * Every strategy must implement this interface.
 */
export interface Strategy {
  /** Unique strategy identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /**
   * Evaluate a snapshot and return a trade signal.
   * Called on every poll cycle for every tracked token.
   */
  evaluate(
    snapshot: TokenSnapshot,
    openPositionSol: BN | null,
    config: StrategyConfig,
  ): TradeSignal;

  /**
   * Filter whether a newly detected token should be tracked by this strategy.
   * Called once when a new token is detected in the feed.
   */
  shouldTrack(snapshot: TokenSnapshot, config: StrategyConfig): boolean;
}
