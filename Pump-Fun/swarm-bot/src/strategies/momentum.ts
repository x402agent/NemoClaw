import BN from 'bn.js';
import type { Strategy, TokenSnapshot, StrategyConfig, TradeSignal } from './types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Momentum Strategy
 *
 * Buys tokens showing rising market-cap momentum on the bonding curve
 * and sells when momentum reverses or reaches a target R/R.
 *
 * Tracks a rolling window of price snapshots to compute velocity.
 *
 * Params:
 *   minMcapSol: number        — Only track above this mcap (default 5)
 *   maxMcapSol: number        — Only track below this mcap (default 100)
 *   entryVelocityPctPerSec: number — Minimum mcap velocity to trigger buy (default 2)
 *   exitVelocityPctPerSec: number  — Sell when velocity drops below this (default -1)
 *   takeProfitPct: number     — Sell at this % gain (default 50)
 *   stopLossPct: number       — Sell at this % loss (default 20)
 *   windowSec: number         — Rolling window for velocity calc (default 30)
 */
export class MomentumStrategy implements Strategy {
  readonly name = 'momentum';
  readonly description = 'Buy tokens with rising mcap velocity, ride the wave';

  private priceHistory = new Map<string, Array<{ ts: number; mcapSol: number }>>();

  shouldTrack(snapshot: TokenSnapshot, config: StrategyConfig): boolean {
    const minMcap = (config.params.minMcapSol as number) ?? 5;
    const maxMcap = (config.params.maxMcapSol as number) ?? 100;
    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;
    return mcapSol >= minMcap && mcapSol <= maxMcap && !snapshot.complete;
  }

  evaluate(snapshot: TokenSnapshot, openPositionSol: BN | null, config: StrategyConfig): TradeSignal {
    const entryVel = (config.params.entryVelocityPctPerSec as number) ?? 2;
    const exitVel = (config.params.exitVelocityPctPerSec as number) ?? -1;
    const tpPct = (config.params.takeProfitPct as number) ?? 50;
    const slPct = (config.params.stopLossPct as number) ?? 20;
    const windowSec = (config.params.windowSec as number) ?? 30;

    const mcapSol = snapshot.marketCapLamports.toNumber() / LAMPORTS_PER_SOL;
    const now = Date.now() / 1000;

    // Update price history
    const key = snapshot.mint;
    if (!this.priceHistory.has(key)) {
      this.priceHistory.set(key, []);
    }
    const history = this.priceHistory.get(key)!;
    history.push({ ts: now, mcapSol });
    // Trim old entries
    const cutoff = now - windowSec * 2;
    while (history.length > 0 && history[0].ts < cutoff) {
      history.shift();
    }

    if (snapshot.complete) {
      this.priceHistory.delete(key);
      if (openPositionSol && openPositionSol.gtn(0)) {
        return { action: 'sell', mint: key, reason: 'Token graduated — exit', urgency: 85 };
      }
      return { action: 'hold', mint: key, reason: 'Token graduated', urgency: 0 };
    }

    // Calculate velocity (% change per second over window)
    const velocity = this.computeVelocity(history, windowSec);

    // If we have a position
    if (openPositionSol && openPositionSol.gtn(0)) {
      const entrySol = openPositionSol.toNumber() / LAMPORTS_PER_SOL;
      // Track P&L by comparing current mcap trend to entry
      // (Actual P&L is managed by position tracker, this is directional signal)

      if (velocity < exitVel) {
        return { action: 'sell', mint: key, reason: `Momentum reversed (${velocity.toFixed(2)}%/s)`, urgency: 80 };
      }

      // Price-based stop loss / take profit via mcap as proxy
      if (snapshot.progressBps >= 9500) {
        return { action: 'sell', mint: key, reason: 'Approaching graduation — take profit', urgency: 85 };
      }

      return { action: 'hold', mint: key, reason: `Riding momentum (${velocity.toFixed(2)}%/s)`, urgency: 0 };
    }

    // Buy logic — no position
    if (velocity >= entryVel && history.length >= 3) {
      const buySol = config.maxBuySol;
      return {
        action: 'buy',
        mint: key,
        reason: `Strong momentum (${velocity.toFixed(2)}%/s, mcap ${mcapSol.toFixed(1)} SOL)`,
        solAmount: new BN(Math.floor(buySol * LAMPORTS_PER_SOL)),
        urgency: 70,
      };
    }

    return { action: 'hold', mint: key, reason: `Velocity ${velocity.toFixed(2)}%/s — waiting`, urgency: 0 };
  }

  private computeVelocity(history: Array<{ ts: number; mcapSol: number }>, windowSec: number): number {
    if (history.length < 2) return 0;
    const now = history[history.length - 1].ts;
    const windowStart = now - windowSec;
    const windowEntries = history.filter(h => h.ts >= windowStart);
    if (windowEntries.length < 2) return 0;

    const first = windowEntries[0];
    const last = windowEntries[windowEntries.length - 1];
    const dt = last.ts - first.ts;
    if (dt < 1) return 0;

    const pctChange = ((last.mcapSol - first.mcapSol) / first.mcapSol) * 100;
    return pctChange / dt; // % per second
  }

  /** Exposed for testing — clear internal state */
  reset(): void {
    this.priceHistory.clear();
  }
}
