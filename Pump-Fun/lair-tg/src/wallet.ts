// ── Lair-TG — Wallet Module ────────────────────────────────────────
//
// Balance checks via Solana RPC.

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { log } from './logger.js';
import type { WalletBalance } from './types.js';

export class WalletService {
  private readonly connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async getBalance(address: string): Promise<WalletBalance | null> {
    try {
      const pubkey = new PublicKey(address);
      const lamports = await this.connection.getBalance(pubkey);
      const solBalance = lamports / LAMPORTS_PER_SOL;

      // Fetch SPL token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      const tokens = tokenAccounts.value
        .map((ta) => {
          const info = ta.account.data.parsed?.info;
          if (!info) return null;
          const amount = Number(info.tokenAmount?.uiAmount ?? 0);
          if (amount === 0) return null;
          return {
            mint: info.mint as string,
            symbol: (info.mint as string).slice(0, 6) + '…',
            amount,
            valueUsd: null,
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .slice(0, 20);

      return { address, solBalance, tokens };
    } catch (err) {
      log.error('Failed to fetch wallet balance for %s: %s', address, err);
      return null;
    }
  }
}
