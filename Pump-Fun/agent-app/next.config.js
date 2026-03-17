/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Polyfill for @solana/web3.js in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
