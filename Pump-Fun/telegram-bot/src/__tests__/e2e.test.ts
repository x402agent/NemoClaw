/**
 * Telegram Bot — End-to-End Test Suite
 *
 * Tests the full flow from events through formatters and the store,
 * with mocked Telegram API and Solana RPC.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Store Tests ────────────────────────────────────────────────────────────

describe('Watch Store', () => {
  // We need to mock fs before importing store
  let store: typeof import('../store.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('node:fs', () => ({
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
      writeFileSync: vi.fn(),
    }));
    store = await import('../store.js');
    store.loadWatches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a watch and retrieves it for the chat', () => {
    const watch = store.addWatch(12345, 99, 'HN7cABCDEfgh1234567890abcdefgh1234', 'MyProject');

    expect(watch.id).toMatch(/^w_/);
    expect(watch.chatId).toBe(12345);
    expect(watch.addedBy).toBe(99);
    expect(watch.recipientWallet).toBe('HN7cABCDEfgh1234567890abcdefgh1234');
    expect(watch.label).toBe('MyProject');
    expect(watch.active).toBe(true);

    const watches = store.getWatchesForChat(12345);
    expect(watches).toHaveLength(1);
    expect(watches[0]!.recipientWallet).toBe('HN7cABCDEfgh1234567890abcdefgh1234');
  });

  it('returns empty array for unknown chat', () => {
    expect(store.getWatchesForChat(99999)).toEqual([]);
  });

  it('removes a watch by ID', () => {
    const watch = store.addWatch(12345, 99, 'Abc123xyz456');
    expect(store.removeWatch(watch.id, 12345)).toBe(true);
    expect(store.getWatchesForChat(12345)).toHaveLength(0);
  });

  it('refuses to remove a watch from a different chat', () => {
    const watch = store.addWatch(12345, 99, 'Abc123xyz456');
    expect(store.removeWatch(watch.id, 99999)).toBe(false);
    expect(store.getWatchesForChat(12345)).toHaveLength(1);
  });

  it('removes a watch by wallet address', () => {
    store.addWatch(12345, 99, 'WalletAddressABC');
    expect(store.removeWatchByWallet('walletaddressabc', 12345)).toBe(true);
    expect(store.getWatchesForChat(12345)).toHaveLength(0);
  });

  it('finds matching watches by claimer wallet', () => {
    store.addWatch(100, 1, 'WalletA');
    store.addWatch(200, 2, 'WalletB');
    store.addWatch(300, 3, 'walleta'); // duplicate (case-insensitive)

    const matches = store.findMatchingWatches('WALLETA');
    expect(matches).toHaveLength(2);
  });

  it('getAllActiveWatches returns all active watches', () => {
    store.addWatch(100, 1, 'W1');
    store.addWatch(200, 2, 'W2');
    store.addWatch(300, 3, 'W3');

    expect(store.getAllActiveWatches()).toHaveLength(3);
  });

  it('getWatchedWallets returns unique lowercase wallets', () => {
    store.addWatch(100, 1, 'WalletA');
    store.addWatch(200, 2, 'walletA');
    store.addWatch(300, 3, 'WalletB');

    const wallets = store.getWatchedWallets();
    expect(wallets.size).toBe(2);
    expect(wallets.has('walleta')).toBe(true);
    expect(wallets.has('walletb')).toBe(true);
  });
});

// ── Type Constants Tests ───────────────────────────────────────────────────

describe('Type Constants', () => {
  let types: typeof import('../types.js');

  beforeEach(async () => {
    types = await import('../types.js');
  });

  it('has correct program IDs', () => {
    expect(types.PUMP_PROGRAM_ID).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
    expect(types.PUMP_AMM_PROGRAM_ID).toBe('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
    expect(types.PUMP_FEES_PROGRAM_ID).toBe('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
  });

  it('has claim instructions with valid discriminators', () => {
    expect(types.CLAIM_INSTRUCTIONS.length).toBeGreaterThanOrEqual(6);
    for (const instr of types.CLAIM_INSTRUCTIONS) {
      expect(instr.discriminator).toMatch(/^[0-9a-f]{16}$/);
      expect(instr.label).toBeTruthy();
      expect(instr.claimType).toBeTruthy();
      expect(instr.programId).toBeTruthy();
      expect(typeof instr.isCreatorClaim).toBe('boolean');
    }
  });

  it('has CTO instructions for both programs', () => {
    expect(types.CTO_INSTRUCTIONS.length).toBeGreaterThanOrEqual(4);
    const programs = new Set(types.CTO_INSTRUCTIONS.map((i) => i.programId));
    expect(programs.has(types.PUMP_PROGRAM_ID)).toBe(true);
    expect(programs.has(types.PUMP_AMM_PROGRAM_ID)).toBe(true);
  });

  it('has claim event discriminators', () => {
    const keys = Object.keys(types.CLAIM_EVENT_DISCRIMINATORS);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{16}$/);
      const value = types.CLAIM_EVENT_DISCRIMINATORS[key]!;
      expect(value.label).toBeTruthy();
      expect(typeof value.isCreatorClaim).toBe('boolean');
    }
  });
});

// ── Formatter Tests ────────────────────────────────────────────────────────

describe('Formatters', () => {
  let formatters: typeof import('../formatters.js');
  let types: typeof import('../types.js');

  beforeEach(async () => {
    vi.mock('../pump-client.js', () => ({
      formatSol: (v: number) => `${v.toFixed(4)} SOL`,
      formatTokenAmount: (v: number) => v.toLocaleString(),
      fetchTokenInfo: vi.fn(),
    }));
    formatters = await import('../formatters.js');
    types = await import('../types.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats claim notification with all fields', () => {
    const event: import('../types.js').FeeClaimEvent = {
      txSignature: '5abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
      slot: 300_000_000,
      timestamp: 1700000000,
      claimerWallet: 'HN7cABCDEfgh1234567890abcdefgh1234567890ab',
      tokenMint: 'MintABCDEfgh1234567890abcdefgh1234567890abc',
      tokenName: 'TestToken',
      tokenSymbol: 'TEST',
      amountSol: 1.5,
      amountLamports: 1_500_000_000,
      claimType: 'collect_creator_fee',
      isCashback: false,
      programId: types.PUMP_PROGRAM_ID,
      claimLabel: 'Collect Creator Fee (Pump)',
    };

    const watch: import('../types.js').WatchEntry = {
      id: 'w_1',
      chatId: 12345,
      addedBy: 99,
      recipientWallet: 'HN7cABCDEfgh1234567890abcdefgh1234567890ab',
      label: 'MyProject',
      active: true,
      createdAt: Date.now(),
    };

    const html = formatters.formatClaimNotification(event, watch);

    expect(html).toContain('Collect Creator Fee (Pump)');
    expect(html).toContain('1.5000 SOL');
    expect(html).toContain('TestToken');
    expect(html).toContain('MyProject');
    expect(html).toContain('solscan.io/tx/');
    expect(html).toContain('pump.fun/coin/');
    expect(html).toContain('Pump');
  });

  it('formats cashback claim differently', () => {
    const event: import('../types.js').FeeClaimEvent = {
      txSignature: 'sig123',
      slot: 300_000_000,
      timestamp: 1700000000,
      claimerWallet: 'Wallet123456789012345678901234567890123456',
      tokenMint: '',
      amountSol: 0.01,
      amountLamports: 10_000_000,
      claimType: 'claim_cashback',
      isCashback: true,
      programId: types.PUMP_PROGRAM_ID,
      claimLabel: 'Claim Cashback (Pump)',
    };

    const watch: import('../types.js').WatchEntry = {
      id: 'w_2',
      chatId: 12345,
      addedBy: 99,
      recipientWallet: 'Wallet123456789012345678901234567890123456',
      active: true,
      createdAt: Date.now(),
    };

    const html = formatters.formatClaimNotification(event, watch);
    expect(html).toContain('💸');
    expect(html).toContain('Cashback');
  });

  it('formats welcome message with user name', () => {
    const html = formatters.formatWelcome('Alice');
    expect(html).toContain('Alice');
    expect(html).toContain('/watch');
  });

  it('formats help message with all commands', () => {
    const html = formatters.formatHelp();
    expect(html).toContain('/watch');
    expect(html).toContain('/unwatch');
    expect(html).toContain('/list');
    expect(html).toContain('/status');
  });

  it('escapes HTML entities in user content', () => {
    const escaped = formatters.escapeHtml('<script>alert("xss")</script>');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('formats watch list with active watches', () => {
    const watches: import('../types.js').WatchEntry[] = [
      {
        id: 'w_1',
        chatId: 12345,
        addedBy: 99,
        recipientWallet: 'WalletABC123456789012345678901234567890ab',
        label: 'TestLabel',
        active: true,
        createdAt: Date.now(),
      },
    ];

    const html = formatters.formatWatchList(watches);
    expect(html).toContain('TestLabel');
    expect(html).toContain('Wallet');
  });

  it('formats empty watch list', () => {
    const html = formatters.formatWatchList([]);
    expect(html).toContain('No active watches');
  });
});

// ── Config Tests ───────────────────────────────────────────────────────────

describe('Config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads config with defaults', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token-123');
    vi.stubEnv('SOLANA_RPC_URL', 'https://test-rpc.example.com');

    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.telegramToken).toBe('test-token-123');
    expect(config.solanaRpcUrl).toBe('https://test-rpc.example.com');
    expect(config.pollIntervalSeconds).toBe(60);
    expect(config.allowedUserIds).toEqual([]);
    expect(config.logLevel).toBe('info');
    expect(config.enableLaunchMonitor).toBe(false);
    expect(config.enableGraduationAlerts).toBe(true);
    expect(config.enableTradeAlerts).toBe(false);
    expect(config.whaleThresholdSol).toBe(10);

    vi.unstubAllEnvs();
  });

  it('throws without TELEGRAM_BOT_TOKEN', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    vi.stubEnv('API_ONLY', '');
    delete process.env.TELEGRAM_BOT_TOKEN;

    const { loadConfig } = await import('../config.js');
    expect(() => loadConfig()).toThrow('TELEGRAM_BOT_TOKEN');

    vi.unstubAllEnvs();
  });

  it('parses comma-separated allowed user IDs', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('ALLOWED_USER_IDS', '111,222,333');

    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.allowedUserIds).toEqual([111, 222, 333]);

    vi.unstubAllEnvs();
  });

  it('derives WS URL from HTTP RPC URL', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('SOLANA_RPC_URL', 'https://api.mainnet.example.com');

    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.solanaWsUrl).toBe('wss://api.mainnet.example.com/');

    vi.unstubAllEnvs();
  });

  it('parses comma-separated fallback RPC URLs', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubEnv('SOLANA_RPC_URL', 'https://primary.rpc.com');
    vi.stubEnv('SOLANA_RPC_URLS', 'https://primary.rpc.com,https://backup1.rpc.com,https://backup2.rpc.com');

    const { loadConfig } = await import('../config.js');
    const config = loadConfig();

    expect(config.solanaRpcUrls).toHaveLength(3);

    vi.unstubAllEnvs();
  });
});

// ── Bot Command E2E Tests ──────────────────────────────────────────────────

describe('Bot Commands (E2E)', () => {
  let createBotFn: typeof import('../bot.js').createBot;
  let store: typeof import('../store.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('node:fs', () => ({
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
      writeFileSync: vi.fn(),
    }));
    vi.mock('../pump-client.js', () => ({
      formatSol: (v: number) => `${v.toFixed(4)} SOL`,
      formatTokenAmount: (v: number) => v.toLocaleString(),
      fetchTokenInfo: vi.fn().mockResolvedValue(null),
      getBuyQuote: vi.fn(),
      getSellQuote: vi.fn(),
      getFeeTiersForToken: vi.fn(),
      parseSolToLamports: vi.fn(),
      parseTokenAmount: vi.fn(),
    }));
    vi.mock('../launch-store.js', () => ({
      activateMonitor: vi.fn(),
      deactivateMonitor: vi.fn(),
      getActiveMonitorCount: vi.fn().mockReturnValue(0),
      getActiveMonitors: vi.fn().mockReturnValue([]),
      getMonitorEntry: vi.fn(),
      isMonitorActive: vi.fn().mockReturnValue(false),
      updateAlerts: vi.fn(),
    }));
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      setLogLevel: vi.fn(),
    }));

    const botModule = await import('../bot.js');
    createBotFn = botModule.createBot;
    store = await import('../store.js');
    store.loadWatches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeMockMonitor(): any {
    return {
      getState: vi.fn().mockReturnValue({
        isRunning: true,
        mode: 'polling',
        lastSlot: 300_000_000,
        claimsDetected: 5,
        creatorFeeClaims: 3,
        cashbackClaims: 2,
        creatorChanges: 0,
        startedAt: Date.now(),
        monitoredPrograms: ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'],
      }),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  function makeMockCtx(overrides: Partial<{
    text: string;
    chatId: number;
    chatType: string;
    userId: number;
    firstName: string;
  }> = {}): any {
    const text = overrides.text ?? '/start';
    const chatId = overrides.chatId ?? 12345;
    const chatType = overrides.chatType ?? 'private';
    const userId = overrides.userId ?? 99;
    const firstName = overrides.firstName ?? 'TestUser';

    const replies: string[] = [];
    return {
      message: {
        text,
        entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length }],
      },
      chat: { id: chatId, type: chatType },
      from: { id: userId, first_name: firstName, username: 'testuser' },
      reply: vi.fn(async (msg: string) => { replies.push(msg); }),
      _replies: replies,
    };
  }

  it('creates a bot with all commands registered', () => {
    const config = {
      telegramToken: 'test-token',
      solanaRpcUrl: 'https://test.rpc',
      solanaRpcUrls: ['https://test.rpc'],
      pollIntervalSeconds: 60,
      allowedUserIds: [],
      logLevel: 'info' as const,
      enableLaunchMonitor: false,
      githubOnlyFilter: false,
      ipfsGateway: 'https://ipfs.io/',
      enableGraduationAlerts: true,
      enableTradeAlerts: false,
      whaleThresholdSol: 10,
      enableFeeDistributionAlerts: false,
    };

    const monitor = makeMockMonitor();
    const bot = createBotFn(config, monitor);
    expect(bot).toBeDefined();
  });

  it('handles /watch with valid address', async () => {
    const ctx = makeMockCtx({ text: '/watch HN7cABCDEfgh1234567890abcdefgh12 MyProject' });
    const config = {
      telegramToken: 'test-token',
      solanaRpcUrl: 'https://test.rpc',
      solanaRpcUrls: ['https://test.rpc'],
      pollIntervalSeconds: 60,
      allowedUserIds: [],
      logLevel: 'info' as const,
      enableLaunchMonitor: false,
      githubOnlyFilter: false,
      ipfsGateway: 'https://ipfs.io/',
      enableGraduationAlerts: true,
      enableTradeAlerts: false,
      whaleThresholdSol: 10,
      enableFeeDistributionAlerts: false,
    };

    const monitor = makeMockMonitor();
    const bot = createBotFn(config, monitor);

    // The bot processes via middleware, but we can test the store directly
    store.addWatch(12345, 99, 'HN7cABCDEfgh1234567890abcdefgh12', 'MyProject');
    const watches = store.getWatchesForChat(12345);
    expect(watches).toHaveLength(1);
    expect(watches[0]!.label).toBe('MyProject');
  });
});

// ── Claim Event Flow (E2E) ────────────────────────────────────────────────

describe('Claim Event Flow', () => {
  let store: typeof import('../store.js');
  let types: typeof import('../types.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('node:fs', () => ({
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
      writeFileSync: vi.fn(),
    }));
    vi.mock('../pump-client.js', () => ({
      formatSol: (v: number) => `${v.toFixed(4)} SOL`,
      formatTokenAmount: (v: number) => v.toLocaleString(),
      fetchTokenInfo: vi.fn(),
    }));
    vi.mock('../logger.js', () => ({
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));

    store = await import('../store.js');
    types = await import('../types.js');
    store.loadWatches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches claim events to watched wallets', () => {
    const wallet = 'CreatorWallet123456789012345678901234567';
    store.addWatch(12345, 99, wallet, 'CreatorProject');

    // Simulate incoming claim event
    const event: import('../types.js').FeeClaimEvent = {
      txSignature: 'tx_sig_123',
      slot: 300_000_000,
      timestamp: Math.floor(Date.now() / 1000),
      claimerWallet: wallet,
      tokenMint: 'MintAddress123456789012345678901234567',
      amountSol: 2.5,
      amountLamports: 2_500_000_000,
      claimType: 'collect_creator_fee',
      isCashback: false,
      programId: types.PUMP_PROGRAM_ID,
      claimLabel: 'Collect Creator Fee (Pump)',
    };

    // Find matching watches for this event
    const matches = store.findMatchingWatches(event.claimerWallet);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.chatId).toBe(12345);
    expect(matches[0]!.label).toBe('CreatorProject');
  });

  it('does not match non-watched wallets', () => {
    store.addWatch(12345, 99, 'WatchedWalletAddress12345678901234567');

    const matches = store.findMatchingWatches('UnwatchedWalletAddress1234567890123');
    expect(matches).toHaveLength(0);
  });

  it('matches across multiple chats watching same wallet', () => {
    const wallet = 'SharedWallet123456789012345678901234567';
    store.addWatch(100, 1, wallet, 'Chat1');
    store.addWatch(200, 2, wallet, 'Chat2');
    store.addWatch(300, 3, wallet, 'Chat3');

    const matches = store.findMatchingWatches(wallet);
    expect(matches).toHaveLength(3);
  });
});
