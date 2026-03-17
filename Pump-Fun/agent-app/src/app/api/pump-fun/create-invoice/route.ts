import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import {
    createPumpAgent,
    generateInvoiceParams,
    getConnection,
    getCurrencyMint,
} from '@/lib/pump-agent';

export async function POST(req: NextRequest) {
    try {
        const { walletAddress } = await req.json();

        if (!walletAddress) {
            return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
        }

        const connection = getConnection();
        const agent = createPumpAgent();
        const currencyMint = getCurrencyMint();
        const userPublicKey = new PublicKey(walletAddress);
        const { amount, memo, startTime, endTime } = generateInvoiceParams();

        const instructions = await agent.buildAcceptPaymentInstructions({
            user: userPublicKey,
            currencyMint,
            amount,
            memo,
            startTime,
            endTime,
        });

        const { blockhash } = await connection.getLatestBlockhash('confirmed');

        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = userPublicKey;
        tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
            ...instructions,
        );

        const serializedTx = tx
            .serialize({ requireAllSignatures: false })
            .toString('base64');

        return NextResponse.json({
            transaction: serializedTx,
            memo,
            amount,
            startTime,
            endTime,
            currency: 'SOL',
            displayAmount: `${Number(amount) / 1_000_000_000} SOL`,
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}
