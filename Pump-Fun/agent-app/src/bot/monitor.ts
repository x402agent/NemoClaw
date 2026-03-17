/**
 * Pump Fun Agent Tracker Bot — On-Chain Monitor
 *
 * Polls Solana RPC to detect:
 * 1. Agent payments (accept_payment instructions for our agent mint)
 * 2. Creator fee claims (collect_creator_fee, claim_cashback, etc.)
 * 3. Buybacks (trades by the developer wallet on our token)
 *
 * Uses HTTP polling (getSignaturesForAddress) for compatibility
 * with public RPCs that don't support WebSocket subscriptions.
 */

import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
} from '@solana/web3.js';
import type {
    AgentPaymentEvent,
    BuybackEvent,
    ClaimEvent,
    TrackerState,
    WalletSnapshot,
} from './types.js';
import { CLAIM_DISCRIMINATORS, TRADE_EVENT_DISCRIMINATOR } from './types.js';

export interface MonitorCallbacks {
    onPayment: (event: AgentPaymentEvent) => void;
    onClaim: (event: ClaimEvent) => void;
    onBuyback: (event: BuybackEvent) => void;
}

export class AgentMonitor {
    private connection: Connection;
    private agentMint: PublicKey;
    private developerWallet: PublicKey;
    private pollInterval: number;
    private callbacks: MonitorCallbacks;
    private timer: ReturnType<typeof setInterval> | null = null;
    private lastSignatures: Map<string, string> = new Map(); // account -> last seen sig
    public state: TrackerState;

    constructor(
        rpcUrl: string,
        agentMint: string,
        developerWallet: string,
        pollIntervalSeconds: number,
        callbacks: MonitorCallbacks,
    ) {
        this.connection = new Connection(rpcUrl);
        this.agentMint = new PublicKey(agentMint);
        this.developerWallet = new PublicKey(developerWallet);
        this.pollInterval = pollIntervalSeconds * 1000;
        this.callbacks = callbacks;
        this.state = {
            totalPaymentsReceived: 0,
            totalSolCollected: 0,
            totalClaims: 0,
            totalClaimsSol: 0,
            totalBuybacks: 0,
            totalBuybackSol: 0,
            lastPayment: null,
            lastClaim: null,
            lastBuyback: null,
            startedAt: Date.now(),
        };
    }

    start(): void {
        console.log('[Monitor] Starting agent tracker...');
        console.log(`[Monitor] Agent mint: ${this.agentMint.toBase58()}`);
        console.log(`[Monitor] Developer wallet: ${this.developerWallet.toBase58()}`);

        // Initial poll
        this.poll().catch((err) => console.error('[Monitor] Initial poll error:', err));

        // Recurring poll
        this.timer = setInterval(() => {
            this.poll().catch((err) => console.error('[Monitor] Poll error:', err));
        }, this.pollInterval);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('[Monitor] Stopped.');
    }

    async getWalletBalance(): Promise<WalletSnapshot> {
        const balance = await this.connection.getBalance(this.developerWallet);
        return {
            address: this.developerWallet.toBase58(),
            solBalance: balance / LAMPORTS_PER_SOL,
            timestamp: Math.floor(Date.now() / 1000),
        };
    }

    private async poll(): Promise<void> {
        await Promise.allSettled([
            this.pollDevWalletActivity(),
            this.pollAgentMintActivity(),
        ]);
    }

    /**
     * Poll the developer wallet for recent transactions.
     * Detects claims and buybacks from the dev wallet.
     */
    private async pollDevWalletActivity(): Promise<void> {
        const key = 'dev';
        const lastSig = this.lastSignatures.get(key);

        const sigs = await this.connection.getSignaturesForAddress(
            this.developerWallet,
            { limit: 10, ...(lastSig ? { until: lastSig } : {}) },
            'confirmed',
        );

        if (sigs.length === 0) return;

        // Update last seen signature (most recent first)
        this.lastSignatures.set(key, sigs[0].signature);

        for (const sigInfo of sigs) {
            if (sigInfo.err) continue;

            try {
                const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
                    maxSupportedTransactionVersion: 0,
                });
                if (!tx?.meta || !tx.transaction) continue;

                const timestamp = tx.blockTime || Math.floor(Date.now() / 1000);
                const slot = tx.slot;

                // Check instruction data for claim discriminators
                for (const ix of tx.transaction.message.instructions) {
                    if ('data' in ix && typeof ix.data === 'string') {
                        // Check if this is a known claim instruction
                        const dataHex = Buffer.from(ix.data, 'base64').toString('hex');
                        const disc = dataHex.slice(0, 16);

                        if (CLAIM_DISCRIMINATORS[disc]) {
                            const preBalances = tx.meta.preBalances;
                            const postBalances = tx.meta.postBalances;
                            const devIndex = tx.transaction.message.accountKeys.findIndex(
                                (k) => k.pubkey.toBase58() === this.developerWallet.toBase58(),
                            );
                            const amountLamports =
                                devIndex >= 0 ? (postBalances[devIndex] - preBalances[devIndex]) : 0;

                            const event: ClaimEvent = {
                                txSignature: sigInfo.signature,
                                slot,
                                timestamp,
                                claimerWallet: this.developerWallet.toBase58(),
                                amountSol: Math.abs(amountLamports) / LAMPORTS_PER_SOL,
                                claimType: CLAIM_DISCRIMINATORS[disc],
                                tokenMint: this.agentMint.toBase58(),
                            };

                            this.state.totalClaims++;
                            this.state.totalClaimsSol += event.amountSol;
                            this.state.lastClaim = event;
                            this.callbacks.onClaim(event);
                        }
                    }
                }

                // Check log messages for trade events (buybacks)
                const logs = tx.meta.logMessages || [];
                for (const logLine of logs) {
                    if (logLine.includes(TRADE_EVENT_DISCRIMINATOR)) {
                        // This is a trade event — check if it involves our agent token
                        const preBalances = tx.meta.preBalances;
                        const postBalances = tx.meta.postBalances;
                        const devIndex = tx.transaction.message.accountKeys.findIndex(
                            (k) => k.pubkey.toBase58() === this.developerWallet.toBase58(),
                        );
                        const solDiff =
                            devIndex >= 0 ? (preBalances[devIndex] - postBalances[devIndex]) : 0;

                        if (solDiff > 0) {
                            // Dev wallet spent SOL — likely a buy
                            const event: BuybackEvent = {
                                txSignature: sigInfo.signature,
                                slot,
                                timestamp,
                                buyerWallet: this.developerWallet.toBase58(),
                                solAmount: solDiff / LAMPORTS_PER_SOL,
                                tokenAmount: 0, // would need deeper parsing
                                tokenMint: this.agentMint.toBase58(),
                                isBuy: true,
                            };

                            this.state.totalBuybacks++;
                            this.state.totalBuybackSol += event.solAmount;
                            this.state.lastBuyback = event;
                            this.callbacks.onBuyback(event);
                        }
                    }
                }
            } catch (err) {
                // Skip failed tx parsing
                console.error('[Monitor] Failed to parse tx:', sigInfo.signature, err);
            }
        }
    }

    /**
     * Poll the agent mint for recent activity.
     * Detects payments made to the agent via accept_payment.
     */
    private async pollAgentMintActivity(): Promise<void> {
        const key = 'mint';
        const lastSig = this.lastSignatures.get(key);

        const sigs = await this.connection.getSignaturesForAddress(
            this.agentMint,
            { limit: 10, ...(lastSig ? { until: lastSig } : {}) },
            'confirmed',
        );

        if (sigs.length === 0) return;

        this.lastSignatures.set(key, sigs[0].signature);

        for (const sigInfo of sigs) {
            if (sigInfo.err) continue;

            try {
                const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
                    maxSupportedTransactionVersion: 0,
                });
                if (!tx?.meta || !tx.transaction) continue;

                const logs = tx.meta.logMessages || [];
                const hasAcceptPayment = logs.some(
                    (l) => l.includes('accept_payment') || l.includes('AcceptPayment'),
                );

                if (hasAcceptPayment) {
                    const timestamp = tx.blockTime || Math.floor(Date.now() / 1000);
                    const signer = tx.transaction.message.accountKeys[0].pubkey.toBase58();

                    // Parse memo from instruction data if available
                    let memo = '';
                    if (sigInfo.memo) {
                        memo = sigInfo.memo;
                    }

                    const event: AgentPaymentEvent = {
                        txSignature: sigInfo.signature,
                        slot: tx.slot,
                        timestamp,
                        payerWallet: signer,
                        amountLamports: 0,
                        amountSol: 0.1, // default price
                        memo,
                        agentMint: this.agentMint.toBase58(),
                    };

                    this.state.totalPaymentsReceived++;
                    this.state.totalSolCollected += event.amountSol;
                    this.state.lastPayment = event;
                    this.callbacks.onPayment(event);
                }
            } catch (err) {
                console.error('[Monitor] Failed to parse mint tx:', sigInfo.signature, err);
            }
        }
    }
}
