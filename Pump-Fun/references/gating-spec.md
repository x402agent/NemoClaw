# Gating Spec — Tier Verification, Staking & NFT Access Control

## Table of Contents

1. Tier System
2. Wallet Verification Flow
3. MAWD Balance Check
4. Staking Verification
5. NFT Verification
6. JWT Token Issuance
7. API Middleware
8. Rate Limiting by Tier

---

## 1. Tier System

```typescript
enum AccessTier {
  OBSERVER = 'OBSERVER',     // 0 MAWD — public
  HOLDER = 'HOLDER',         // 10K+ MAWD
  STAKER = 'STAKER',         // 50K+ MAWD staked
  LOBSTER = 'LOBSTER',       // 100K+ MAWD + NFT
  CLAWDGUT = 'CLAWDGUT',    // Multisig signer
}

interface TierConfig {
  tier: AccessTier;
  minBalance: bigint;         // Raw MAWD with decimals
  requiresStaking: boolean;
  requiresNft: boolean;
  requiresMultisig: boolean;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    tier: AccessTier.CLAWDGUT,
    minBalance: 0n,            // Balance doesn't matter, multisig check
    requiresStaking: false,
    requiresNft: false,
    requiresMultisig: true,
  },
  {
    tier: AccessTier.LOBSTER,
    minBalance: BigInt(process.env.TIER_LOBSTER_MIN || '100000000000'),
    requiresStaking: false,    // Can be held OR staked
    requiresNft: true,
    requiresMultisig: false,
  },
  {
    tier: AccessTier.STAKER,
    minBalance: BigInt(process.env.TIER_STAKER_MIN || '50000000000'),
    requiresStaking: true,
    requiresNft: false,
    requiresMultisig: false,
  },
  {
    tier: AccessTier.HOLDER,
    minBalance: BigInt(process.env.TIER_HOLDER_MIN || '10000000000'),
    requiresStaking: false,
    requiresNft: false,
    requiresMultisig: false,
  },
  {
    tier: AccessTier.OBSERVER,
    minBalance: 0n,
    requiresStaking: false,
    requiresNft: false,
    requiresMultisig: false,
  },
];

// Tiers are checked top-down — user gets HIGHEST tier they qualify for
```

### Tier Permissions Matrix

```typescript
interface TierPermissions {
  dashboard: boolean;
  realTimeSignals: boolean;
  tradeHistory: boolean;
  revenueShare: boolean;
  customStrategy: boolean;
  agentControl: boolean;        // Start/stop/configure
  governance: boolean;          // Change parameters
  priorityExecution: boolean;
  apiRateLimit: number;         // Requests per minute
  wsConnections: number;        // Max concurrent WebSocket connections
}

const TIER_PERMISSIONS: Record<AccessTier, TierPermissions> = {
  OBSERVER: {
    dashboard: true,
    realTimeSignals: false,     // Delayed by 5 minutes
    tradeHistory: false,
    revenueShare: false,
    customStrategy: false,
    agentControl: false,
    governance: false,
    priorityExecution: false,
    apiRateLimit: 10,
    wsConnections: 1,
  },
  HOLDER: {
    dashboard: true,
    realTimeSignals: true,
    tradeHistory: true,
    revenueShare: false,
    customStrategy: false,
    agentControl: false,
    governance: false,
    priorityExecution: false,
    apiRateLimit: 60,
    wsConnections: 3,
  },
  STAKER: {
    dashboard: true,
    realTimeSignals: true,
    tradeHistory: true,
    revenueShare: true,
    customStrategy: false,
    agentControl: false,
    governance: false,
    priorityExecution: true,
    apiRateLimit: 120,
    wsConnections: 5,
  },
  LOBSTER: {
    dashboard: true,
    realTimeSignals: true,
    tradeHistory: true,
    revenueShare: true,
    customStrategy: true,
    agentControl: true,
    governance: false,
    priorityExecution: true,
    apiRateLimit: 300,
    wsConnections: 10,
  },
  CLAWDGUT: {
    dashboard: true,
    realTimeSignals: true,
    tradeHistory: true,
    revenueShare: true,
    customStrategy: true,
    agentControl: true,
    governance: true,
    priorityExecution: true,
    apiRateLimit: 1000,
    wsConnections: 50,
  },
};
```

---

## 2. Wallet Verification Flow

```
User connects wallet
  |
  +-- Sign message: "MAWD Agent Auth: {nonce}"
  |   (proves wallet ownership without TX)
  |
  +-- Verify signature on server
  |
  +-- Check MAWD balance (on-chain)
  |   +-- getTokenAccountsByOwner(wallet, MAWD_MINT)
  |   +-- Sum all MAWD token accounts
  |
  +-- Check staking position (Supabase or on-chain)
  |   +-- Query staking registry for wallet
  |
  +-- Check NFT ownership (if needed for Lobster tier)
  |   +-- getParsedTokenAccountsByOwner + metaplex check
  |
  +-- Check multisig membership (if ClawdGut)
  |   +-- Squads V4 multisig member check
  |
  +-- Compute highest qualifying tier
  |
  +-- Issue JWT with tier + expiry
```

### Message Signing (SIWS)

```typescript
// Sign-In With Solana pattern
interface AuthChallenge {
  nonce: string;              // Random 32-byte hex
  issuedAt: number;
  expiresAt: number;          // 5 minutes
  domain: string;             // mawdbot.com
  statement: string;          // "Sign in to MAWD Agent"
}

// Message format:
// "MAWD Agent Authentication\nDomain: mawdbot.com\nNonce: {nonce}\nIssued: {iso}\nExpires: {iso}"

// Verify with @solana/web3.js nacl.sign.detached.verify
```

---

## 3. MAWD Balance Check

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function getMawdBalance(
  connection: Connection,
  wallet: PublicKey,
  mawdMint: PublicKey,
): Promise<bigint> {
  const accounts = await connection.getTokenAccountsByOwner(wallet, {
    mint: mawdMint,
  });

  let totalBalance = 0n;
  for (const { account } of accounts.value) {
    // Parse token account data
    const data = account.data;
    // Amount is at offset 64, 8 bytes LE
    const amount = data.readBigUInt64LE(64);
    totalBalance += amount;
  }

  return totalBalance;
}

// IMPORTANT: Always check on-chain, never cache balances for auth
// Caching is only acceptable for dashboard display (with staleness indicator)
// Auth checks MUST hit RPC every time
```

---

## 4. Staking Verification

### Supabase Method (Off-chain)

```typescript
interface StakeRecord {
  id: string;
  wallet: string;
  amount_raw: string;           // bigint stored as string
  lock_tier: string;
  staked_at: string;
  lock_until: string | null;
  multiplier: number;
  is_active: boolean;
}

async function getStakedBalance(wallet: string): Promise<bigint> {
  const { data, error } = await supabase
    .from('stakes')
    .select('amount_raw')
    .eq('wallet', wallet)
    .eq('is_active', true);

  if (error) throw new StakingQueryError(error.message);

  return data.reduce(
    (sum, row) => sum + BigInt(row.amount_raw),
    0n,
  );
}

// For tier computation, combine:
// totalMawd = walletBalance + stakedBalance
// But staking requirement specifically checks stakedBalance >= threshold
```

### On-chain PDA Method (Future)

```typescript
// PDA derivation for staking account:
// seeds = ["mawd_stake", wallet.toBytes(), MAWD_MINT.toBytes()]
// This would be part of an Anchor program — not implemented in MVP
// but the gatekeeper should support both methods via strategy pattern

interface StakingProvider {
  getStakedBalance(wallet: string): Promise<bigint>;
  getStakePosition(wallet: string): Promise<StakePosition | null>;
}

class SupabaseStakingProvider implements StakingProvider { /* ... */ }
class OnChainStakingProvider implements StakingProvider { /* ... */ }
```

---

## 5. NFT Verification

```typescript
import { Metaplex } from '@metaplex-foundation/js';

async function holdsCollectionNft(
  connection: Connection,
  wallet: PublicKey,
  collectionAddress: PublicKey,
): Promise<boolean> {
  const metaplex = Metaplex.make(connection);

  const nfts = await metaplex
    .nfts()
    .findAllByOwner({ owner: wallet });

  return nfts.some(nft => {
    if ('collection' in nft && nft.collection) {
      return (
        nft.collection.address.equals(collectionAddress) &&
        nft.collection.verified
      );
    }
    return false;
  });
}

// Cache NFT check for 5 minutes (NFT ownership changes less frequently)
// But invalidate on any transfer event detected by sentinel
```

---

## 6. JWT Token Issuance

```typescript
import jwt from 'jsonwebtoken';

interface MawdJwtPayload {
  sub: string;               // Wallet address
  tier: AccessTier;
  balance: string;           // MAWD balance (string bigint)
  staked: string;            // Staked MAWD (string bigint)
  hasNft: boolean;
  permissions: TierPermissions;
  iat: number;
  exp: number;               // 1 hour
}

// JWT is signed with server secret (env: JWT_SECRET)
// Client stores in memory (not localStorage)
// Refresh flow: re-verify wallet balance on refresh
// If balance dropped below tier threshold, downgrade tier in new JWT
```

---

## 7. API Middleware

```typescript
// Fastify preHandler hook
async function tierGuard(
  requiredTier: AccessTier,
): FastifyPreHandler {
  return async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({ error: 'No auth token' });
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as MawdJwtPayload;
      const tierRank = Object.values(AccessTier);
      const userRank = tierRank.indexOf(payload.tier);
      const requiredRank = tierRank.indexOf(requiredTier);

      if (userRank < requiredRank) {
        return reply.status(403).send({
          error: 'Insufficient tier',
          required: requiredTier,
          current: payload.tier,
          upgrade: `Hold ${TIER_CONFIGS.find(t => t.tier === requiredTier)?.minBalance} MAWD`,
        });
      }

      request.user = payload;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  };
}

// Usage:
// app.get('/signals', { preHandler: tierGuard(AccessTier.HOLDER) }, handler);
// app.post('/strategy', { preHandler: tierGuard(AccessTier.LOBSTER) }, handler);
// app.post('/governance', { preHandler: tierGuard(AccessTier.CLAWDGUT) }, handler);
```

---

## 8. Rate Limiting by Tier

```typescript
import rateLimit from '@fastify/rate-limit';

// Per-tier rate limits applied via middleware
const TIER_RATE_LIMITS: Record<AccessTier, { max: number; timeWindow: string }> = {
  OBSERVER:  { max: 10,   timeWindow: '1 minute' },
  HOLDER:    { max: 60,   timeWindow: '1 minute' },
  STAKER:    { max: 120,  timeWindow: '1 minute' },
  LOBSTER:   { max: 300,  timeWindow: '1 minute' },
  CLAWDGUT:  { max: 1000, timeWindow: '1 minute' },
};

// Rate limit key: wallet address (from JWT sub)
// Exceeded limit returns 429 with Retry-After header
// WebSocket connections also tier-gated (see permissions matrix)
```
