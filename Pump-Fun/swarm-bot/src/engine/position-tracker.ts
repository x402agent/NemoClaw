import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import type { SwarmDb } from '../store/db.js';
import { logger } from '../logger.js';
import type { ExecuteResult } from './executor.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface PositionState {
  mint: string;
  tokenAmount: BN;
  entryAvgPrice: number;
  entrySol: BN;
  currentPrice: number;
  currentValueSol: BN;
  unrealizedPnlSol: number;
  realizedPnlSol: number;
}

/**
 * Tracks positions for a single bot. Records buys, sells, and
 * computes P&L in real-time. Persists to SQLite via SwarmDb.
 */
export class PositionTracker {
  private readonly db: SwarmDb;
  private readonly botId: string;

  constructor(db: SwarmDb, botId: string) {
    this.db = db;
    this.botId = botId;
  }

  /** Record a buy trade and update position */
  recordBuy(mint: string, result: ExecuteResult): void {
    if (!result.success || !result.signature) return;

    // Record the trade
    this.db.insertTrade({
      bot_id: this.botId,
      mint,
      side: 'buy',
      sol_amount: String(result.solAmount.toNumber() / LAMPORTS_PER_SOL),
      token_amount: String(result.tokenAmount.toNumber()),
      price: String(result.price),
      signature: result.signature,
      status: 'confirmed',
    });

    // Update or create position
    const existing = this.db.getPosition(this.botId, mint);
    if (existing) {
      const newTokenAmount = Number(existing.token_amount) + result.tokenAmount.toNumber();
      const newEntrySol = Number(existing.entry_sol) + result.solAmount.toNumber() / LAMPORTS_PER_SOL;
      const newAvgPrice = newEntrySol / newTokenAmount;

      this.db.updatePosition(this.botId, mint, {
        token_amount: String(newTokenAmount),
        entry_sol: String(newEntrySol),
        entry_price: String(newAvgPrice),
        current_price: String(result.price || newAvgPrice),
      });
    } else {
      this.db.insertPosition({
        bot_id: this.botId,
        mint,
        token_amount: String(result.tokenAmount.toNumber()),
        entry_sol: String(result.solAmount.toNumber() / LAMPORTS_PER_SOL),
        entry_price: String(result.price),
      });
    }

    logger.info(`[${this.botId}] Position BUY ${mint.slice(0, 8)}… — ${result.tokenAmount.toString()} tokens @ ${result.price.toFixed(12)}`);
  }

  /** Record a sell trade and update position */
  recordSell(mint: string, result: ExecuteResult): void {
    if (!result.success || !result.signature) return;

    this.db.insertTrade({
      bot_id: this.botId,
      mint,
      side: 'sell',
      sol_amount: String(result.solAmount.toNumber() / LAMPORTS_PER_SOL),
      token_amount: String(result.tokenAmount.toNumber()),
      price: String(result.price),
      signature: result.signature,
      status: 'confirmed',
    });

    const existing = this.db.getPosition(this.botId, mint);
    if (!existing) {
      logger.warn(`[${this.botId}] Sell recorded but no open position for ${mint}`);
      return;
    }

    const existingTokenAmt = Number(existing.token_amount);
    const existingEntrySol = Number(existing.entry_sol);

    const remainingTokens = existingTokenAmt - result.tokenAmount.toNumber();
    const solReceived = result.solAmount.toNumber() / LAMPORTS_PER_SOL;
    const proportionSold = result.tokenAmount.toNumber() / existingTokenAmt;
    const costBasis = existingEntrySol * proportionSold;
    const realizedPnl = solReceived - costBasis;

    if (remainingTokens <= 0) {
      // Position fully closed
      this.db.updatePosition(this.botId, mint, {
        token_amount: '0',
        current_price: String(result.price || 0),
        unrealized_pnl_sol: '0',
        status: 'closed',
      });
      logger.info(`[${this.botId}] Position CLOSED ${mint.slice(0, 8)}… — realized P&L: ${realizedPnl.toFixed(4)} SOL`);
    } else {
      // Partial sell
      const remainingEntrySol = existingEntrySol * (1 - proportionSold);
      this.db.updatePosition(this.botId, mint, {
        token_amount: String(remainingTokens),
        entry_sol: String(remainingEntrySol),
        current_price: String(result.price || Number(existing.current_price)),
      });
      logger.info(`[${this.botId}] Position PARTIAL SELL ${mint.slice(0, 8)}… — ${remainingTokens} tokens remaining, realized: ${realizedPnl.toFixed(4)} SOL`);
    }
  }

  /** Update current prices for all open positions */
  updatePrice(mint: string, currentPrice: number): void {
    const pos = this.db.getPosition(this.botId, mint);
    if (!pos || pos.status !== 'open') return;

    const tokenAmt = Number(pos.token_amount);
    const entrySol = Number(pos.entry_sol);
    const currentValueSol = tokenAmt * currentPrice;
    const unrealizedPnl = currentValueSol - entrySol;

    this.db.updatePosition(this.botId, mint, {
      current_price: String(currentPrice),
      unrealized_pnl_sol: String(unrealizedPnl),
    });
  }

  /** Get all open positions for this bot */
  getOpenPositions(): PositionState[] {
    const positions = this.db.getPositionsByBot(this.botId);
    return positions
      .filter((p: { status: string }) => p.status === 'open')
      .map((p: { mint: string; token_amount: string; entry_price: string; entry_sol: string; current_price: string; unrealized_pnl_sol: string }) => ({
        mint: p.mint,
        tokenAmount: new BN(Number(p.token_amount)),
        entryAvgPrice: Number(p.entry_price),
        entrySol: new BN(Math.floor(Number(p.entry_sol) * LAMPORTS_PER_SOL)),
        currentPrice: Number(p.current_price),
        currentValueSol: new BN(Math.floor(Number(p.token_amount) * Number(p.current_price) * LAMPORTS_PER_SOL)),
        unrealizedPnlSol: Number(p.unrealized_pnl_sol),
        realizedPnlSol: 0,
      }));
  }

  /** Get position for a specific mint */
  getPosition(mint: string): PositionState | null {
    const p = this.db.getPosition(this.botId, mint);
    if (!p || p.status !== 'open') return null;
    return {
      mint: p.mint,
      tokenAmount: new BN(Number(p.token_amount)),
      entryAvgPrice: Number(p.entry_price),
      entrySol: new BN(Math.floor(Number(p.entry_sol) * LAMPORTS_PER_SOL)),
      currentPrice: Number(p.current_price),
      currentValueSol: new BN(Math.floor(Number(p.token_amount) * Number(p.current_price) * LAMPORTS_PER_SOL)),
      unrealizedPnlSol: Number(p.unrealized_pnl_sol),
      realizedPnlSol: 0,
    };
  }

  /** Snapshot current P&L to database */
  snapshotPnl(): void {
    const positions = this.db.getPositionsByBot(this.botId);
    const open = positions.filter((p: { status: string }) => p.status === 'open');
    const totalInvested = open.reduce((s: number, p: { entry_sol: string }) => s + Number(p.entry_sol), 0);
    const totalUnrealized = open.reduce((s: number, p: { unrealized_pnl_sol: string }) => s + Number(p.unrealized_pnl_sol), 0);

    // Count realized from closed positions recently
    const trades = this.db.getTradesByBot(this.botId, 100);
    const sellTrades = trades.filter((t: { side: string }) => t.side === 'sell');
    const totalReturned = sellTrades.reduce((s: number, t: { sol_amount: string }) => s + Number(t.sol_amount), 0);

    this.db.insertPnlSnapshot({
      bot_id: this.botId,
      total_sol_invested: String(totalInvested),
      total_sol_returned: String(totalReturned),
      unrealized_pnl_sol: String(totalUnrealized),
      realized_pnl_sol: String(totalReturned - totalInvested * 0.5), // Rough estimate
      open_positions: open.length,
    });
  }
}
