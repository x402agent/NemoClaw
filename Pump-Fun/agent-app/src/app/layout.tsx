import type { Metadata } from 'next';
import WalletProvider from '@/components/pump-fun/WalletProvider';
import './globals.css';

export const metadata: Metadata = {
    title: 'Pump Fun Random Number Agent',
    description: 'Payment-gated random number generator powered by pump.fun on Solana',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <WalletProvider>{children}</WalletProvider>
            </body>
        </html>
    );
}
