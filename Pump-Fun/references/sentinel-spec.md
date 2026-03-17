# Sentinel Spec — Event Schemas & Feed Configuration

## Table of Contents

1. Event Type Hierarchy
2. Price Feed Events
3. Sentiment Feed Events
4. Chain Watcher Events
5. Whale Tracker Events
6. Unified Event Bus
7. Reconnection Logic
8. Rate Limit Management

---

## 1. Event Type Hierarchy

```typescript
// Base event — all events extend this
interface SentinelEvent {
  id: string;               // UUID v4
  source: FeedSource;       // Which feed produced this
  timestamp: number;        // Unix ms
  correlationId: string;    // For tracing across modules
}

type FeedSource =
  | 'birdeye'
  | 'jupiter'
  | 'helius'
  | 'twitter'
  | 'newsapi'
  | 'whale-alert';

// Discriminated union of all sentinel events
type SentinelEventUnion =
  | PriceUpdateEvent
  | PriceAlertEvent
  | SentimentSignalEvent
  | ChainTransferEvent
  | ChainSwapEvent
  | ChainBurnEvent
  | WhaleMovementEvent
  | FeedHealthEvent;
```

---

## 2. Price Feed Events

```typescript
interface PriceUpdateEvent extends SentinelEvent {
  type: 'PRICE_UPDATE';
  data: {
    mint: string;            // Token mint address
    symbol: string;          // e.g. "MAWD"
    priceUsd: number;
    priceSol: number;
    volume24h: number;
    priceChange24h: number;  // Percentage
    liquidity: number;       // USD
    mcap: number;
  };
}

interface PriceAlertEvent extends SentinelEvent {
  type: 'PRICE_ALERT';
  data: {
    mint: string;
    alertType: 'PUMP' | 'DUMP' | 'BREAKOUT' | 'BREAKDOWN';
    magnitude: number;       // % change triggering alert
    timeframeMs: number;     // Over what period
    priceAtAlert: number;
    volumeSpike: boolean;    // Volume > 2x average
  };
}
```

### Birdeye WebSocket Configuration

```typescript
const BIRDEYE_WS_CONFIG = {
  url: 'wss://public-api.birdeye.so/socket',
  subscriptions: [
    {
      type: 'PRICE_UPDATES',
      params: {
        address: process.env.MAWD_MINT,
        updateInterval: 5000,  // 5s between updates
      },
    },
  ],
  heartbeatIntervalMs: 15000,
  reconnectDelayMs: 3000,
  maxReconnectAttempts: 10,
};
```

### Jupiter Price API Fallback

```typescript
const JUPITER_PRICE_CONFIG = {
  baseUrl: 'https://price.jup.ag/v6',
  pollIntervalMs: 10000,     // Poll every 10s (fallback only)
  tokens: [process.env.MAWD_MINT],
  vsToken: 'So11111111111111111111111111111111111111112',
};
```

---

## 3. Sentiment Feed Events

```typescript
interface SentimentSignalEvent extends SentinelEvent {
  type: 'SENTIMENT_SIGNAL';
  data: {
    platform: 'twitter' | 'news' | 'reddit';
    query: string;           // Search query that produced this
    sentiment: number;       // -1.0 to 1.0
    confidence: number;      // 0.0 to 1.0
    sampleSize: number;      // How many posts/articles analyzed
    topKeywords: string[];   // Most frequent terms
    notableAccounts: string[]; // Influencer mentions
    rawSummary: string;      // One-sentence summary
  };
}
```

### Twitter/X Configuration

```typescript
const TWITTER_FEED_CONFIG = {
  searchQueries: [
    '$MAWD',
    'MawdBot',
    'mawdbot.com',
    '5Bphs5Q6nbq1FRQ7sk3MUYNE8JHzoSKVyeZWYM94pump',
  ],
  pollIntervalMs: 60000,     // 1 minute (respect rate limits)
  minFollowers: 100,         // Filter low-quality accounts
  sentimentModel: 'simple',  // 'simple' = keyword scoring, 'llm' = Claude API
  maxResultsPerQuery: 50,
};
```

### News API Configuration

```typescript
const NEWS_FEED_CONFIG = {
  sources: ['coindesk', 'theblock', 'decrypt', 'cointelegraph'],
  keywords: ['solana', 'MAWD', 'meme coin', 'defi agent'],
  pollIntervalMs: 300000,    // 5 minutes
  maxArticles: 20,
};
```

---

## 4. Chain Watcher Events

```typescript
interface ChainTransferEvent extends SentinelEvent {
  type: 'CHAIN_TRANSFER';
  data: {
    signature: string;
    mint: string;
    from: string;
    to: string;
    amount: bigint;          // Raw amount with decimals
    amountUi: number;        // Human-readable
    slot: number;
    blockTime: number;
  };
}

interface ChainSwapEvent extends SentinelEvent {
  type: 'CHAIN_SWAP';
  data: {
    signature: string;
    dex: 'jupiter' | 'raydium' | 'orca';
    inputMint: string;
    outputMint: string;
    inputAmount: bigint;
    outputAmount: bigint;
    priceImpact: number;     // Percentage
    wallet: string;
    slot: number;
  };
}

interface ChainBurnEvent extends SentinelEvent {
  type: 'CHAIN_BURN';
  data: {
    signature: string;
    mint: string;
    amount: bigint;
    burner: string;
    memo: string | null;     // Memo instruction data
    slot: number;
  };
}
```

### Helius Webhook Configuration

```typescript
const HELIUS_WEBHOOK_CONFIG = {
  webhookUrl: `${process.env.API_BASE_URL}/webhooks/helius`,
  transactionTypes: ['TRANSFER', 'SWAP', 'BURN'],
  accountAddresses: [process.env.MAWD_MINT!],
  webhookType: 'enhanced',   // Get decoded data
  authHeader: process.env.HELIUS_WEBHOOK_SECRET,
};

// Enhanced websocket for real-time (lower latency than webhook)
const HELIUS_WS_CONFIG = {
  url: `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
  subscriptions: [
    {
      method: 'accountSubscribe',
      params: [process.env.MAWD_MINT],
    },
  ],
};
```

---

## 5. Whale Tracker Events

```typescript
interface WhaleMovementEvent extends SentinelEvent {
  type: 'WHALE_MOVEMENT';
  data: {
    wallet: string;
    walletLabel: string | null;  // Known wallet label
    action: 'ACCUMULATE' | 'DISTRIBUTE' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    mint: string;
    amount: bigint;
    amountUi: number;
    percentOfSupply: number;     // What % of total supply this represents
    signature: string;
    previousBalance: bigint;
    newBalance: bigint;
  };
}
```

### Whale Detection Thresholds

```typescript
const WHALE_CONFIG = {
  minBalanceForWhale: 1_000_000_000_000n,  // 1M MAWD (6 decimals)
  significantMovePercent: 10,               // 10% of their holdings
  topHoldersToTrack: 50,                    // Monitor top 50 wallets
  snapshotIntervalMs: 300_000,              // Re-snapshot every 5 min
  knownWallets: {
    // Add known wallet labels here
    'TREASURY_WALLET': 'MAWD Treasury',
    'DEV_WALLET': '8BIT Labs Dev',
  },
};
```

---

## 6. Unified Event Bus

```typescript
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

interface EventBusConfig {
  maxListeners: number;        // Default 100
  dedupeWindowMs: number;      // 5000ms — ignore duplicate events
  bufferSize: number;          // Ring buffer for replay
}

class SentinelBus extends EventEmitter {
  private dedupeCache: Map<string, number>;  // hash -> timestamp
  private buffer: SentinelEventUnion[];

  emit(event: SentinelEventUnion): void;
  on(type: string, handler: (event: SentinelEventUnion) => void): this;

  // Deduplication: hash(source + type + key fields) checked against cache
  // Buffer: last N events kept for late subscribers / replay
}
```

### Deduplication Strategy

Events are deduplicated by computing a hash of:

- `source + type + type-specific key` (e.g., signature for chain events, priceUsd rounded to 4 decimals for price events)
- If hash seen within `dedupeWindowMs`, event is dropped
- Cache is pruned every 60s

---

## 7. Reconnection Logic

All feed connections implement this reconnection pattern:

```typescript
interface ReconnectConfig {
  initialDelayMs: number;      // 1000
  maxDelayMs: number;          // 30000
  backoffMultiplier: number;   // 2.0
  maxAttempts: number;         // 10 (0 = infinite)
  jitterPercent: number;       // 20 — adds +/-20% randomness
}

// Reconnection state machine:
// CONNECTED -> (error) -> RECONNECTING -> (success) -> CONNECTED
//                      -> (max attempts) -> DEAD -> (manual restart) -> RECONNECTING

// Feed health event emitted on state change:
interface FeedHealthEvent extends SentinelEvent {
  type: 'FEED_HEALTH';
  data: {
    feed: FeedSource;
    status: 'CONNECTED' | 'RECONNECTING' | 'DEAD';
    reconnectAttempt: number;
    lastError: string | null;
    lastEventAt: number | null;
  };
}
```

### Heartbeat Monitoring

Each feed has a heartbeat timeout. If no events received within the timeout, the feed is considered stale and a reconnection is triggered.

```typescript
const HEARTBEAT_TIMEOUTS: Record<FeedSource, number> = {
  birdeye: 30_000,        // 30s — should get price updates every 5s
  jupiter: 60_000,        // 60s — polling fallback, more lenient
  helius: 30_000,         // 30s — websocket should be active
  twitter: 120_000,       // 2min — polling every 60s
  newsapi: 600_000,       // 10min — polling every 5min
  'whale-alert': 600_000, // 10min — whale moves are infrequent
};
```

---

## 8. Rate Limit Management

```typescript
const RATE_LIMITS: Record<FeedSource, RateLimitConfig> = {
  birdeye: {
    requestsPerSecond: 10,
    requestsPerMinute: 300,
    burstSize: 5,
    retryAfterHeader: true,
  },
  helius: {
    requestsPerSecond: 50,    // Depends on tier
    requestsPerMinute: 1000,
    burstSize: 10,
    retryAfterHeader: true,
  },
  twitter: {
    requestsPerMinute: 15,    // Basic API tier
    burstSize: 1,
    retryAfterHeader: true,
  },
  jupiter: {
    requestsPerSecond: 5,
    burstSize: 3,
    retryAfterHeader: false,
  },
  newsapi: {
    requestsPerMinute: 100,
    burstSize: 5,
    retryAfterHeader: false,
  },
  'whale-alert': {
    requestsPerMinute: 30,
    burstSize: 3,
    retryAfterHeader: false,
  },
};

// Token bucket implementation for each feed
// Queued requests wait for available tokens
// 429 responses trigger exponential backoff independent of bucket
```
