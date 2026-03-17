/**
 * Outsiders Bot — End-to-End Test Suite
 *
 * Tests database operations, scoring, token service, formatters,
 * and the full call → ATH tracking → leaderboard flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// ── Scoring Tests ──────────────────────────────────────────────────────────

describe('Scoring (calcPoints & calcRank)', () => {
  let types: typeof import('../types.js');

  beforeEach(async () => {
    types = await import('../types.js');
  });

  it('awards 5 points for >= 30x', () => {
    expect(types.calcPoints(30)).toBe(5);
    expect(types.calcPoints(50)).toBe(5);
    expect(types.calcPoints(100)).toBe(5);
  });

  it('awards 4 points for 15-30x', () => {
    expect(types.calcPoints(15)).toBe(4);
    expect(types.calcPoints(20)).toBe(4);
    expect(types.calcPoints(29.9)).toBe(4);
  });

  it('awards 3 points for 5-15x', () => {
    expect(types.calcPoints(5)).toBe(3);
    expect(types.calcPoints(10)).toBe(3);
    expect(types.calcPoints(14.9)).toBe(3);
  });

  it('awards 2 points for 2-5x', () => {
    expect(types.calcPoints(2)).toBe(2);
    expect(types.calcPoints(3)).toBe(2);
    expect(types.calcPoints(4.9)).toBe(2);
  });

  it('awards 0 points for 1.5-2x', () => {
    expect(types.calcPoints(1.5)).toBe(0);
    expect(types.calcPoints(1.8)).toBe(0);
    expect(types.calcPoints(1.99)).toBe(0);
  });

  it('penalizes -1 point for < 1.5x', () => {
    expect(types.calcPoints(1)).toBe(-1);
    expect(types.calcPoints(0.5)).toBe(-1);
    expect(types.calcPoints(1.49)).toBe(-1);
  });

  it('assigns Oracle rank for >= 70% win rate', () => {
    expect(types.calcRank(70)).toBe('Oracle');
    expect(types.calcRank(100)).toBe('Oracle');
  });

  it('assigns Guru rank for 60-70% win rate', () => {
    expect(types.calcRank(60)).toBe('Guru');
    expect(types.calcRank(69)).toBe('Guru');
  });

  it('assigns Contender rank for 50-60% win rate', () => {
    expect(types.calcRank(50)).toBe('Contender');
    expect(types.calcRank(59)).toBe('Contender');
  });

  it('assigns Novice rank for 40-50% win rate', () => {
    expect(types.calcRank(40)).toBe('Novice');
    expect(types.calcRank(49)).toBe('Novice');
  });

  it('assigns Amateur rank for < 40% win rate', () => {
    expect(types.calcRank(0)).toBe('Amateur');
    expect(types.calcRank(39)).toBe('Amateur');
  });
});

// ── Token Service Tests ────────────────────────────────────────────────────

describe('Token Service (parseTokenInput)', () => {
  let tokenService: typeof import('../token-service.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    tokenService = await import('../token-service.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses raw Solana address', () => {
    const result = tokenService.parseTokenInput('HN7cABCDEfgh1234567890abcdefgh1234');
    expect(result).toEqual({
      address: 'HN7cABCDEfgh1234567890abcdefgh1234',
      chain: 'solana',
    });
  });

  it('parses raw EVM address', () => {
    const result = tokenService.parseTokenInput('0x1234567890abcdef1234567890abcdef12345678');
    expect(result).toEqual({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chain: 'ethereum',
    });
  });

  it('parses DexScreener URL', () => {
    const result = tokenService.parseTokenInput(
      'https://dexscreener.com/solana/HN7cABCDEfgh1234567890abcdefgh1234',
    );
    expect(result).not.toBeNull();
    expect(result!.chain).toBe('solana');
    expect(result!.address).toBe('HN7cABCDEfgh1234567890abcdefgh1234');
  });

  it('parses DexScreener URL for base chain', () => {
    const result = tokenService.parseTokenInput(
      'https://dexscreener.com/base/0x1234567890abcdef1234567890abcdef12345678',
    );
    expect(result).not.toBeNull();
    expect(result!.chain).toBe('base');
  });

  it('parses Birdeye URL', () => {
    const result = tokenService.parseTokenInput(
      'https://birdeye.so/token/HN7cABCDEfgh1234567890abcdefgh1234',
    );
    expect(result).not.toBeNull();
    expect(result!.chain).toBe('solana');
    expect(result!.address).toBe('HN7cABCDEfgh1234567890abcdefgh1234');
  });

  it('parses Solscan URL', () => {
    const result = tokenService.parseTokenInput(
      'https://solscan.io/token/HN7cABCDEfgh1234567890abcdefgh1234',
    );
    expect(result).not.toBeNull();
    expect(result!.chain).toBe('solana');
  });

  it('parses Etherscan URL', () => {
    const result = tokenService.parseTokenInput(
      'https://etherscan.io/token/0x1234567890abcdef1234567890abcdef12345678',
    );
    expect(result).not.toBeNull();
    expect(result!.chain).toBe('ethereum');
  });

  it('returns null for invalid input', () => {
    expect(tokenService.parseTokenInput('not-an-address')).toBeNull();
    expect(tokenService.parseTokenInput('')).toBeNull();
    expect(tokenService.parseTokenInput('abc')).toBeNull();
  });
});

// ── Database Tests ─────────────────────────────────────────────────────────

describe('Database', () => {
  const TEST_DB_PATH = join(process.cwd(), '.test-outsiders.db');
  let db: typeof import('../db.js');

  beforeEach(async () => {
    vi.resetModules();
    // Clean up any leftovers
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    db = await import('../db.js');
    db.initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.closeDb();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    if (existsSync(TEST_DB_PATH + '-wal')) unlinkSync(TEST_DB_PATH + '-wal');
    if (existsSync(TEST_DB_PATH + '-shm')) unlinkSync(TEST_DB_PATH + '-shm');
    vi.restoreAllMocks();
  });

  describe('Users', () => {
    it('upserts a user', () => {
      const user = db.upsertUser(111, 'alice', 'Alice');
      expect(user.telegram_id).toBe(111);
      expect(user.username).toBe('alice');
      expect(user.first_name).toBe('Alice');
      expect(user.points).toBe(0);
    });

    it('updates username on re-upsert', () => {
      db.upsertUser(111, 'alice', 'Alice');
      const user = db.upsertUser(111, 'alice_new', 'Alice');
      expect(user.username).toBe('alice_new');
    });

    it('gets a user by telegram ID', () => {
      db.upsertUser(222, 'bob', 'Bob');
      const user = db.getUser(222);
      expect(user).toBeDefined();
      expect(user!.username).toBe('bob');
    });

    it('returns undefined for non-existent user', () => {
      expect(db.getUser(99999)).toBeUndefined();
    });
  });

  describe('Groups', () => {
    it('upserts a group', () => {
      const group = db.upsertGroup(-100123,  'Test Group');
      expect(group.telegram_id).toBe(-100123);
      expect(group.title).toBe('Test Group');
      expect(group.call_mode).toBe('button');
      expect(group.display_mode).toBe('simple');
      expect(group.hardcore_enabled).toBeFalsy();
    });

    it('updates title on re-upsert', () => {
      db.upsertGroup(-100123, 'Old Title');
      const group = db.upsertGroup(-100123, 'New Title');
      expect(group.title).toBe('New Title');
    });

    it('updates group settings', () => {
      db.upsertGroup(-100456, 'Settings Group');
      db.updateGroupSettings(-100456, { call_mode: 'auto', display_mode: 'advanced' });

      const group = db.getGroup(-100456);
      expect(group!.call_mode).toBe('auto');
      expect(group!.display_mode).toBe('advanced');
    });
  });

  describe('Calls', () => {
    beforeEach(() => {
      db.upsertUser(111, 'alice', 'Alice');
      db.upsertGroup(-100123, 'Alpha Group');
    });

    it('creates a call', () => {
      const call = db.createCall(-100123, 111, 'SolAddress123', 'solana', 'alpha', 50000, 0.0001);
      expect(call.token_address).toBe('SolAddress123');
      expect(call.chain).toBe('solana');
      expect(call.call_type).toBe('alpha');
      expect(call.mcap_at_call).toBe(50000);
      expect(call.multiplier).toBe(1);
      expect(call.finalized).toBeFalsy();
    });

    it('updates ATH when mcap increases', () => {
      const call = db.createCall(-100123, 111, 'Addr1', 'solana', 'alpha', 50000, 0.001);
      db.updateCallAth(call.id, 150000, 0.003);

      const calls = db.getActiveCalls();
      const updated = calls.find((c) => c.id === call.id);
      expect(updated!.ath_mcap).toBe(150000);
      expect(updated!.multiplier).toBe(3); // 150000/50000
    });

    it('does not decrease ATH', () => {
      const call = db.createCall(-100123, 111, 'Addr2', 'solana', 'alpha', 50000, 0.001);
      db.updateCallAth(call.id, 100000, 0.002);
      db.updateCallAth(call.id, 80000, 0.0016); // lower — should NOT update

      const calls = db.getActiveCalls();
      const updated = calls.find((c) => c.id === call.id);
      expect(updated!.ath_mcap).toBe(100000);
    });

    it('finalizes a call', () => {
      const call = db.createCall(-100123, 111, 'Addr3', 'solana', 'alpha', 50000, 0.001);
      db.finalizeCall(call.id);

      const active = db.getActiveCalls();
      expect(active.find((c) => c.id === call.id)).toBeUndefined();
    });

    it('gets active calls', () => {
      db.createCall(-100123, 111, 'Active1', 'solana', 'alpha', 50000, 0.001);
      db.createCall(-100123, 111, 'Active2', 'solana', 'gamble', 30000, 0.0005);

      const active = db.getActiveCalls();
      expect(active).toHaveLength(2);
    });

    it('gets last N calls for a group', () => {
      for (let i = 0; i < 5; i++) {
        db.createCall(-100123, 111, `Token${i}`, 'solana', 'alpha', 50000 + i * 10000, 0.001);
      }

      const last3 = db.getLastCalls(-100123, 3);
      expect(last3).toHaveLength(3);
    });

    it('finds call by token address', () => {
      db.createCall(-100123, 111, 'FindMe', 'solana', 'alpha', 75000, 0.001);

      const call = db.getCallByToken('FindMe', -100123);
      expect(call).toBeDefined();
      expect(call!.token_address).toBe('FindMe');
    });

    it('awards correct points on ATH update', () => {
      const call = db.createCall(-100123, 111, 'PointTest', 'solana', 'alpha', 10000, 0.001);

      // 5x → 3 points
      db.updateCallAth(call.id, 50000, 0.005);
      let user = db.getUser(111);
      expect(user!.points).toBe(3);

      // 20x → 4 points (delta: +1)
      db.updateCallAth(call.id, 200000, 0.02);
      user = db.getUser(111);
      expect(user!.points).toBe(4);
    });
  });

  describe('Leaderboards', () => {
    beforeEach(() => {
      db.upsertUser(111, 'alice', 'Alice');
      db.upsertUser(222, 'bob', 'Bob');
      db.upsertGroup(-100123, 'Leaderboard Group');

      // Alice: 2 calls, one 10x, one 3x
      const call1 = db.createCall(-100123, 111, 'T1', 'solana', 'alpha', 10000, 0.001);
      db.updateCallAth(call1.id, 100000, 0.01);
      const call2 = db.createCall(-100123, 111, 'T2', 'solana', 'alpha', 20000, 0.002);
      db.updateCallAth(call2.id, 60000, 0.006);

      // Bob: 1 call, 50x
      const call3 = db.createCall(-100123, 222, 'T3', 'solana', 'gamble', 5000, 0.0005);
      db.updateCallAth(call3.id, 250000, 0.025);
    });

    it('gets calls leaderboard sorted by multiplier', () => {
      const lb = db.getCallsLeaderboard(-100123, 'all');
      expect(lb.length).toBeGreaterThanOrEqual(2);
      expect(lb[0]!.value).toBe(50); // Bob's 50x call
    });

    it('gets performance leaderboard sorted by points', () => {
      const lb = db.getPerformanceLeaderboard(-100123, 'all');
      expect(lb.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('User Stats', () => {
    beforeEach(() => {
      db.upsertUser(111, 'alice', 'Alice');
      db.upsertGroup(-100123, 'Stats Group');

      // Create calls with various multipliers
      const c1 = db.createCall(-100123, 111, 'S1', 'solana', 'alpha', 10000, 0.001);
      db.updateCallAth(c1.id, 30000, 0.003); // 3x → win
      const c2 = db.createCall(-100123, 111, 'S2', 'solana', 'alpha', 20000, 0.002);
      db.updateCallAth(c2.id, 25000, 0.0025); // 1.25x → loss
      const c3 = db.createCall(-100123, 111, 'S3', 'solana', 'alpha', 15000, 0.0015);
      db.updateCallAth(c3.id, 75000, 0.0075); // 5x → win
    });

    it('calculates user stats correctly', () => {
      const stats = db.getUserStats(111);
      expect(stats.totalCalls).toBe(3);
      expect(stats.wins).toBe(2); // 3x and 5x are >= 2x
      expect(stats.winRate).toBeCloseTo(66.7, 0);
      expect(stats.bestMultiplier).toBe(5);
      expect(stats.rank).toBe('Guru'); // 66.7% → Guru
    });

    it('calculates stats per group', () => {
      const stats = db.getUserStats(111, -100123);
      expect(stats.totalCalls).toBe(3);
    });
  });

  describe('Blocked Users', () => {
    beforeEach(() => {
      db.upsertGroup(-100123, 'Block Group');
    });

    it('blocks a user', () => {
      db.blockUser(-100123, 999);
      expect(db.isBlocked(-100123, 999)).toBe(true);
    });

    it('unblocks a user', () => {
      db.blockUser(-100123, 999);
      db.unblockUser(-100123, 999);
      expect(db.isBlocked(-100123, 999)).toBe(false);
    });

    it('does not block across groups', () => {
      db.upsertGroup(-100456, 'Other Group');
      db.blockUser(-100123, 888);
      expect(db.isBlocked(-100456, 888)).toBe(false);
    });
  });

  describe('Wipe Leaderboard', () => {
    it('wipes all calls for a group', () => {
      db.upsertUser(111, 'alice', 'Alice');
      db.upsertGroup(-100123, 'Wipe Group');
      db.createCall(-100123, 111, 'W1', 'solana', 'alpha', 10000, 0.001);
      db.createCall(-100123, 111, 'W2', 'solana', 'alpha', 20000, 0.002);

      const deleted = db.wipeLeaderboard(-100123);
      expect(deleted).toBe(2);

      const calls = db.getLastCalls(-100123, 10);
      expect(calls).toHaveLength(0);
    });
  });
});

// ── Formatter Tests ────────────────────────────────────────────────────────

describe('Formatters', () => {
  let formatters: typeof import('../formatters.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    formatters = await import('../formatters.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats simple call prompt', () => {
    const token: import('../types.js').TokenInfo = {
      address: 'TokenTest123',
      chain: 'solana',
      name: 'TestCoin',
      symbol: 'TST',
      price: 0.0001,
      mcap: 50000,
      liquidity: 25000,
      volume24h: 10000,
      pairAge: 3600,
    };

    const html = formatters.formatCallSimple(token, 'alpha', 'Alice');
    expect(html).toContain('ALPHA');
    expect(html).toContain('Alice');
    expect(html).toContain('TestCoin');
    expect(html).toContain('50.00K');
    expect(html).toContain('TokenTest123');
  });

  it('formats advanced call prompt with extra fields', () => {
    const token: import('../types.js').TokenInfo = {
      address: 'AdvToken123',
      chain: 'solana',
      name: 'AdvCoin',
      symbol: 'ADV',
      price: 0.05,
      mcap: 1_000_000,
      liquidity: 500_000,
      volume24h: 200_000,
      pairAge: 7200,
    };

    const html = formatters.formatCallAdvanced(token, 'gamble', 'Bob');
    expect(html).toContain('GAMBLE');
    expect(html).toContain('Bob');
    expect(html).toContain('Liquidity');
    expect(html).toContain('Volume');
    expect(html).toContain('solana');
  });

  it('formats calls leaderboard', () => {
    const entries: import('../types.js').LeaderboardEntry[] = [
      { rank: 1, username: 'alice', telegramId: 111, value: 50, callCount: 3, winRate: 75, avgGain: 15 },
      { rank: 2, username: 'bob', telegramId: 222, value: 20, callCount: 5, winRate: 60, avgGain: 8 },
    ];

    const html = formatters.formatCallsLeaderboard(entries, '24h');
    expect(html).toContain('Top Calls');
    expect(html).toContain('🥇');
    expect(html).toContain('alice');
    expect(html).toContain('50.0x');
    expect(html).toContain('🥈');
    expect(html).toContain('bob');
  });

  it('formats performance leaderboard', () => {
    const entries: import('../types.js').LeaderboardEntry[] = [
      { rank: 1, username: 'alice', telegramId: 111, value: 15, callCount: 5, winRate: 80, avgGain: 10 },
    ];

    const html = formatters.formatPerformanceLeaderboard(entries, 'all');
    expect(html).toContain('Performance Leaderboard');
    expect(html).toContain('15 pts');
    expect(html).toContain('80%');
  });

  it('formats empty leaderboard', () => {
    expect(formatters.formatCallsLeaderboard([], '7d')).toContain('No calls found');
    expect(formatters.formatPerformanceLeaderboard([], '7d')).toContain('No performance data');
  });

  it('formats user stats', () => {
    const stats = {
      totalCalls: 10,
      wins: 7,
      winRate: 70,
      avgGain: 5.5,
      totalPoints: 25,
      bestMultiplier: 30,
      rank: 'Oracle' as const,
    };

    const html = formatters.formatUserStats('alice', stats);
    expect(html).toContain('alice');
    expect(html).toContain('Oracle');
    expect(html).toContain('70%');
    expect(html).toContain('10');
    expect(html).toContain('30.0x');
  });

  it('formats PNL text', () => {
    const call: import('../types.js').DbCall = {
      id: 1,
      group_id: 1,
      user_id: 1,
      token_address: 'PNL_Token',
      chain: 'solana',
      call_type: 'alpha',
      mcap_at_call: 50000,
      price_at_call: 0.001,
      ath_mcap: 250000,
      ath_price: 0.005,
      ath_at: '2024-01-15',
      multiplier: 5,
      points_awarded: 3,
      finalized: true,
      created_at: '2024-01-10',
    };

    const html = formatters.formatPnlText(call, 'PNL Coin', 'Alice');
    expect(html).toContain('PNL Coin');
    expect(html).toContain('Alice');
    expect(html).toContain('5.0x');
    expect(html).toContain('$50.00K');
    expect(html).toContain('$250.00K');
  });

  it('formats settings', () => {
    const html = formatters.formatSettings('auto', 'advanced', true, 55, 5);
    expect(html).toContain('auto');
    expect(html).toContain('advanced');
    expect(html).toContain('ON');
    expect(html).toContain('55%');
  });

  it('formats hardcore status', () => {
    const statuses: import('../db.js').HardcoreStatus[] = [
      { username: 'alice', telegramId: 111, calls: 10, winRate: 65, atRisk: false },
      { username: 'bob', telegramId: 222, calls: 8, winRate: 40, atRisk: true },
    ];

    const html = formatters.formatHardcoreStatus(statuses, 55);
    expect(html).toContain('🟢');
    expect(html).toContain('🔴');
    expect(html).toContain('alice');
    expect(html).toContain('bob');
  });
});

// ── ATH Tracker Tests ──────────────────────────────────────────────────────

describe('ATH Tracker', () => {
  const TEST_DB_PATH = join(process.cwd(), '.test-ath-tracker.db');
  let db: typeof import('../db.js');
  let athTracker: typeof import('../ath-tracker.js');

  beforeEach(async () => {
    vi.resetModules();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.mock('../token-service.js', () => ({
      fetchTokenInfo: vi.fn().mockResolvedValue({
        address: 'Test123',
        chain: 'solana',
        name: 'Test',
        symbol: 'TST',
        price: 0.01,
        mcap: 200_000,
        liquidity: 100_000,
        volume24h: 50_000,
        pairAge: 1000,
      }),
      parseTokenInput: vi.fn(),
      setApiBase: vi.fn(),
    }));
    db = await import('../db.js');
    db.initDb(TEST_DB_PATH);
    athTracker = await import('../ath-tracker.js');
  });

  afterEach(() => {
    athTracker.stopAthTracker();
    db.closeDb();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    if (existsSync(TEST_DB_PATH + '-wal')) unlinkSync(TEST_DB_PATH + '-wal');
    if (existsSync(TEST_DB_PATH + '-shm')) unlinkSync(TEST_DB_PATH + '-shm');
    vi.restoreAllMocks();
  });

  it('starts and stops ATH tracker', () => {
    athTracker.startAthTracker(60);
    // Should not throw when stopping
    athTracker.stopAthTracker();
  });
});

// ── Full E2E Flow Tests ────────────────────────────────────────────────────

describe('Full Call E2E Flow', () => {
  const TEST_DB_PATH = join(process.cwd(), '.test-e2e-flow.db');
  let db: typeof import('../db.js');
  let types: typeof import('../types.js');
  let formatters: typeof import('../formatters.js');

  beforeEach(async () => {
    vi.resetModules();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    db = await import('../db.js');
    types = await import('../types.js');
    formatters = await import('../formatters.js');
    db.initDb(TEST_DB_PATH);
  });

  afterEach(() => {
    db.closeDb();
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    if (existsSync(TEST_DB_PATH + '-wal')) unlinkSync(TEST_DB_PATH + '-wal');
    if (existsSync(TEST_DB_PATH + '-shm')) unlinkSync(TEST_DB_PATH + '-shm');
    vi.restoreAllMocks();
  });

  it('full flow: user joins → makes call → ATH updates → leaderboard', () => {
    // Step 1: User and group setup
    const user = db.upsertUser(111, 'alpha_caller', 'Alpha');
    const group = db.upsertGroup(-100999, 'Trading Group');
    expect(user.telegram_id).toBe(111);
    expect(group.telegram_id).toBe(-100999);

    // Step 2: User makes an alpha call
    const call = db.createCall(-100999, 111, 'NewToken123', 'solana', 'alpha', 25000, 0.0025);
    expect(call.mcap_at_call).toBe(25000);
    expect(call.multiplier).toBe(1);

    // Step 3: ATH updates over time
    db.updateCallAth(call.id, 50000, 0.005);  // 2x
    db.updateCallAth(call.id, 125000, 0.0125); // 5x
    db.updateCallAth(call.id, 250000, 0.025);  // 10x
    db.updateCallAth(call.id, 200000, 0.02);   // lower — should NOT update ATH

    // Step 4: Verify ATH is correct
    const active = db.getActiveCalls();
    const updatedCall = active.find((c) => c.id === call.id);
    expect(updatedCall!.ath_mcap).toBe(250000);
    expect(updatedCall!.multiplier).toBe(10); // 250000/25000

    // Step 5: Points awarded correctly (10x → 3 pts)
    const userAfter = db.getUser(111);
    expect(userAfter!.points).toBe(types.calcPoints(10)); // 3

    // Step 6: Leaderboard shows the call
    const lb = db.getCallsLeaderboard(-100999, 'all');
    expect(lb).toHaveLength(1);
    expect(lb[0]!.value).toBe(10);

    // Step 7: User stats reflect the call
    const stats = db.getUserStats(111, -100999);
    expect(stats.totalCalls).toBe(1);
    expect(stats.bestMultiplier).toBe(10);
    expect(stats.wins).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.rank).toBe('Oracle');

    // Step 8: Format the leaderboard
    const html = formatters.formatCallsLeaderboard(lb, 'all');
    expect(html).toContain('10.0x');

    // Step 9: Finalize the call
    db.finalizeCall(call.id);
    expect(db.getActiveCalls()).toHaveLength(0);
  });

  it('multi-user competition flow', () => {
    db.upsertUser(111, 'alice', 'Alice');
    db.upsertUser(222, 'bob', 'Bob');
    db.upsertUser(333, 'charlie', 'Charlie');
    db.upsertGroup(-100999, 'Competition Group');

    // Alice: 2x call
    const a = db.createCall(-100999, 111, 'TokenA', 'solana', 'alpha', 50000, 0.005);
    db.updateCallAth(a.id, 100000, 0.01);

    // Bob: 20x call
    const b = db.createCall(-100999, 222, 'TokenB', 'solana', 'gamble', 10000, 0.001);
    db.updateCallAth(b.id, 200000, 0.02);

    // Charlie: 0.5x call (loss)
    const c = db.createCall(-100999, 333, 'TokenC', 'ethereum', 'alpha', 100000, 0.01);
    // No ATH update — stays at 1x entry

    // Calls leaderboard
    const callsLb = db.getCallsLeaderboard(-100999, 'all');
    expect(callsLb[0]!.username).toBe('bob'); // 20x
    expect(callsLb[0]!.value).toBe(20);

    // Performance leaderboard
    const perfLb = db.getPerformanceLeaderboard(-100999, 'all');
    expect(perfLb.length).toBe(3);

    // Stats per user
    expect(db.getUserStats(111).rank).toBe('Oracle'); // 100% WR (1 win out of 1)
    expect(db.getUserStats(222).rank).toBe('Oracle'); // 100% WR
    expect(db.getUserStats(333).rank).toBe('Amateur'); // 0% WR
  });
});
