import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { log } from '../logger.js';

export interface BotRow {
  id: string;
  name: string;
  strategy: string;
  status: 'running' | 'stopped' | 'error';
  wallet_pubkey: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface PositionRow {
  id: number;
  bot_id: string;
  mint: string;
  token_amount: string;
  entry_sol: string;
  entry_price: string;
  current_price: string;
  unrealized_pnl_sol: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  exit_sol: string | null;
}

export interface TradeRow {
  id: number;
  bot_id: string;
  mint: string;
  side: 'buy' | 'sell';
  sol_amount: string;
  token_amount: string;
  price: string;
  signature: string;
  status: 'pending' | 'confirmed' | 'failed';
  error: string | null;
  created_at: string;
}

export interface PnlSnapshotRow {
  id: number;
  bot_id: string;
  total_sol_invested: string;
  total_sol_returned: string;
  unrealized_pnl_sol: string;
  realized_pnl_sol: string;
  open_positions: number;
  snapshot_at: string;
}

export class SwarmDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    log.info('Database initialized at %s', dbPath);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'stopped',
        wallet_pubkey TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        mint TEXT NOT NULL,
        token_amount TEXT NOT NULL DEFAULT '0',
        entry_sol TEXT NOT NULL DEFAULT '0',
        entry_price TEXT NOT NULL DEFAULT '0',
        current_price TEXT NOT NULL DEFAULT '0',
        unrealized_pnl_sol TEXT NOT NULL DEFAULT '0',
        status TEXT NOT NULL DEFAULT 'open',
        opened_at TEXT NOT NULL DEFAULT (datetime('now')),
        closed_at TEXT,
        exit_sol TEXT
      );

      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        mint TEXT NOT NULL,
        side TEXT NOT NULL,
        sol_amount TEXT NOT NULL,
        token_amount TEXT NOT NULL,
        price TEXT NOT NULL DEFAULT '0',
        signature TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pnl_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        total_sol_invested TEXT NOT NULL DEFAULT '0',
        total_sol_returned TEXT NOT NULL DEFAULT '0',
        unrealized_pnl_sol TEXT NOT NULL DEFAULT '0',
        realized_pnl_sol TEXT NOT NULL DEFAULT '0',
        open_positions INTEGER NOT NULL DEFAULT 0,
        snapshot_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_positions_bot ON positions(bot_id, status);
      CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(bot_id);
      CREATE INDEX IF NOT EXISTS idx_trades_sig ON trades(signature);
      CREATE INDEX IF NOT EXISTS idx_pnl_bot ON pnl_snapshots(bot_id, snapshot_at);
    `);
  }

  // ── Bots ────────────────────────────────────────────────────────────

  insertBot(bot: Omit<BotRow, 'created_at' | 'updated_at'>): void {
    this.db.prepare(`
      INSERT INTO bots (id, name, strategy, status, wallet_pubkey, config_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(bot.id, bot.name, bot.strategy, bot.status, bot.wallet_pubkey, bot.config_json);
  }

  /** Update specific bot fields */
  updateBot(id: string, updates: Partial<Pick<BotRow, 'status' | 'name' | 'strategy' | 'config_json'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.strategy !== undefined) { fields.push('strategy = ?'); values.push(updates.strategy); }
    if (updates.config_json !== undefined) { fields.push('config_json = ?'); values.push(updates.config_json); }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    this.db.prepare(`UPDATE bots SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  updateBotStatus(id: string, status: BotRow['status']): void {
    this.db.prepare(`
      UPDATE bots SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id);
  }

  updateBotConfig(id: string, configJson: string): void {
    this.db.prepare(`
      UPDATE bots SET config_json = ?, updated_at = datetime('now') WHERE id = ?
    `).run(configJson, id);
  }

  getBot(id: string): BotRow | undefined {
    return this.db.prepare('SELECT * FROM bots WHERE id = ?').get(id) as BotRow | undefined;
  }

  getAllBots(): BotRow[] {
    return this.db.prepare('SELECT * FROM bots ORDER BY created_at DESC').all() as BotRow[];
  }

  deleteBot(id: string): void {
    this.db.prepare('DELETE FROM bots WHERE id = ?').run(id);
  }

  // ── Positions ───────────────────────────────────────────────────────

  insertPosition(pos: { bot_id: string; mint: string; token_amount: string; entry_sol: string; entry_price: string }): number {
    const result = this.db.prepare(`
      INSERT INTO positions (bot_id, mint, token_amount, entry_sol, entry_price, current_price, unrealized_pnl_sol)
      VALUES (?, ?, ?, ?, ?, ?, '0')
    `).run(pos.bot_id, pos.mint, pos.token_amount, pos.entry_sol, pos.entry_price);
    return Number(result.lastInsertRowid);
  }

  updatePositionPrice(id: number, currentPrice: string, unrealizedPnl: string): void {
    this.db.prepare(`
      UPDATE positions SET current_price = ?, unrealized_pnl_sol = ? WHERE id = ?
    `).run(currentPrice, unrealizedPnl, id);
  }

  closePosition(id: number, exitSol: string): void {
    this.db.prepare(`
      UPDATE positions SET status = 'closed', closed_at = datetime('now'), exit_sol = ? WHERE id = ?
    `).run(exitSol, id);
  }

  getOpenPositions(botId: string): PositionRow[] {
    return this.db.prepare(
      'SELECT * FROM positions WHERE bot_id = ? AND status = ? ORDER BY opened_at DESC'
    ).all(botId, 'open') as PositionRow[];
  }

  getAllPositions(botId: string, limit = 100): PositionRow[] {
    return this.db.prepare(
      'SELECT * FROM positions WHERE bot_id = ? ORDER BY opened_at DESC LIMIT ?'
    ).all(botId, limit) as PositionRow[];
  }

  getOpenPositionByMint(botId: string, mint: string): PositionRow | undefined {
    return this.db.prepare(
      'SELECT * FROM positions WHERE bot_id = ? AND mint = ? AND status = ?'
    ).get(botId, mint, 'open') as PositionRow | undefined;
  }

  /** Get open position for a bot + mint (alias used by PositionTracker) */
  getPosition(botId: string, mint: string): PositionRow | undefined {
    return this.getOpenPositionByMint(botId, mint);
  }

  /** Update arbitrary fields on an open position for a bot + mint */
  updatePosition(botId: string, mint: string, updates: Partial<Omit<PositionRow, 'id' | 'bot_id' | 'mint' | 'opened_at'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(String(val));
    }
    if (fields.length === 0) return;
    values.push(botId, mint, 'open');
    this.db.prepare(
      `UPDATE positions SET ${fields.join(', ')} WHERE bot_id = ? AND mint = ? AND status = ?`
    ).run(...values);
  }

  /** Get all positions for a bot (open + closed) */
  getPositionsByBot(botId: string, limit = 100): PositionRow[] {
    return this.getAllPositions(botId, limit);
  }

  // ── Trades ──────────────────────────────────────────────────────────

  insertTrade(trade: { bot_id: string; mint: string; side: 'buy' | 'sell'; sol_amount: string; token_amount: string; price: string; signature: string; status: string }): number {
    const result = this.db.prepare(`
      INSERT INTO trades (bot_id, mint, side, sol_amount, token_amount, price, signature, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trade.bot_id, trade.mint, trade.side, trade.sol_amount, trade.token_amount, trade.price, trade.signature, trade.status);
    return Number(result.lastInsertRowid);
  }

  updateTradeStatus(id: number, status: TradeRow['status'], error?: string): void {
    this.db.prepare(`
      UPDATE trades SET status = ?, error = ? WHERE id = ?
    `).run(status, error ?? null, id);
  }

  updateTradeSignature(id: number, signature: string): void {
    this.db.prepare(`
      UPDATE trades SET signature = ? WHERE id = ?
    `).run(signature, id);
  }

  getRecentTrades(botId: string, limit = 50): TradeRow[] {
    return this.db.prepare(
      'SELECT * FROM trades WHERE bot_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(botId, limit) as TradeRow[];
  }

  /** Alias used by PositionTracker */
  getTradesByBot(botId: string, limit = 50): TradeRow[] {
    return this.getRecentTrades(botId, limit);
  }

  getAllRecentTrades(limit = 100): TradeRow[] {
    return this.db.prepare(
      'SELECT * FROM trades ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as TradeRow[];
  }

  // ── PnL Snapshots ──────────────────────────────────────────────────

  insertPnlSnapshot(snap: Omit<PnlSnapshotRow, 'id' | 'snapshot_at'>): void {
    this.db.prepare(`
      INSERT INTO pnl_snapshots (bot_id, total_sol_invested, total_sol_returned, unrealized_pnl_sol, realized_pnl_sol, open_positions)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(snap.bot_id, snap.total_sol_invested, snap.total_sol_returned, snap.unrealized_pnl_sol, snap.realized_pnl_sol, snap.open_positions);
  }

  getLatestPnlSnapshot(botId: string): PnlSnapshotRow | undefined {
    return this.db.prepare(
      'SELECT * FROM pnl_snapshots WHERE bot_id = ? ORDER BY snapshot_at DESC LIMIT 1'
    ).get(botId) as PnlSnapshotRow | undefined;
  }

  getPnlHistory(botId: string, limit = 288): PnlSnapshotRow[] {
    return this.db.prepare(
      'SELECT * FROM pnl_snapshots WHERE bot_id = ? ORDER BY snapshot_at DESC LIMIT ?'
    ).all(botId, limit) as PnlSnapshotRow[];
  }

  // ── Aggregates ──────────────────────────────────────────────────────

  getGlobalStats(): { totalBots: number; runningBots: number; openPositions: number; totalTrades: number } {
    const bots = this.db.prepare('SELECT COUNT(*) as c FROM bots').get() as { c: number };
    const running = this.db.prepare("SELECT COUNT(*) as c FROM bots WHERE status = 'running'").get() as { c: number };
    const positions = this.db.prepare("SELECT COUNT(*) as c FROM positions WHERE status = 'open'").get() as { c: number };
    const trades = this.db.prepare('SELECT COUNT(*) as c FROM trades').get() as { c: number };
    return {
      totalBots: bots.c,
      runningBots: running.c,
      openPositions: positions.c,
      totalTrades: trades.c,
    };
  }

  close(): void {
    this.db.close();
  }
}
