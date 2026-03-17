/**
 * Shared PumpAgent setup — used by all API routes.
 * Reads config from environment variables at runtime.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { PumpAgent } from '@pump-fun/agent-payments-sdk';

export function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://rpc.solanatracker.io/public';
    return new Connection(rpcUrl);
}

export function getAgentMint(): PublicKey {
    return new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS!);
}

export function getCurrencyMint(): PublicKey {
    return new PublicKey(process.env.CURRENCY_MINT || 'So11111111111111111111111111111111111111112');
}

export function getPriceAmount(): string {
    return process.env.PRICE_AMOUNT || '100000000'; // 0.1 SOL default
}

export function createPumpAgent(): PumpAgent {
    const connection = getConnection();
    const agentMint = getAgentMint();
    return new PumpAgent(agentMint, 'mainnet', connection);
}

/** Generate unique invoice parameters */
export function generateInvoiceParams() {
    const memo = String(Math.floor(Math.random() * 900000000000) + 100000);
    const now = Math.floor(Date.now() / 1000);
    const startTime = String(now);
    const endTime = String(now + 86400); // 24-hour window
    const amount = getPriceAmount();

    return { amount, memo, startTime, endTime };
}
