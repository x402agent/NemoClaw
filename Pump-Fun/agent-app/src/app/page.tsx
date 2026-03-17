'use client';

import dynamic from 'next/dynamic';

const RandomNumberGenerator = dynamic(
    () => import('@/components/pump-fun/RandomNumberGenerator'),
    {
        ssr: false,
        loading: () => (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center text-white/40 text-sm">
                Loading...
            </div>
        ),
    },
);

export default function Home() {
    return <RandomNumberGenerator />;
}
