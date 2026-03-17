'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';

type Status = 'idle' | 'creating' | 'signing' | 'verifying' | 'done' | 'error';

interface InvoiceData {
    transaction: string;
    memo: string;
    amount: string;
    startTime: string;
    endTime: string;
    displayAmount: string;
}

async function signAndSendPayment(
    txBase64: string,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    connection: ReturnType<typeof useConnection>['connection'],
): Promise<string> {
    if (!signTransaction) {
        throw new Error('Wallet does not support signing');
    }

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'));
    const signedTx = await signTransaction(tx);

    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed',
    );

    return signature;
}

export default function RandomNumberGenerator() {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();

    const [status, setStatus] = useState<Status>('idle');
    const [randomNumber, setRandomNumber] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!publicKey || !signTransaction) return;

        setError(null);
        setRandomNumber(null);
        setTxSignature(null);
        setStatus('creating');

        try {
            // Step 1: Create invoice on server
            const invoiceRes = await fetch('/api/pump-fun/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
            });

            if (!invoiceRes.ok) throw new Error('Failed to create invoice');
            const invoice: InvoiceData = await invoiceRes.json();

            // Step 2: Sign and send transaction
            setStatus('signing');
            const signature = await signAndSendPayment(
                invoice.transaction,
                signTransaction,
                connection,
            );
            setTxSignature(signature);

            // Step 3: Verify payment and get random number
            setStatus('verifying');
            const verifyRes = await fetch('/api/pump-fun/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: publicKey.toBase58(),
                    memo: invoice.memo,
                    amount: invoice.amount,
                    startTime: invoice.startTime,
                    endTime: invoice.endTime,
                }),
            });

            const result = await verifyRes.json();

            if (result.verified) {
                setRandomNumber(result.randomNumber);
                setStatus('done');
            } else {
                throw new Error(result.error || 'Payment verification failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setStatus('error');
        }
    }, [publicKey, signTransaction, connection]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-purple-500/20 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Random Number Generator
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Pay 0.1 SOL to generate a random number (0-1000)
                    </p>
                    <p className="text-purple-400 text-xs mt-1">
                        Powered by pump.fun Tokenized Agent Payments
                    </p>
                </div>

                <div className="flex justify-center mb-6">
                    <WalletMultiButton />
                </div>

                {connected && (
                    <div className="space-y-6">
                        <div className="text-center text-gray-300 text-xs break-all font-mono">
                            {publicKey?.toBase58()}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={
                                status === 'creating' ||
                                status === 'signing' ||
                                status === 'verifying'
                            }
                            className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
                        >
                            {status === 'idle' || status === 'done' || status === 'error'
                                ? 'Pay 0.1 SOL & Generate'
                                : status === 'creating'
                                  ? 'Creating Invoice...'
                                  : status === 'signing'
                                    ? 'Sign in Wallet...'
                                    : 'Verifying Payment...'}
                        </button>

                        {status === 'verifying' && (
                            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm animate-pulse">
                                Verifying on-chain payment...
                            </div>
                        )}

                        {randomNumber !== null && (
                            <div className="text-center p-6 bg-gray-900/60 rounded-xl border border-green-500/30">
                                <p className="text-gray-400 text-sm mb-1">Your number:</p>
                                <p className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                    {randomNumber}
                                </p>
                                {txSignature && (
                                    <a
                                        href={`https://solscan.io/tx/${txSignature}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-purple-400 text-xs hover:underline mt-2 block"
                                    >
                                        View transaction on Solscan
                                    </a>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="text-center p-4 bg-red-900/30 rounded-xl border border-red-500/30">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}
                    </div>
                )}

                {!connected && (
                    <p className="text-center text-gray-500 text-sm">
                        Connect your Solana wallet to get started
                    </p>
                )}
            </div>
        </div>
    );
}
