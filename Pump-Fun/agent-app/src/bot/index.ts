/**
 * Pump Fun Agent Tracker Bot — Entry Point
 *
 * Starts the Telegram bot and on-chain monitor together.
 * Configure via .env or environment variables.
 *
 * Usage:
 *   npx tsx src/bot/index.ts
 *   npm run bot
 */

import 'dotenv/config';
import { createBot, broadcastMessage } from './bot.js';
import { AgentMonitor } from './monitor.js';
import {
    formatPaymentNotification,
    formatClaimNotification,
    formatBuybackNotification,
} from './formatters.js';
import type { BotConfig } from './types.js';

function loadConfig(): BotConfig {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
        console.error('TELEGRAM_BOT_TOKEN is required. Get one from @BotFather on Telegram.');
        process.exit(1);
    }

    const agentTokenMint = process.env.AGENT_TOKEN_MINT_ADDRESS;
    if (!agentTokenMint) {
        console.error('AGENT_TOKEN_MINT_ADDRESS is required.');
        process.exit(1);
    }

    const developerWallet = process.env.DEVELOPER_WALLET;
    if (!developerWallet) {
        console.error('DEVELOPER_WALLET is required for tracking claims and buybacks.');
        process.exit(1);
    }

    const notifyChatIds = (process.env.TELEGRAM_NOTIFY_CHAT_IDS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !isNaN(n));

    return {
        telegramToken,
        solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://rpc.solanatracker.io/public',
        agentTokenMint,
        developerWallet,
        notifyChatIds,
        pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS) || 30,
    };
}

async function main() {
    const config = loadConfig();

    console.log('=== Pump Fun Agent Tracker Bot ===');
    console.log(`Agent mint:  ${config.agentTokenMint}`);
    console.log(`Dev wallet:  ${config.developerWallet}`);
    console.log(`Notify chats: ${config.notifyChatIds.join(', ') || '(none — use /start in bot DM)'}`);
    console.log(`Poll interval: ${config.pollIntervalSeconds}s`);

    // Create monitor with notification callbacks
    const monitor = new AgentMonitor(
        config.solanaRpcUrl,
        config.agentTokenMint,
        config.developerWallet,
        config.pollIntervalSeconds,
        {
            onPayment: (event) => {
                console.log(`[Payment] ${event.amountSol} SOL from ${event.payerWallet}`);
                if (config.notifyChatIds.length > 0) {
                    broadcastMessage(bot, config.notifyChatIds, formatPaymentNotification(event));
                }
            },
            onClaim: (event) => {
                console.log(`[Claim] ${event.amountSol} SOL — ${event.claimType}`);
                if (config.notifyChatIds.length > 0) {
                    broadcastMessage(bot, config.notifyChatIds, formatClaimNotification(event));
                }
            },
            onBuyback: (event) => {
                console.log(`[Buyback] ${event.solAmount} SOL — ${event.isBuy ? 'BUY' : 'SELL'}`);
                if (config.notifyChatIds.length > 0) {
                    broadcastMessage(bot, config.notifyChatIds, formatBuybackNotification(event));
                }
            },
        },
    );

    // Create and start bot
    const bot = createBot(config, monitor);

    // Start monitor
    monitor.start();

    // Start bot polling
    console.log('[Bot] Starting Telegram polling...');
    bot.start({
        onStart: () => console.log('[Bot] Running!'),
    });

    // Graceful shutdown
    const shutdown = () => {
        console.log('\n[Shutdown] Stopping...');
        monitor.stop();
        bot.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
