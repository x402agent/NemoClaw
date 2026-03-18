/**
 * PumpFun Telegram Bot — Telegram Bot & Command Handlers
 *
 * grammý bot setup with /watch, /unwatch, /list, /status, /help,
 * /monitor, and /stopmonitor commands.
 * Works in both personal DMs and group chats.
 */

import { Bot } from 'grammy';
import type { Context } from 'grammy';

import {
    formatClaimNotification,
    formatCreatorChangeNotification,
    formatFeeTiers,
    formatHelp,
    formatMemorySummary,
    formatMonitorActivated,
    formatMonitorDeactivated,
    formatNaturalLanguageHint,
    formatQuote,
    formatStatus,
    formatTokenPrice,
    formatWatchList,
    formatWelcome,
    escapeHtml,
} from './formatters.js';
import type { PumpEventMonitorState, TokenLaunchMonitorState } from './types.js';
import {
    activateMonitor,
    deactivateMonitor,
    getActiveMonitorCount,
    getMonitorEntry,
    isMonitorActive,
    updateAlerts,
} from './launch-store.js';
import { log } from './logger.js';
import type { PumpFunMonitor } from './monitor.js';
import {
    fetchTokenInfo,
    getBuyQuote,
    getFeeTiersForToken,
    getSellQuote,
    parseSolToLamports,
    parseTokenAmount,
} from './pump-client.js';
import {
    addWatch,
    appendConversationMessage,
    findMatchingWatches,
    getConversationMemory,
    getWatchesForChat,
    removeWatch,
    removeWatchByWallet,
    updateConversationMemory,
} from './store.js';
import type { BotConfig, ConversationIntent, CreatorChangeEvent, FeeClaimEvent } from './types.js';

// ============================================================================
// Token Launch Monitor type (optional — may not exist yet)
// ============================================================================

/** Minimal interface for the TokenLaunchMonitor (built by Agent 1). */
export interface TokenLaunchMonitorLike {
    getState(): TokenLaunchMonitorState;
}

/** Minimal interface for the PumpEventMonitor. */
export interface PumpEventMonitorLike {
    getState(): PumpEventMonitorState;
}

// ============================================================================
// Bot Factory
// ============================================================================

export function createBot(
    config: BotConfig,
    monitor: PumpFunMonitor,
    launchMonitor?: TokenLaunchMonitorLike,
    eventMonitor?: PumpEventMonitorLike,
): Bot {
    const bot = new Bot(config.telegramToken);

    bot.use(async (ctx, next) => {
        const chatId = ctx.chat?.id;
        const userId = ctx.from?.id;
        if (chatId && userId && ctx.message?.text && config.enableConversationMemory) {
            appendConversationMessage(chatId, userId, 'user', ctx.message.text, config.conversationMemoryLimit);
        }

        const originalReply = ctx.reply.bind(ctx);
        (ctx as Context & {
            reply: typeof ctx.reply;
        }).reply = (async (...args: Parameters<typeof originalReply>) => {
            const [text] = args;
            if (chatId && userId && config.enableConversationMemory) {
                appendConversationMessage(
                    chatId,
                    userId,
                    'assistant',
                    typeof text === 'string' ? text : String(text),
                    config.conversationMemoryLimit,
                );
            }
            return originalReply(...args);
        }) as typeof ctx.reply;

        await next();
    });

    // ── Auth middleware (optional) ────────────────────────────────────────
    if (config.allowedUserIds.length > 0) {
        bot.use(async (ctx, next) => {
            const userId = ctx.from?.id;
            if (!userId || !config.allowedUserIds.includes(userId)) {
                log.debug('Unauthorized user %d blocked', userId);
                return; // silently ignore
            }
            await next();
        });
    }

    // ── Error handling ───────────────────────────────────────────────────
    bot.catch((err) => {
        log.error('Bot error:', err.error);
    });

    // ── Commands ──────────────────────────────────────────────────────────
    bot.command('start', handleStart);
    bot.command('help', handleHelpCmd);
    bot.command('watch', handleWatch);
    bot.command('unwatch', handleUnwatch);
    bot.command('list', handleList);
    bot.command('status', (ctx) => handleStatus(ctx, monitor, launchMonitor, eventMonitor));
    bot.command('cto', (ctx) => handleCto(ctx, monitor));
    bot.command('alerts', (ctx) => handleAlerts(ctx));
    bot.command('monitor', (ctx) => handleMonitor(ctx));
    bot.command('stopmonitor', (ctx) => handleStopMonitor(ctx));
    bot.command('price', (ctx) => handlePrice(ctx));
    bot.command('curve', (ctx) => handlePrice(ctx)); // alias for /price
    bot.command('fees', (ctx) => handleFees(ctx));
    bot.command('quote', (ctx) => handleQuote(ctx));

    // ── Fallback ─────────────────────────────────────────────────────────
    bot.on('message:text', async (ctx) => {
        const text = ctx.message?.text || '';
        if (text.startsWith('/')) {
            return;
        }

        if (config.enableNaturalLanguage) {
            const handled = await handleNaturalLanguage(ctx, monitor);
            if (handled) {
                return;
            }
        }

        if (ctx.chat.type === 'private') {
            await ctx.reply(formatNaturalLanguageHint(getConversationMemory(ctx.chat.id)), {
                parse_mode: 'HTML',
            });
        }
    });

    return bot;
}

// ============================================================================
// /start
// ============================================================================

async function handleStart(ctx: Context): Promise<void> {
    const name = ctx.from?.first_name || ctx.from?.username || 'there';
    rememberConversationContext(ctx, {
        lastIntent: 'start',
        lastTopic: 'welcome',
    });
    await ctx.reply(formatWelcome(name), { parse_mode: 'HTML' });
}

// ============================================================================
// /help
// ============================================================================

async function handleHelpCmd(ctx: Context): Promise<void> {
    rememberConversationContext(ctx, {
        lastIntent: 'help',
        lastTopic: 'help',
    });
    await ctx.reply(formatHelp(), { parse_mode: 'HTML' });
}

// ============================================================================
// /watch <wallet> [label]
// ============================================================================

async function handleWatch(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /watch

    if (parts.length === 0) {
        await ctx.reply(
            '👁️ <b>Watch a Fee Recipient</b>\n\n' +
            'Usage: <code>/watch &lt;wallet_address&gt; [label]</code>\n\n' +
            'Example:\n' +
            '<code>/watch HN7c...4xYz MyProject</code>\n\n' +
            "The wallet should be the Solana address of the person whose fee claims you want to track.",
            { parse_mode: 'HTML' },
        );
        return;
    }

    const wallet = parts[0];
    const label = parts.slice(1).join(' ') || undefined;

    // Basic Solana address validation (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        await ctx.reply(
            '❌ Invalid Solana wallet address. Must be a base58-encoded public key (32-44 characters).',
        );
        return;
    }

    // Check for duplicates in this chat
    const existing = getWatchesForChat(ctx.chat!.id);
    if (existing.some((w) => w.recipientWallet.toLowerCase() === wallet.toLowerCase())) {
        await ctx.reply('⚠️ This wallet is already being watched in this chat.');
        return;
    }

    const watch = addWatch(ctx.chat!.id, ctx.from!.id, wallet, label);
    rememberConversationContext(ctx, {
        lastIntent: 'watch',
        lastTopic: label ? `watch ${label}` : 'watch wallet',
        lastWallet: wallet,
    });
    const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    const labelStr = label ? ` (<b>${escapeHtml(label)}</b>)` : '';

    await ctx.reply(
        `✅ <b>Watch Added</b>\n\n` +
        `👤 Wallet: <code>${shortWallet}</code>${labelStr}\n` +
        `🔔 You'll be notified when this wallet claims PumpFun fees or cashback.\n\n` +
        `ID: <code>${watch.id}</code>`,
        { parse_mode: 'HTML' },
    );
}

// ============================================================================
// /unwatch <wallet_or_number>
// ============================================================================

async function handleUnwatch(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length === 0) {
        await ctx.reply(
            '🗑️ <b>Remove a Watch</b>\n\n' +
            'Usage: <code>/unwatch &lt;wallet_address_or_list_number&gt;</code>\n\n' +
            'Use /list to see your watches.',
            { parse_mode: 'HTML' },
        );
        return;
    }

    const input = parts[0];
    const chatId = ctx.chat!.id;

    // Try by list number first
    const num = Number.parseInt(input, 10);
    if (!Number.isNaN(num) && num > 0) {
        const watches = getWatchesForChat(chatId);
        if (num <= watches.length) {
            const target = watches[num - 1];
            removeWatch(target.id, chatId);
            rememberConversationContext(ctx, {
                lastIntent: 'unwatch',
                lastTopic: 'remove watch',
                lastWallet: target.recipientWallet,
            });
            const shortW = `${target.recipientWallet.slice(0, 6)}...${target.recipientWallet.slice(-4)}`;
            await ctx.reply(`✅ Removed watch for <code>${shortW}</code>`, {
                parse_mode: 'HTML',
            });
            return;
        }
    }

    // Try by wallet address
    if (removeWatchByWallet(input, chatId)) {
        rememberConversationContext(ctx, {
            lastIntent: 'unwatch',
            lastTopic: 'remove watch',
            lastWallet: input,
        });
        const shortW = `${input.slice(0, 6)}...${input.slice(-4)}`;
        await ctx.reply(`✅ Removed watch for <code>${shortW}</code>`, {
            parse_mode: 'HTML',
        });
    } else {
        await ctx.reply(
            '❌ Watch not found. Use /list to see your active watches.',
        );
    }
}

// ============================================================================
// /cto <mint_or_wallet>
// ============================================================================

async function handleCto(ctx: Context, monitor: PumpFunMonitor): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /cto

    if (parts.length === 0) {
        // Show CTO stats and usage
        const state = monitor.getState();
        const recentEvents = monitor.getRecentCtoEvents();
        let msg =
            '🔀 <b>Creator Takeover (CTO) Monitor</b>\n\n' +
            `📊 <b>CTO Events Detected:</b> ${state.creatorChanges || 0}\n\n`;

        if (recentEvents.length > 0) {
            msg += '<b>Recent CTO Events:</b>\n\n';
            for (const evt of recentEvents.slice(0, 5)) {
                const shortSigner = `${evt.signerWallet.slice(0, 6)}...${evt.signerWallet.slice(-4)}`;
                const shortNew = evt.newCreatorWallet
                    ? `${evt.newCreatorWallet.slice(0, 6)}...${evt.newCreatorWallet.slice(-4)}`
                    : '<i>from metadata</i>';
                const shortMint = evt.tokenMint
                    ? `${evt.tokenMint.slice(0, 6)}...${evt.tokenMint.slice(-4)}`
                    : 'unknown';
                const time = new Date(evt.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19);
                msg += `• <b>${escapeHtml(evt.changeLabel)}</b>\n` +
                    `  Signer: <code>${shortSigner}</code>\n` +
                    `  New Creator: <code>${shortNew}</code>\n` +
                    `  Mint: <code>${shortMint}</code>\n` +
                    `  Time: ${time} UTC\n` +
                    `  <a href="https://solscan.io/tx/${evt.txSignature}">View TX</a>\n\n`;
            }
        } else {
            msg += '<i>No CTO events detected yet. The monitor is watching for creator changes in real-time.</i>\n\n';
        }

        msg += '<b>Usage:</b>\n' +
            '<code>/cto &lt;mint_address&gt;</code> — Look up creator for a token\n' +
            '<code>/cto &lt;wallet_address&gt;</code> — Find CTO events for a wallet\n\n' +
            '<b>What is CTO?</b>\n' +
            'Creator Takeover redirects future creator fees to a new wallet. ' +
            'This can happen via <code>set_creator</code>, <code>admin_set_creator</code>, ' +
            '<code>set_coin_creator</code>, <code>admin_set_coin_creator</code>, or ' +
            '<code>migrate_pool_coin_creator</code>.';

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        return;
    }

    const input = parts[0];
    rememberConversationContext(ctx, {
        lastIntent: 'cto',
        lastTopic: 'creator takeover lookup',
        lastWallet: input,
    });

    // Validate: must be a Solana base58 address (32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) {
        await ctx.reply(
            '❌ Invalid address. Provide a Solana base58-encoded mint or wallet address (32-44 characters).',
        );
        return;
    }

    // Search recent CTO events for this address (as mint, signer, or new creator)
    const recentEvents = monitor.getRecentCtoEvents();
    const inputLower = input.toLowerCase();
    const matching = recentEvents.filter(
        (evt) =>
            evt.tokenMint.toLowerCase() === inputLower ||
            evt.signerWallet.toLowerCase() === inputLower ||
            (evt.newCreatorWallet && evt.newCreatorWallet.toLowerCase() === inputLower),
    );

    if (matching.length === 0) {
        const shortAddr = `${input.slice(0, 6)}...${input.slice(-4)}`;
        await ctx.reply(
            `🔍 <b>No CTO Events Found</b>\n\n` +
            `No recent creator change events involving <code>${shortAddr}</code>.\n\n` +
            `This address hasn't appeared as a signer, new creator, or token mint in any ` +
            `detected CTO transactions since the monitor started.\n\n` +
            `💡 <b>Tip:</b> Add it to your watch list to get notified when CTO events occur:\n` +
            `<code>/watch ${input}</code>`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    // Determine the role of this address
    const asMint = matching.filter((e) => e.tokenMint.toLowerCase() === inputLower);
    const asSigner = matching.filter((e) => e.signerWallet.toLowerCase() === inputLower);
    const asNewCreator = matching.filter(
        (e) => e.newCreatorWallet && e.newCreatorWallet.toLowerCase() === inputLower,
    );

    const shortAddr = `${input.slice(0, 6)}...${input.slice(-4)}`;
    let msg = `🔀 <b>CTO Events for <code>${shortAddr}</code></b>\n\n`;

    if (asMint.length > 0) {
        msg += `🪙 <b>As Token Mint:</b> ${asMint.length} event(s)\n`;
    }
    if (asSigner.length > 0) {
        msg += `✍️ <b>As Signer/Authority:</b> ${asSigner.length} event(s)\n`;
    }
    if (asNewCreator.length > 0) {
        msg += `🆕 <b>As New Creator:</b> ${asNewCreator.length} event(s)\n`;
    }

    msg += '\n';

    for (const evt of matching.slice(0, 8)) {
        const shortSigner = `${evt.signerWallet.slice(0, 6)}...${evt.signerWallet.slice(-4)}`;
        const shortNew = evt.newCreatorWallet
            ? `${evt.newCreatorWallet.slice(0, 6)}...${evt.newCreatorWallet.slice(-4)}`
            : '<i>from metadata</i>';
        const shortMint = evt.tokenMint
            ? `${evt.tokenMint.slice(0, 6)}...${evt.tokenMint.slice(-4)}`
            : 'unknown';
        const time = new Date(evt.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19);
        const program = evt.programId?.includes('pAMM') ? 'PumpSwap' : 'Pump';

        msg += `📝 <b>${escapeHtml(evt.changeLabel)}</b>\n` +
            `  👤 Signer: <code>${shortSigner}</code>\n` +
            `  🆕 New Creator: <code>${shortNew}</code>\n` +
            `  🪙 Mint: <code>${shortMint}</code>\n` +
            `  ⚙️ Program: ${program}\n` +
            `  🕐 ${time} UTC\n` +
            `  🔗 <a href="https://solscan.io/tx/${evt.txSignature}">View TX</a>` +
            (evt.tokenMint ? ` · <a href="https://pump.fun/coin/${evt.tokenMint}">pump.fun</a>` : '') +
            '\n\n';
    }

    if (matching.length > 8) {
        msg += `<i>... and ${matching.length - 8} more event(s)</i>\n`;
    }

    await ctx.reply(msg, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    });
}

// ============================================================================
// /alerts [type] [on|off]
// ============================================================================

async function handleAlerts(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /alerts
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;

    // Valid alert type names
    const ALERT_TYPES: Record<string, keyof import('./launch-store.js').AlertPreferences> = {
        'launches': 'launches',
        'launch': 'launches',
        'graduations': 'graduations',
        'graduation': 'graduations',
        'grad': 'graduations',
        'whales': 'whales',
        'whale': 'whales',
        'trades': 'whales',
        'fees': 'feeDistributions',
        'distributions': 'feeDistributions',
        'dist': 'feeDistributions',
    };

    if (parts.length === 0) {
        // Show current alert preferences
        const entry = getMonitorEntry(chatId);
        const alerts = entry?.alerts ?? { launches: true, graduations: true, whales: true, feeDistributions: true };
        const active = entry?.active ?? false;

        const icon = (on: boolean) => on ? '✅' : '❌';

        await ctx.reply(
            `🔔 <b>Alert Preferences</b>\n\n` +
            `📡 <b>Monitor:</b> ${active ? '✅ Active' : '❌ Inactive'}\n\n` +
            `${icon(alerts.launches)} <b>Token Launches</b> — <code>launches</code>\n` +
            `${icon(alerts.graduations)} <b>Graduations</b> — <code>graduations</code>\n` +
            `${icon(alerts.whales)} <b>Whale Trades</b> — <code>whales</code>\n` +
            `${icon(alerts.feeDistributions)} <b>Fee Distributions</b> — <code>fees</code>\n\n` +
            `<b>Toggle:</b> <code>/alerts &lt;type&gt; on|off</code>\n` +
            `<b>Example:</b> <code>/alerts whales off</code>\n` +
            `<b>All on/off:</b> <code>/alerts all on</code>`,
            { parse_mode: 'HTML' },
        );
        rememberConversationContext(ctx, {
            lastIntent: 'alerts',
            lastTopic: 'alert preferences',
        });
        return;
    }

    const typeName = parts[0].toLowerCase();
    const action = parts[1]?.toLowerCase();

    // Handle /alerts all on|off
    if (typeName === 'all') {
        if (action !== 'on' && action !== 'off') {
            await ctx.reply('Usage: <code>/alerts all on</code> or <code>/alerts all off</code>', { parse_mode: 'HTML' });
            return;
        }
        const value = action === 'on';
        updateAlerts(chatId, userId, {
            feeDistributions: value,
            graduations: value,
            launches: value,
            whales: value,
        });
        await ctx.reply(
            `${value ? '✅' : '❌'} All alert types turned <b>${action}</b>.`,
            { parse_mode: 'HTML' },
        );
        rememberConversationContext(ctx, {
            lastIntent: 'alerts',
            lastTopic: `alerts all ${action}`,
        });
        return;
    }

    const key = ALERT_TYPES[typeName];
    if (!key) {
        await ctx.reply(
            `❌ Unknown alert type: <code>${escapeHtml(typeName)}</code>\n\n` +
            `Valid types: <code>launches</code>, <code>graduations</code>, <code>whales</code>, <code>fees</code>, <code>all</code>`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    if (action !== 'on' && action !== 'off') {
        await ctx.reply(
            `Usage: <code>/alerts ${typeName} on</code> or <code>/alerts ${typeName} off</code>`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    const value = action === 'on';
    updateAlerts(chatId, userId, { [key]: value });
    const label = key === 'feeDistributions' ? 'Fee Distributions' :
        key.charAt(0).toUpperCase() + key.slice(1);
    await ctx.reply(
        `${value ? '✅' : '❌'} <b>${label}</b> alerts turned <b>${action}</b>.`,
        { parse_mode: 'HTML' },
    );
    rememberConversationContext(ctx, {
        lastIntent: 'alerts',
        lastTopic: `${label} alerts ${action}`,
    });
}

// ============================================================================
// /list
// ============================================================================

async function handleList(ctx: Context): Promise<void> {
    const watches = getWatchesForChat(ctx.chat!.id);
    rememberConversationContext(ctx, {
        lastIntent: 'list',
        lastTopic: 'watch list',
    });
    await ctx.reply(formatWatchList(watches), { parse_mode: 'HTML' });
}

// ============================================================================
// /status
// ============================================================================

async function handleStatus(
    ctx: Context,
    monitor: PumpFunMonitor,
    launchMonitor?: TokenLaunchMonitorLike,
    eventMonitor?: PumpEventMonitorLike,
): Promise<void> {
    const watches = getWatchesForChat(ctx.chat!.id);
    const state = monitor.getState();
    const launchState = launchMonitor?.getState();
    const eventState = eventMonitor?.getState();
    const activeMonitors = getActiveMonitorCount();
    await ctx.reply(
        formatStatus(state, watches.length, launchState, activeMonitors, eventState),
        { parse_mode: 'HTML' },
    );
    rememberConversationContext(ctx, {
        lastIntent: 'status',
        lastTopic: 'bot status',
        monitorActive: activeMonitors > 0,
    });
}

// ============================================================================
// /monitor [github]
// ============================================================================

async function handleMonitor(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1); // strip /monitor
    const githubOnly = parts.some((p) => p.toLowerCase() === 'github');

    const existing = getMonitorEntry(ctx.chat!.id);
    const wasActive = existing?.active ?? false;

    activateMonitor(ctx.chat!.id, ctx.from!.id, githubOnly);
    const activeCount = getActiveMonitorCount();
    rememberConversationContext(ctx, {
        githubOnlyFilter: githubOnly,
        lastIntent: 'monitor',
        lastTopic: githubOnly ? 'github-only launch monitor' : 'launch monitor',
        monitorActive: true,
    });

    if (wasActive) {
        log.info(
            'Monitor filter updated for chat %d: githubOnly=%s',
            ctx.chat!.id,
            githubOnly,
        );
    } else {
        log.info(
            'Monitor activated for chat %d: githubOnly=%s',
            ctx.chat!.id,
            githubOnly,
        );
    }

    await ctx.reply(formatMonitorActivated(githubOnly, activeCount), { parse_mode: 'HTML' });
}

// ============================================================================
// /stopmonitor
// ============================================================================

async function handleStopMonitor(ctx: Context): Promise<void> {
    const wasActive = isMonitorActive(ctx.chat!.id);

    if (!wasActive) {
        await ctx.reply(
            'ℹ️ Token launch monitor is not active in this chat.\n' +
            'Start it with: /monitor',
            { parse_mode: 'HTML' },
        );
        return;
    }

    deactivateMonitor(ctx.chat!.id);
    log.info('Monitor stopped by user for chat %d', ctx.chat!.id);
    rememberConversationContext(ctx, {
        lastIntent: 'stopmonitor',
        lastTopic: 'stop launch monitor',
        monitorActive: false,
    });
    await ctx.reply(formatMonitorDeactivated(), { parse_mode: 'HTML' });
}

// ============================================================================
// /price <mint> (also /curve)
// ============================================================================

async function handlePrice(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length === 0) {
        await ctx.reply(
            '\ud83d\udcb0 <b>Token Price Lookup</b>\n\n' +
            'Usage: <code>/price &lt;mint_address&gt;</code>\n\n' +
            'Example:\n' +
            '<code>/price HN7c...4xYz</code>\n\n' +
            'Shows current price, market cap, bonding curve progress, and more.\n' +
            '<code>/curve</code> is an alias for <code>/price</code>.',
            { parse_mode: 'HTML' },
        );
        return;
    }

    const mint = parts[0];

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
        await ctx.reply(
            '\u274c Invalid mint address. Must be a base58-encoded public key (32-44 characters).',
        );
        return;
    }

    await ctx.reply('\u23f3 Looking up token...', { parse_mode: 'HTML' });

    const token = await fetchTokenInfo(mint);
    if (!token) {
        await ctx.reply(
            `\u274c Token not found on PumpFun.\n\n` +
            `The mint address <code>${mint.slice(0, 6)}...${mint.slice(-4)}</code> ` +
            `was not found. Make sure it\'s a PumpFun token mint address.`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    await ctx.reply(formatTokenPrice(token), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    });
    rememberConversationContext(ctx, {
        lastIntent: 'price',
        lastTokenMint: token.mint,
        lastTopic: `price for ${token.symbol}`,
    });
}

// ============================================================================
// /fees <mint>
// ============================================================================

async function handleFees(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length === 0) {
        await ctx.reply(
            '\ud83d\udcb8 <b>Fee Tier Lookup</b>\n\n' +
            'Usage: <code>/fees &lt;mint_address&gt;</code>\n\n' +
            'Shows PumpFun fee tiers and which tier applies to the token based on its market cap.',
            { parse_mode: 'HTML' },
        );
        return;
    }

    const mint = parts[0];

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
        await ctx.reply(
            '\u274c Invalid mint address. Must be a base58-encoded public key (32-44 characters).',
        );
        return;
    }

    const token = await fetchTokenInfo(mint);
    if (!token) {
        await ctx.reply(
            `\u274c Token not found on PumpFun.\n\n` +
            `The mint address <code>${mint.slice(0, 6)}...${mint.slice(-4)}</code> was not found.`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    const tiers = getFeeTiersForToken(token);
    await ctx.reply(formatFeeTiers(token, tiers), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
    });
    rememberConversationContext(ctx, {
        lastIntent: 'fees',
        lastTokenMint: token.mint,
        lastTopic: `fees for ${token.symbol}`,
    });
}

// ============================================================================
// /quote <buy|sell> <mint> <amount>
// ============================================================================

async function handleQuote(ctx: Context): Promise<void> {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length < 3) {
        await ctx.reply(
            '\ud83d\udcca <b>Buy/Sell Quote</b>\n\n' +
            'Usage:\n' +
            '<code>/quote buy &lt;mint&gt; &lt;sol_amount&gt;</code>\n' +
            '<code>/quote sell &lt;mint&gt; &lt;token_amount&gt;</code>\n\n' +
            'Examples:\n' +
            '<code>/quote buy HN7c...4xYz 1.5</code> — Buy with 1.5 SOL\n' +
            '<code>/quote sell HN7c...4xYz 1000</code> — Sell 1000 tokens\n' +
            '<code>/quote sell HN7c...4xYz 1.5M</code> — Sell 1.5 million tokens\n\n' +
            '<i>Amounts: SOL for buys, tokens for sells. Supports K/M suffixes.</i>',
            { parse_mode: 'HTML' },
        );
        return;
    }

    const side = parts[0].toLowerCase();
    const mint = parts[1];
    const amountStr = parts[2];

    if (side !== 'buy' && side !== 'sell') {
        await ctx.reply(
            '\u274c First argument must be <code>buy</code> or <code>sell</code>.\n\n' +
            'Usage: <code>/quote buy|sell &lt;mint&gt; &lt;amount&gt;</code>',
            { parse_mode: 'HTML' },
        );
        return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
        await ctx.reply(
            '\u274c Invalid mint address. Must be a base58-encoded public key (32-44 characters).',
        );
        return;
    }

    const token = await fetchTokenInfo(mint);
    if (!token) {
        await ctx.reply(
            `\u274c Token not found on PumpFun.\n\n` +
            `Mint <code>${mint.slice(0, 6)}...${mint.slice(-4)}</code> was not found.`,
            { parse_mode: 'HTML' },
        );
        return;
    }

    if (token.complete) {
        await ctx.reply(
            `\u26a0\ufe0f <b>${escapeHtml(token.symbol)}</b> has graduated to AMM.\n\n` +
            `Bonding curve quotes are not available for graduated tokens.\n` +
            `Trade on <a href="https://pump.fun/coin/${token.mint}">pump.fun</a> or a DEX aggregator.`,
            { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        );
        return;
    }

    if (side === 'buy') {
        const lamports = parseSolToLamports(amountStr);
        if (lamports === null || lamports <= 0n) {
            await ctx.reply('\u274c Invalid SOL amount. Example: <code>/quote buy &lt;mint&gt; 1.5</code>', { parse_mode: 'HTML' });
            return;
        }
        const quote = getBuyQuote(token, lamports);
        await ctx.reply(formatQuote(quote), {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        rememberConversationContext(ctx, {
            lastIntent: 'quote',
            lastTokenMint: token.mint,
            lastTopic: `buy quote for ${token.symbol}`,
        });
    } else {
        const rawTokens = parseTokenAmount(amountStr);
        if (rawTokens === null || rawTokens <= 0n) {
            await ctx.reply('\u274c Invalid token amount. Example: <code>/quote sell &lt;mint&gt; 1000</code>', { parse_mode: 'HTML' });
            return;
        }
        const quote = getSellQuote(token, rawTokens);
        await ctx.reply(formatQuote(quote), {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
        rememberConversationContext(ctx, {
            lastIntent: 'quote',
            lastTokenMint: token.mint,
            lastTopic: `sell quote for ${token.symbol}`,
        });
    }
}

type NaturalLanguageIntent =
    | { type: 'help' | 'status' | 'list' | 'stopmonitor' | 'memory' | 'greeting' }
    | { type: 'monitor'; githubOnly: boolean }
    | { type: 'watch'; wallet?: string; label?: string }
    | { type: 'unwatch'; target?: string }
    | { type: 'price' | 'fees' | 'cto'; mintOrWallet?: string }
    | { type: 'alerts'; alertType?: string; action?: 'on' | 'off' }
    | { type: 'quote'; side: 'buy' | 'sell'; mint?: string; amount?: string }
    | { type: 'unknown' };

function extractBase58(text: string): string | undefined {
    return text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
}

function extractQuoteAmount(text: string): string | undefined {
    return text.match(/\b\d+(?:\.\d+)?(?:[kKmM])?\b/)?.[0];
}

function parseNaturalLanguageIntent(
    text: string,
    chatId: number,
): NaturalLanguageIntent {
    const lower = text.toLowerCase().trim();
    const memory = getConversationMemory(chatId);
    const rememberedMint = memory?.lastTokenMint;
    const rememberedWallet = memory?.lastWallet;
    const address = extractBase58(text);

    if (/(what do you remember|remember this chat|memory|what did we talk about)/.test(lower)) {
        return { type: 'memory' };
    }
    if (/^(hi|hello|hey|gm|good morning|yo)\b/.test(lower)) {
        return { type: 'greeting' };
    }
    if (/(help|what can you do|commands)/.test(lower)) {
        return { type: 'help' };
    }
    if (/(status|how are things|what'?s running|bot status)/.test(lower)) {
        return { type: 'status' };
    }
    if (/(list watches|watch list|what am i watching|show watches)/.test(lower)) {
        return { type: 'list' };
    }
    if (/(stop monitor|disable monitor|turn off monitor)/.test(lower)) {
        return { type: 'stopmonitor' };
    }
    if (/(start monitor|monitor launches|watch launches|launch monitor)/.test(lower)) {
        return { type: 'monitor', githubOnly: /github/.test(lower) };
    }
    if (/(watch|track|follow).*(wallet|address)/.test(lower) || lower.startsWith('watch ')) {
        const labelMatch = text.match(/\b(?:called|named|label)\s+(.+)$/i);
        return { type: 'watch', wallet: address ?? rememberedWallet, label: labelMatch?.[1]?.trim() };
    }
    if (/(unwatch|stop watching|remove watch)/.test(lower)) {
        const number = text.match(/\b\d+\b/)?.[0];
        return { type: 'unwatch', target: address ?? number ?? rememberedWallet };
    }
    if (/(creator takeover|cto)/.test(lower)) {
        return { type: 'cto', mintOrWallet: address ?? rememberedWallet ?? rememberedMint };
    }
    if (/(alert|alerts)/.test(lower)) {
        const action = /\bon\b/.test(lower) ? 'on' : /\boff\b/.test(lower) ? 'off' : undefined;
        const typeMatch = lower.match(/\b(launches?|graduations?|whales?|fees?|all)\b/);
        return { type: 'alerts', action, alertType: typeMatch?.[1] };
    }
    if (/(price|curve|market cap|how much is|what is .* worth)/.test(lower)) {
        return { type: 'price', mintOrWallet: address ?? rememberedMint };
    }
    if (/\bfees?\b/.test(lower)) {
        return { type: 'fees', mintOrWallet: address ?? rememberedMint };
    }
    if (/\b(quote|buy|sell)\b/.test(lower)) {
        const side: 'buy' | 'sell' = /\bsell\b/.test(lower) ? 'sell' : 'buy';
        return {
            type: 'quote',
            amount: extractQuoteAmount(text),
            mint: address ?? rememberedMint,
            side,
        };
    }

    return { type: 'unknown' };
}

async function invokeHandlerWithText(
    ctx: Context,
    text: string,
    handler: (ctx: Context) => Promise<void>,
): Promise<void> {
    const original = ctx.message?.text;
    if (ctx.message) {
        (ctx.message as { text?: string }).text = text;
    }
    try {
        await handler(ctx);
    } finally {
        if (ctx.message) {
            (ctx.message as { text?: string }).text = original;
        }
    }
}

function rememberConversationContext(
    ctx: Context,
    updates: Partial<{
        githubOnlyFilter: boolean;
        lastIntent: ConversationIntent;
        lastTokenMint: string;
        lastTopic: string;
        lastWallet: string;
        monitorActive: boolean;
    }>,
): void {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    updateConversationMemory(chatId, updates);
}

async function handleNaturalLanguage(
    ctx: Context,
    monitor: PumpFunMonitor,
): Promise<boolean> {
    const chatId = ctx.chat?.id;
    if (!chatId || !ctx.from) return false;

    const intent = parseNaturalLanguageIntent(ctx.message?.text || '', chatId);

    switch (intent.type) {
        case 'greeting': {
            const memory = getConversationMemory(chatId);
            await ctx.reply(
                `👋 I can help with Pump.fun and Solana monitoring in natural language.\n\n${formatNaturalLanguageHint(memory)}`,
                { parse_mode: 'HTML' },
            );
            rememberConversationContext(ctx, {
                lastIntent: 'chat',
                lastTopic: 'greeting',
            });
            return true;
        }
        case 'memory':
            await ctx.reply(formatMemorySummary(getConversationMemory(chatId)), { parse_mode: 'HTML' });
            rememberConversationContext(ctx, {
                lastIntent: 'memory',
                lastTopic: 'memory summary',
            });
            return true;
        case 'help':
            await invokeHandlerWithText(ctx, '/help', handleHelpCmd);
            return true;
        case 'status':
            await ctx.reply(formatStatus(monitor.getState(), getWatchesForChat(chatId).length), { parse_mode: 'HTML' });
            rememberConversationContext(ctx, {
                lastIntent: 'status',
                lastTopic: 'bot status',
            });
            return true;
        case 'list':
            await invokeHandlerWithText(ctx, '/list', handleList);
            return true;
        case 'monitor':
            await invokeHandlerWithText(ctx, intent.githubOnly ? '/monitor github' : '/monitor', handleMonitor);
            return true;
        case 'stopmonitor':
            await invokeHandlerWithText(ctx, '/stopmonitor', handleStopMonitor);
            return true;
        case 'watch':
            if (!intent.wallet) {
                await ctx.reply('I need a Solana wallet address to watch. Example: <code>watch &lt;wallet&gt; my whale</code>', {
                    parse_mode: 'HTML',
                });
                return true;
            }
            await invokeHandlerWithText(
                ctx,
                `/watch ${intent.wallet}${intent.label ? ` ${intent.label}` : ''}`,
                handleWatch,
            );
            return true;
        case 'unwatch':
            if (!intent.target) {
                await ctx.reply('Tell me which watch to remove. Example: <code>unwatch 1</code> or <code>stop watching &lt;wallet&gt;</code>', {
                    parse_mode: 'HTML',
                });
                return true;
            }
            await invokeHandlerWithText(ctx, `/unwatch ${intent.target}`, handleUnwatch);
            return true;
        case 'price':
            if (!intent.mintOrWallet) {
                await ctx.reply(formatNaturalLanguageHint(getConversationMemory(chatId)), { parse_mode: 'HTML' });
                return true;
            }
            await invokeHandlerWithText(ctx, `/price ${intent.mintOrWallet}`, handlePrice);
            return true;
        case 'fees':
            if (!intent.mintOrWallet) {
                await ctx.reply('Tell me which token mint to inspect, or ask about the token we discussed most recently.', {
                    parse_mode: 'HTML',
                });
                return true;
            }
            await invokeHandlerWithText(ctx, `/fees ${intent.mintOrWallet}`, handleFees);
            return true;
        case 'cto':
            if (!intent.mintOrWallet) {
                await ctx.reply('I need a mint or wallet address for CTO lookup.', { parse_mode: 'HTML' });
                return true;
            }
            await invokeHandlerWithText(ctx, `/cto ${intent.mintOrWallet}`, (nextCtx) => handleCto(nextCtx, monitor));
            return true;
        case 'alerts':
            await invokeHandlerWithText(
                ctx,
                intent.alertType && intent.action
                    ? `/alerts ${intent.alertType} ${intent.action}`
                    : '/alerts',
                handleAlerts,
            );
            return true;
        case 'quote':
            if (!intent.mint || !intent.amount) {
                await ctx.reply(
                    'I need both a token mint and an amount. Example: <code>buy quote for &lt;mint&gt; 1.5</code> or <code>sell 250k of this token</code>.',
                    { parse_mode: 'HTML' },
                );
                return true;
            }
            await invokeHandlerWithText(ctx, `/quote ${intent.side} ${intent.mint} ${intent.amount}`, handleQuote);
            return true;
        case 'unknown':
        default:
            return false;
    }
}

// ============================================================================
// Notification Sender
// ============================================================================

/**
 * Called by the monitor when a fee claim is detected.
 * Finds matching watches and sends notifications to the appropriate chats.
 */
export function createClaimHandler(bot: Bot) {
    return async (event: FeeClaimEvent): Promise<void> => {
        const watches = findMatchingWatches(event.claimerWallet);

        if (watches.length === 0) {
            log.debug(
                'Claim by %s — no matching watches',
                event.claimerWallet.slice(0, 8),
            );
            return;
        }

        log.info(
            'Sending %d notifications for claim by %s',
            watches.length,
            event.claimerWallet.slice(0, 8),
        );

        for (const watch of watches) {
            try {
                const text = formatClaimNotification(event, watch);
                await bot.api.sendMessage(watch.chatId, text, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                });
            } catch (err) {
                log.error(
                    'Failed to send notification to chat %d:',
                    watch.chatId,
                    err,
                );
            }
        }
    };
}

/**
 * Called by the monitor when a creator change (CTO) is detected.
 * Finds matching watches (by signer or new creator wallet) and
 * sends notifications to the appropriate chats.
 */
export function createCreatorChangeHandler(bot: Bot) {
    return async (event: CreatorChangeEvent): Promise<void> => {
        // Match watches against the signer, the new creator, or both
        const signerWatches = findMatchingWatches(event.signerWallet);
        const newCreatorWatches = event.newCreatorWallet
            ? findMatchingWatches(event.newCreatorWallet)
            : [];

        // Deduplicate by watch ID (in case same wallet is both signer and new creator)
        const seen = new Set<string>();
        const allWatches = [...signerWatches, ...newCreatorWatches].filter((w) => {
            if (seen.has(w.id)) return false;
            seen.add(w.id);
            return true;
        });

        if (allWatches.length === 0) {
            log.debug(
                'Creator change by %s — no matching watches',
                event.signerWallet.slice(0, 8),
            );
            return;
        }

        log.info(
            'Sending %d CTO notifications for tx %s',
            allWatches.length,
            event.txSignature.slice(0, 12),
        );

        for (const watch of allWatches) {
            try {
                const text = formatCreatorChangeNotification(event, watch);
                await bot.api.sendMessage(watch.chatId, text, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                });
            } catch (err) {
                log.error(
                    'Failed to send CTO notification to chat %d:',
                    watch.chatId,
                    err,
                );
            }
        }
    };
}

// ============================================================================
// Utility
// ============================================================================

// NOTE: escapeHtml is imported from formatters.ts — no duplicate needed here
