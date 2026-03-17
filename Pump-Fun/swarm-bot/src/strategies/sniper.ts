import BN from 'bn.js';
import type { Strategy, TokenSnapshot, StrategyConfig, TradeSignal } from './types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Sniper Strategy
 *
 * Buys brand-new tokens within seconds of launch and sells at
 * a configurable profit target or stop-loss.
 *
 * Params:
 *   maxAgeSec: number       — Only buy tokens younger than this (default 30)
 *   maxMarketCapSol: number — Only buy below this market cap (default 10)
 *   takeProfitMultiple: number — Sell when position value hits this multiple (default 3)
 *   stopLossPercent: number — Sell when position drops by this percent (default 30)
 */
export class SniperStrategy implements Strategy {
  readonly name = 'sniper';
  readonly description = 'Buy new launches instantly, sell at profit target or stop-loss';

  shouldTrack(snapshot: TokenSnapshot, config: StrategyConfig): boolean {
    const maxAge = (config.params.maxAgeSec as number) ?? 30;
    const maxMcap = (config.params.maxMarketCapSol as number) ?? 10;
    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;
    return snapshot.ageSec <= maxAge && mcapSol <= maxMcap && !snapshot.complete;
  }

  evaluate(snapshot: TokenSnapshot, openPositionSol: BN | null, config: StrategyConfig): TradeSignal {
    const maxAge = (config.params.maxAgeSec as number) ?? 30;
    const maxMcap = (config.params.maxMarketCapSol as number) ?? 10;
    const tpMult = (config.params.takeProfitMultiple as number) ?? 3;
    const slPct = (config.params.stopLossPercent as number) ?? 30;
    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;

    if (snapshot.complete) {
      if (openPositionSol && openPositionSol.gtn(0)) {
        return { action: 'sell', mint: snapshot.mint, reason: 'Token graduated — exit position', urgency: 90, tokenAmount: undefined };
      }
      return { action: 'hold', mint: snapshot.mint, reason: 'Token graduated', urgency: 0 };
    }

    // Sell logic — if we have a position
    if (openPositionSol && openPositionSol.gtn(0)) {
      // Estimate current value based on price movement
      // This is a simplified check — real P&L is tracked by position manager
      if (mcapSol >= maxMcap * tpMult) {
        return { action: 'sell', mint: snapshot.mint, reason: `Take profit — mcap ${mcapSol.toFixed(1)} SOL`, urgency: 80 };
      }
      if (snapshot.progressBps >= 9000) {
        return { action: 'sell', mint: snapshot.mint, reason: `Near graduation (${snapshot.progressBps / 100}%) — exit`, urgency: 85 };
      }
      // Stop loss: if market cap dropped below entry by slPct
      const entryEstimate = openPositionSol.toNumber() / LAMPORTS_PER_SOL;
      if (mcapSol < entryEstimate * (1 - slPct / 100)) {
        return { action: 'sell', mint: snapshot.mint, reason: `Stop loss — mcap dropped to ${mcapSol.toFixed(1)} SOL`, urgency: 95 };
      }
      return { action: 'hold', mint: snapshot.mint, reason: 'Holding — waiting for TP/SL', urgency: 0 };
    }

    // Buy logic — no position yet
    if (snapshot.ageSec <= maxAge && mcapSol <= maxMcap) {
      const buySol = Math.min(config.maxBuySol, maxMcap * 0.05); // Buy ~5% of max mcap
      return {
        action: 'buy',
        mint: snapshot.mint,
        reason: `New token (${snapshot.ageSec}s old, ${mcapSol.toFixed(2)} SOL mcap)`,
        solAmount: new BN(Math.floor(buySol * LAMPORTS_PER_SOL)),
        urgency: 95, // Sniping is time-critical
      };
    }

    return { action: 'hold', mint: snapshot.mint, reason: `Too old (${snapshot.ageSec}s) or mcap too high (${mcapSol.toFixed(1)} SOL)`, urgency: 0 };
  }
}
