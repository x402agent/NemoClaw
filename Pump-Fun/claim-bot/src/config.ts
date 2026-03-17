/**
 * PumpFun Claim Bot — Configuration
 *
 * Loads and validates environment variables.
 */

import 'dotenv/config';

import type { BotConfig } from './types.js';

export function loadConfig(): BotConfig {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
        throw new Error(
            'TELEGRAM_BOT_TOKEN is required. Create a bot via @BotFather and set the env var.',
        );
    }

    const relayWsUrl = process.env.RELAY_WS_URL;
    const solanaRpcUrl = process.env.SOLANA_RPC_URL;
    const solanaWsUrl = process.env.SOLANA_WS_URL;
    const pollIntervalSeconds = process.env.POLL_INTERVAL_SECONDS
        ? parseInt(process.env.POLL_INTERVAL_SECONDS, 10)
        : 15;

    if (!relayWsUrl && !solanaRpcUrl) {
        throw new Error(
            'Either RELAY_WS_URL or SOLANA_RPC_URL is required. ' +
            'Set SOLANA_RPC_URL for direct RPC monitoring, or RELAY_WS_URL for relay mode.',
        );
    }

    const logLevel = (process.env.LOG_LEVEL || 'info') as BotConfig['logLevel'];

    const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

    const twitterInfluencerIds = process.env.TWITTER_INFLUENCER_IDS
        ? process.env.TWITTER_INFLUENCER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    return {
        logLevel,
        relayWsUrl,
        solanaRpcUrl,
        solanaWsUrl,
        pollIntervalSeconds,
        telegramToken,
        twitterBearerToken,
        twitterInfluencerIds,
    };
}
