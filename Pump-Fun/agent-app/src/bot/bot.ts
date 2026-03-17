/**
 * Pump Fun Agent Tracker Bot — Telegram Bot & Commands
 *
 * Grammy bot with commands:
 *   /start   — Welcome message
 *   /status  — Show tracker stats
 *   /wallet  — Check developer wallet balance
 *   /claims  — Show recent claims summary
 *   /buybacks — Show recent buybacks summary
 *   /help    — Command reference
 *
 * Sends real-time notifications for:
 *   - Agent payments received
 *   - Creator fee claims
 *   - Token buybacks by developer wallet
 */

import { Bot } from 'grammy';
import type { Context } from 'grammy';
import type { AgentMonitor } from './monitor.js';
import type { BotConfig } from './types.js';
import {
    formatBuybackNotification,
    formatClaimNotification,
    formatHelp,
    formatPaymentNotification,
    formatStatus,
    formatWalletBalance,
} from './formatters.js';

export function createBot(config: BotConfig, monitor: AgentMonitor): Bot {
    const bot = new Bot(config.telegramToken);

    // ── /start ────────────────────────────────────────────────────────────

    bot.command('start', async (ctx: Context) => {
        await ctx.reply(
            `<b>Pump Fun Agent Tracker</b>\n\n` +
                `Monitoring agent token:\n<code>${config.agentTokenMint}</code>\n\n` +
                `Developer wallet:\n<code>${config.developerWallet}</code>\n\n` +
                `Use /help for commands.`,
            { parse_mode: 'HTML' },
        );
    });

    // ── /status ───────────────────────────────────────────────────────────

    bot.command('status', async (ctx: Context) => {
        const msg = formatStatus(monitor.state, {
            agentMint: config.agentTokenMint,
            devWallet: config.developerWallet,
        });
        await ctx.reply(msg, { parse_mode: 'HTML' });
    });

    // ── /wallet ───────────────────────────────────────────────────────────

    bot.command('wallet', async (ctx: Context) => {
        try {
            const snapshot = await monitor.getWalletBalance();
            await ctx.reply(formatWalletBalance(snapshot), {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            });
        } catch (err) {
            await ctx.reply('Failed to fetch wallet balance. Try again later.');
        }
    });

    // ── /claims ───────────────────────────────────────────────────────────

    bot.command('claims', async (ctx: Context) => {
        const { totalClaims, totalClaimsSol, lastClaim } = monitor.state;
        let msg = `<b>Claims Summary</b>\n\n`;
        msg += `<b>Total Claims:</b> ${totalClaims}\n`;
        msg += `<b>Total SOL Claimed:</b> ${totalClaimsSol.toFixed(4)} SOL\n`;

        if (lastClaim) {
            msg += `\n<b>Last Claim:</b>\n`;
            msg += formatClaimNotification(lastClaim);
        } else {
            msg += `\nNo claims detected yet.`;
        }

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
    });

    // ── /buybacks ─────────────────────────────────────────────────────────

    bot.command('buybacks', async (ctx: Context) => {
        const { totalBuybacks, totalBuybackSol, lastBuyback } = monitor.state;
        let msg = `<b>Buybacks Summary</b>\n\n`;
        msg += `<b>Total Buybacks:</b> ${totalBuybacks}\n`;
        msg += `<b>Total SOL Spent:</b> ${totalBuybackSol.toFixed(4)} SOL\n`;

        if (lastBuyback) {
            msg += `\n<b>Last Buyback:</b>\n`;
            msg += formatBuybackNotification(lastBuyback);
        } else {
            msg += `\nNo buybacks detected yet.`;
        }

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
    });

    // ── /help ─────────────────────────────────────────────────────────────

    bot.command('help', async (ctx: Context) => {
        await ctx.reply(formatHelp(), { parse_mode: 'HTML' });
    });

    return bot;
}

/**
 * Send a notification to all configured chat IDs.
 * Used by the monitor callbacks to push real-time alerts.
 */
export async function broadcastMessage(
    bot: Bot,
    chatIds: number[],
    message: string,
): Promise<void> {
    for (const chatId of chatIds) {
        try {
            await bot.api.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
            });
        } catch (err) {
            console.error(`[Bot] Failed to send to chat ${chatId}:`, err);
        }
    }
}
