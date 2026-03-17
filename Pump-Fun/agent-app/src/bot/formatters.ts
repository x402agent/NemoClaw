/**
 * Pump Fun Agent Tracker Bot — Telegram Message Formatters
 *
 * HTML-formatted messages for Telegram notifications,
 * following the same patterns as the existing telegram-bot.
 */

import type {
    AgentPaymentEvent,
    BuybackEvent,
    ClaimEvent,
    TrackerState,
    WalletSnapshot,
} from './types.js';

function shortAddr(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toUTCString();
}

// ── Payment Received ──────────────────────────────────────────────────────

export function formatPaymentNotification(event: AgentPaymentEvent): string {
    return (
        `<b>Agent Payment Received!</b>\n\n` +
        `<b>Payer:</b> <code>${shortAddr(event.payerWallet)}</code>\n` +
        `<b>Amount:</b> ${event.amountSol.toFixed(4)} SOL\n` +
        `<b>Memo:</b> ${escapeHtml(event.memo)}\n` +
        `<b>Time:</b> ${formatTime(event.timestamp)}\n\n` +
        `<a href="https://solscan.io/tx/${event.txSignature}">View TX</a>`
    );
}

// ── Claim Detected ────────────────────────────────────────────────────────

export function formatClaimNotification(event: ClaimEvent): string {
    const mint = event.tokenMint
        ? `\n<b>Token:</b> <code>${shortAddr(event.tokenMint)}</code>`
        : '';
    return (
        `<b>Fee Claim Detected!</b>\n\n` +
        `<b>Claimer:</b> <code>${shortAddr(event.claimerWallet)}</code>\n` +
        `<b>Amount:</b> ${event.amountSol.toFixed(4)} SOL\n` +
        `<b>Type:</b> ${escapeHtml(event.claimType)}${mint}\n` +
        `<b>Time:</b> ${formatTime(event.timestamp)}\n\n` +
        `<a href="https://solscan.io/tx/${event.txSignature}">View TX</a>`
    );
}

// ── Buyback Detected ──────────────────────────────────────────────────────

export function formatBuybackNotification(event: BuybackEvent): string {
    const action = event.isBuy ? 'BUY' : 'SELL';
    return (
        `<b>Token ${action} Detected!</b>\n\n` +
        `<b>Wallet:</b> <code>${shortAddr(event.buyerWallet)}</code>\n` +
        `<b>SOL:</b> ${event.solAmount.toFixed(4)}\n` +
        `<b>Token:</b> <code>${shortAddr(event.tokenMint)}</code>\n` +
        `<b>Time:</b> ${formatTime(event.timestamp)}\n\n` +
        `<a href="https://solscan.io/tx/${event.txSignature}">View TX</a> · ` +
        `<a href="https://pump.fun/coin/${event.tokenMint}">pump.fun</a>`
    );
}

// ── Wallet Balance ────────────────────────────────────────────────────────

export function formatWalletBalance(snapshot: WalletSnapshot): string {
    return (
        `<b>Developer Wallet Balance</b>\n\n` +
        `<b>Address:</b> <code>${shortAddr(snapshot.address)}</code>\n` +
        `<b>SOL Balance:</b> ${snapshot.solBalance.toFixed(4)} SOL\n` +
        `<b>Checked:</b> ${formatTime(snapshot.timestamp)}\n\n` +
        `<a href="https://solscan.io/account/${snapshot.address}">View on Solscan</a>`
    );
}

// ── Status Summary ────────────────────────────────────────────────────────

export function formatStatus(state: TrackerState, config: { agentMint: string; devWallet: string }): string {
    const uptimeMs = Date.now() - state.startedAt;
    const hours = Math.floor(uptimeMs / 3_600_000);
    const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);

    return (
        `<b>Agent Tracker Status</b>\n\n` +
        `<b>Agent Mint:</b> <code>${shortAddr(config.agentMint)}</code>\n` +
        `<b>Dev Wallet:</b> <code>${shortAddr(config.devWallet)}</code>\n` +
        `<b>Uptime:</b> ${hours}h ${minutes}m\n\n` +
        `<b>Payments:</b> ${state.totalPaymentsReceived} (${state.totalSolCollected.toFixed(4)} SOL)\n` +
        `<b>Claims:</b> ${state.totalClaims} (${state.totalClaimsSol.toFixed(4)} SOL)\n` +
        `<b>Buybacks:</b> ${state.totalBuybacks} (${state.totalBuybackSol.toFixed(4)} SOL)\n`
    );
}

// ── Help ──────────────────────────────────────────────────────────────────

export function formatHelp(): string {
    return (
        `<b>Pump Fun Agent Tracker Bot</b>\n\n` +
        `<b>Commands:</b>\n` +
        `/start — Start the bot\n` +
        `/status — Show tracker stats\n` +
        `/wallet — Check developer wallet balance\n` +
        `/claims — Show recent claims summary\n` +
        `/buybacks — Show recent buybacks summary\n` +
        `/help — Show this message\n\n` +
        `The bot automatically monitors:\n` +
        `• Agent payments (invoices paid)\n` +
        `• Creator fee claims\n` +
        `• Token buybacks by developer wallet\n`
    );
}
