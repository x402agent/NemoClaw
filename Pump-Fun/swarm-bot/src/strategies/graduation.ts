import BN from 'bn.js';
import type { Strategy, TokenSnapshot, StrategyConfig, TradeSignal } from './types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Graduation Strategy
 *
 * Accumulates a position as a token approaches graduation (bonding-curve
 * completion) and sells into the AMM liquidity that arrives after migration.
 *
 * Graduation = bonding curve reaches 100% → token migrates to PumpAMM
 * with deep liquidity. Strategy profits from the step-up in value.
 *
 * Params:
 *   minProgressBps: number     — Start tracking at this % (default 7000 = 70%)
 *   entryProgressBps: number   — Begin buying at this % (default 8000 = 80%)
 *   maxEntrySol: number        — Max total buy before graduation (default 3)
 *   entryTranches: number      — Number of buy tranches (default 3)
 *   holdAfterGradMs: number    — Hold for at least this long after graduation (default 60000)
 *   takeProfitPct: number      — Sell at this % gain post-graduation (default 40)
 *   stopLossPct: number        — Sell at this % loss (default 15)
 */
export class GraduationStrategy implements Strategy {
  readonly name = 'graduation';
  readonly description = 'Accumulate before graduation, sell into AMM liquidity';

  // Track buy tranches per mint
  private tranchesBought = new Map<string, number>();
  // Track graduation time per mint
  private graduatedAt = new Map<string, number>();

  shouldTrack(snapshot: TokenSnapshot, config: StrategyConfig): boolean {
    const minProgress = (config.params.minProgressBps as number) ?? 7000;
    // Track tokens approaching graduation
    return snapshot.progressBps >= minProgress || snapshot.complete;
  }

  evaluate(snapshot: TokenSnapshot, openPositionSol: BN | null, config: StrategyConfig): TradeSignal {
    const entryProgress = (config.params.entryProgressBps as number) ?? 8000;
    const maxEntrySol = (config.params.maxEntrySol as number) ?? 3;
    const entryTranches = (config.params.entryTranches as number) ?? 3;
    const holdAfterGradMs = (config.params.holdAfterGradMs as number) ?? 60_000;
    const tpPct = (config.params.takeProfitPct as number) ?? 40;
    const slPct = (config.params.stopLossPct as number) ?? 15;
    const key = snapshot.mint;
    const now = Date.now();

    // --- Post-graduation logic ---
    if (snapshot.complete) {
      if (!this.graduatedAt.has(key)) {
        this.graduatedAt.set(key, now);
      }

      if (!openPositionSol || openPositionSol.isZero()) {
        this.cleanup(key);
        return { action: 'hold', mint: key, reason: 'Graduated but no position', urgency: 0 };
      }

      const gradTime = this.graduatedAt.get(key)!;
      const elapsed = now - gradTime;

      // Hold period after graduation
      if (elapsed < holdAfterGradMs) {
        return {
          action: 'hold',
          mint: key,
          reason: `Graduated ${(elapsed / 1000).toFixed(0)}s ago — holding (${(holdAfterGradMs / 1000).toFixed(0)}s target)`,
          urgency: 0,
        };
      }

      // After hold period, sell
      return {
        action: 'sell',
        mint: key,
        reason: `Hold period complete (${(elapsed / 1000).toFixed(0)}s) — selling into AMM liquidity`,
        urgency: 75,
      };
    }

    // --- Pre-graduation logic ---
    const positionSol = openPositionSol ? openPositionSol.toNumber() / LAMPORTS_PER_SOL : 0;
    const boughtTranches = this.tranchesBought.get(key) ?? 0;

    // Check if we should buy another tranche
    if (snapshot.progressBps >= entryProgress && boughtTranches < entryTranches && positionSol < maxEntrySol) {
      const trancheSol = Math.min(
        config.maxBuySol,
        (maxEntrySol - positionSol) / (entryTranches - boughtTranches)
      );

      if (trancheSol > 0.001) {
        this.tranchesBought.set(key, boughtTranches + 1);
        return {
          action: 'buy',
          mint: key,
          reason: `Tranche ${boughtTranches + 1}/${entryTranches} at ${(snapshot.progressBps / 100).toFixed(1)}% progress`,
          solAmount: new BN(Math.floor(trancheSol * LAMPORTS_PER_SOL)),
          urgency: 60 + Math.floor(snapshot.progressBps / 200), // Higher urgency closer to graduation
        };
      }
    }

    // Stop loss for pre-graduation positions
    if (positionSol > 0 && snapshot.progressBps < entryProgress * 0.7) {
      return {
        action: 'sell',
        mint: key,
        reason: `Progress dropped to ${(snapshot.progressBps / 100).toFixed(1)}% — stop loss`,
        urgency: 90,
      };
    }

    return {
      action: 'hold',
      mint: key,
      reason: `Progress ${(snapshot.progressBps / 100).toFixed(1)}% — ${openPositionSol ? 'holding' : 'watching'}`,
      urgency: 0,
    };
  }

  private cleanup(key: string): void {
    this.tranchesBought.delete(key);
    this.graduatedAt.delete(key);
  }

  /** Exposed for testing */
  reset(): void {
    this.tranchesBought.clear();
    this.graduatedAt.clear();
  }
}
