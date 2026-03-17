import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { createPumpAgent, getCurrencyMint } from '@/lib/pump-agent';

export async function POST(req: NextRequest) {
    try {
        const { walletAddress, memo, amount, startTime, endTime } = await req.json();

        if (!walletAddress || !memo || !amount || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const agent = createPumpAgent();
        const currencyMint = getCurrencyMint();

        // Retry verification up to 10 times (2s between attempts)
        for (let attempt = 0; attempt < 10; attempt++) {
            const verified = await agent.validateInvoicePayment({
                user: new PublicKey(walletAddress),
                currencyMint,
                amount: Number(amount),
                memo: Number(memo),
                startTime: Number(startTime),
                endTime: Number(endTime),
            });

            if (verified) {
                const randomNumber = Math.floor(Math.random() * 1001);
                return NextResponse.json({
                    verified: true,
                    randomNumber,
                    message: `Payment verified! Your random number is ${randomNumber}`,
                });
            }

            await new Promise((r) => setTimeout(r, 2000));
        }

        return NextResponse.json(
            { verified: false, error: 'Payment not confirmed after retries' },
            { status: 402 },
        );
    } catch (error) {
        console.error('Verify payment error:', error);
        return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 });
    }
}
