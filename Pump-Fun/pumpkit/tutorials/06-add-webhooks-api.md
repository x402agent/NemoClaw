# Add REST API + Webhooks

> Enable the REST API layer on your PumpKit monitor bot, set up authentication, register webhooks, stream events via SSE, and build a simple dashboard.

## What You'll Build

A full API layer on top of your PumpKit monitor that exposes PumpFun events via REST endpoints, Server-Sent Events (SSE) for live streaming, and webhooks for push delivery to your own backend.

```
PumpKit Monitor Bot
    │
    ├── Telegram messages (existing)
    │
    ├── REST API
    │   ├── GET  /api/v1/claims     → paginated history
    │   ├── GET  /api/v1/launches   → paginated launches
    │   └── GET  /api/v1/health     → service status
    │
    ├── SSE Stream
    │   └── GET  /api/v1/claims/stream → real-time events
    │
    └── Webhooks
        └── POST → your-backend.com/hook → HMAC-signed payloads
```

## Prerequisites

- Node.js 20+
- A working PumpKit monitor bot (from [Tutorial 01](01-your-first-bot.md))
- Completed [Tutorial 05](05-deploy-railway.md) (optional, for production deployment)

## Step 1: Enable the API

The `@pumpkit/monitor` package has a built-in REST API. Enable it via environment variables:

```bash
# Add to your .env file
ENABLE_API=true
API_PORT=3000
```

Start the monitor:

```bash
npm run dev --workspace=@pumpkit/monitor
```

```
[INFO] Bot started: @YourBotName
[INFO] ClaimMonitor: WebSocket subscription active
[INFO] API server listening on :3000      ← New!
```

Test it:

```bash
curl http://localhost:3000/api/v1/health
```

```json
{
  "status": "ok",
  "uptime": 42,
  "monitors": {
    "ClaimMonitor": { "running": true, "eventsProcessed": 0 }
  }
}
```

## Step 2: Set Up Authentication

Protect your API with bearer token authentication:

```bash
# Add to .env
API_KEYS=sk_live_your-secret-key-1,sk_live_another-key-2
```

Multiple comma-separated keys are supported. Each client gets their own key.

### Making Authenticated Requests

```bash
curl -H "Authorization: Bearer sk_live_your-secret-key-1" \
  http://localhost:3000/api/v1/claims
```

Without a valid key:

```bash
curl http://localhost:3000/api/v1/claims
```

```json
{ "error": "Unauthorized" }
```

> If `API_KEYS` is not set, the API runs **without authentication** (useful for local development only).

## Step 3: Query Claims

### List Recent Claims

```bash
curl -H "Authorization: Bearer sk_live_your-key" \
  "http://localhost:3000/api/v1/claims?limit=10&offset=0"
```

```json
{
  "claims": [
    {
      "signature": "5xK9...",
      "type": "claim_social_fee_pda",
      "amount": 0.5,
      "user": "5Q544fKr...",
      "token": "EPjFWdd5...",
      "timestamp": "2026-03-12T10:30:00Z"
    }
  ],
  "total": 142,
  "limit": 10,
  "offset": 0
}
```

### Filter by Wallet

```bash
curl -H "Authorization: Bearer sk_live_your-key" \
  "http://localhost:3000/api/v1/claims?wallet=5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
```

### Filter by Claim Type

```bash
curl -H "Authorization: Bearer sk_live_your-key" \
  "http://localhost:3000/api/v1/claims?type=collect_creator_fee"
```

### Query Launches

```bash
curl -H "Authorization: Bearer sk_live_your-key" \
  "http://localhost:3000/api/v1/launches?limit=5"
```

```json
{
  "launches": [
    {
      "signature": "3kQ7...",
      "mint": "Abc123...",
      "name": "My Token",
      "symbol": "MTK",
      "creator": "7xY9...",
      "timestamp": "2026-03-12T10:25:00Z"
    }
  ],
  "total": 38,
  "limit": 5,
  "offset": 0
}
```

## Step 4: Create and Manage Watches

Watches tell the API which wallets or tokens you want to monitor. They also control which events trigger webhook deliveries.

### Create a Watch

```bash
curl -X POST \
  -H "Authorization: Bearer sk_live_your-key" \
  -H "Content-Type: application/json" \
  -d '{"address": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", "label": "My Wallet"}' \
  http://localhost:3000/api/v1/watches
```

```json
{
  "id": "w_abc123",
  "address": "5Q544fKr...",
  "label": "My Wallet",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

### List Watches

```bash
curl -H "Authorization: Bearer sk_live_your-key" \
  http://localhost:3000/api/v1/watches
```

```json
{
  "watches": [
    { "id": "w_abc123", "address": "5Q544fKr...", "label": "My Wallet" }
  ]
}
```

### Delete a Watch

```bash
curl -X DELETE \
  -H "Authorization: Bearer sk_live_your-key" \
  http://localhost:3000/api/v1/watches/w_abc123
```

## Step 5: Register Webhook URLs

Webhooks push events to your backend server in real time. Each event matching a watch is delivered via HTTP POST.

### Register a Webhook

```bash
curl -X POST \
  -H "Authorization: Bearer sk_live_your-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-backend.com/pump-webhook"}' \
  http://localhost:3000/api/v1/webhooks
```

```json
{
  "id": "wh_xyz789",
  "url": "https://your-backend.com/pump-webhook",
  "createdAt": "2026-03-12T10:05:00Z"
}
```

### Webhook Delivery Format

When an event fires, your endpoint receives a POST request:

```http
POST /pump-webhook HTTP/1.1
Content-Type: application/json
X-PumpFun-Signature: sha256=a1b2c3d4e5f6...
X-Request-Id: req_abc123

{
  "event": "claim",
  "data": {
    "signature": "5xK9...",
    "type": "claim_social_fee_pda",
    "amount": 0.5,
    "user": "5Q544fKr...",
    "token": "EPjFWdd5..."
  },
  "watchIds": ["w_abc123"],
  "timestamp": "2026-03-12T10:30:00Z"
}
```

### Verify Webhook Signatures

Set a webhook secret in your environment:

```bash
WEBHOOK_SECRET=whsec_your-secret-here
```

Verify incoming webhooks in your backend:

```typescript
import crypto from "node:crypto";

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature)
  );
}

// In your HTTP handler:
app.post("/pump-webhook", (req, res) => {
  const signature = req.headers["x-pumpfun-signature"] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyWebhook(rawBody, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send("Invalid signature");
  }

  // Process the event
  console.log("Verified event:", req.body.event);
  res.status(200).send("OK");
});
```

### Webhook Retry Logic

Failed deliveries are retried with exponential backoff:

| Attempt | Delay | Timeout |
|---------|-------|---------|
| 1 | Immediate | 10s |
| 2 | 1s | 10s |
| 3 | 2s | 10s |
| 4 | 4s | 10s |
| 5+ | Dropped | — |

After 3 failed retries, the webhook delivery is dropped for that event. The webhook registration stays active for future events.

### Delete a Webhook

```bash
curl -X DELETE \
  -H "Authorization: Bearer sk_live_your-key" \
  http://localhost:3000/api/v1/webhooks/wh_xyz789
```

## Step 6: Stream Events via SSE

Server-Sent Events provide a persistent HTTP connection for real-time event streaming — no WebSocket library needed.

### Connect to the SSE Stream

```bash
curl -N -H "Authorization: Bearer sk_live_your-key" \
  http://localhost:3000/api/v1/claims/stream
```

Events arrive as they happen:

```
data: {"type":"claim_social_fee_pda","amount":0.5,"user":"5Q544fKr...","token":"EPjFWdd5...","signature":"5xK9..."}

data: {"type":"collect_creator_fee","amount":1.2,"user":"7xY9...","token":"Abc123...","signature":"3kQ7..."}

: heartbeat

data: {"type":"claim_cashback","amount":0.1,"user":"9zR3...","token":"Def456...","signature":"8mN2..."}
```

The server sends a heartbeat comment (`: heartbeat`) every 30 seconds to keep the connection alive.

### Consume SSE in JavaScript

```javascript
const eventSource = new EventSource(
  "http://localhost:3000/api/v1/claims/stream",
  {
    headers: { Authorization: "Bearer sk_live_your-key" },
  }
);

eventSource.onmessage = (event) => {
  const claim = JSON.parse(event.data);
  console.log(`${claim.type}: ${claim.amount} SOL`);
};

eventSource.onerror = () => {
  console.log("Connection lost, reconnecting...");
  // EventSource auto-reconnects by default
};
```

## Step 7: Build a Simple Dashboard

Create an `index.html` that consumes the SSE stream and renders live events:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PumpFun Live Claims</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
    h1 { color: #58a6ff; }
    .claim { border: 1px solid #30363d; padding: 12px; margin: 8px 0; border-radius: 6px; }
    .claim-social { border-left: 3px solid #3fb950; }
    .claim-creator { border-left: 3px solid #d2a8ff; }
    .claim-cashback { border-left: 3px solid #f0883e; }
    .amount { font-size: 1.2em; font-weight: bold; }
    .meta { color: #8b949e; font-size: 0.85em; }
    #status { padding: 8px; margin-bottom: 16px; border-radius: 4px; }
    .connected { background: #0d2818; color: #3fb950; }
    .disconnected { background: #3d1d00; color: #f0883e; }
    #claims { max-height: 80vh; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>PumpFun Live Claims</h1>
  <div id="status" class="disconnected">Connecting...</div>
  <div id="claims"></div>

  <script>
    const API_URL = "http://localhost:3000";
    const API_KEY = "sk_live_your-key";
    const claimsDiv = document.getElementById("claims");
    const statusDiv = document.getElementById("status");

    function connect() {
      const url = `${API_URL}/api/v1/claims/stream`;
      const es = new EventSource(url);

      es.onopen = () => {
        statusDiv.textContent = "Connected — streaming live claims";
        statusDiv.className = "connected";
      };

      es.onmessage = (event) => {
        const claim = JSON.parse(event.data);
        const typeClass = claim.type.includes("social")
          ? "claim-social"
          : claim.type.includes("creator")
            ? "claim-creator"
            : "claim-cashback";

        const card = document.createElement("div");
        card.className = `claim ${typeClass}`;
        card.innerHTML = `
          <div class="amount">${claim.amount} SOL</div>
          <div>${claim.type}</div>
          <div class="meta">
            User: ${claim.user?.slice(0, 8)}… |
            Token: ${claim.token?.slice(0, 8)}… |
            ${new Date().toLocaleTimeString()}
          </div>
        `;

        claimsDiv.prepend(card);

        // Keep only the last 100 cards
        while (claimsDiv.children.length > 100) {
          claimsDiv.removeChild(claimsDiv.lastChild);
        }
      };

      es.onerror = () => {
        statusDiv.textContent = "Disconnected — reconnecting...";
        statusDiv.className = "disconnected";
      };
    }

    connect();
  </script>
</body>
</html>
```

Open `index.html` in your browser. Claims appear in real time as they happen on-chain.

## Step 8: Rate Limiting

The API includes per-client sliding-window rate limiting:

```bash
# Configure in .env
RATE_LIMIT_MAX=100            # Max requests per window
RATE_LIMIT_WINDOW_MS=60000    # Window size (60 seconds)
```

Rate limit headers are included in every response:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1710243600
```

When exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{ "error": "Rate limit exceeded", "retryAfter": 45 }
```

## Full API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/health` | No | Service health + monitor status |
| `GET` | `/api/v1/status` | Yes | Detailed service status |
| `GET` | `/api/v1/claims` | Yes | Paginated claim history |
| `GET` | `/api/v1/claims/stream` | Yes | SSE real-time claim stream |
| `GET` | `/api/v1/launches` | Yes | Paginated token launches |
| `GET` | `/api/v1/watches` | Yes | List your watches |
| `POST` | `/api/v1/watches` | Yes | Create a watch |
| `DELETE` | `/api/v1/watches/:id` | Yes | Remove a watch |
| `POST` | `/api/v1/webhooks` | Yes | Register webhook URL |
| `DELETE` | `/api/v1/webhooks/:id` | Yes | Unregister webhook |

### Query Parameters

| Endpoint | Parameter | Type | Description |
|----------|-----------|------|-------------|
| `/claims` | `limit` | number | Results per page (max 100) |
| `/claims` | `offset` | number | Pagination offset |
| `/claims` | `wallet` | string | Filter by wallet address |
| `/claims` | `type` | string | Filter by claim type |
| `/launches` | `limit` | number | Results per page (max 100) |
| `/launches` | `offset` | number | Pagination offset |

## All Environment Variables

```bash
# ── API Server ──────────────────────────────────────────
ENABLE_API=true                    # Enable REST API (default: false)
API_PORT=3000                      # HTTP port (default: 3000)
API_KEYS=sk_live_key1,sk_live_key2 # Bearer tokens (comma-separated)
CORS_ORIGINS=*                     # Allowed origins (default: *)

# ── Rate Limiting ───────────────────────────────────────
RATE_LIMIT_MAX=100                 # Requests per window (default: 100)
RATE_LIMIT_WINDOW_MS=60000         # Window size in ms (default: 60000)

# ── Watches ─────────────────────────────────────────────
MAX_WATCHES_PER_CLIENT=100         # Max watches per API key

# ── Buffers ─────────────────────────────────────────────
CLAIM_BUFFER_SIZE=10000            # Ring buffer for recent claims

# ── Webhooks ────────────────────────────────────────────
WEBHOOK_SECRET=whsec_your-secret   # HMAC-SHA256 signing key
```

## Common Issues

| Issue | Fix |
|-------|-----|
| `CORS error` in browser | Set `CORS_ORIGINS=*` or your specific domain |
| SSE stream disconnects | EventSource auto-reconnects. Add heartbeat monitoring on your side |
| Webhook not receiving | Verify the URL is publicly accessible. Check firewall/NAT rules |
| `Invalid signature` | Ensure `WEBHOOK_SECRET` matches between sender and receiver |
| `429 Too Many Requests` | Reduce request frequency or increase `RATE_LIMIT_MAX` |
| API returns empty claims | The monitor needs to detect events first. Wait for on-chain activity |

## Next Steps

- [01 — Your First Bot](01-your-first-bot.md): Build the underlying bot that powers the API
- [02 — Channel Broadcast](02-channel-broadcast.md): Add a Telegram channel feed alongside the API
- [05 — Deploy to Railway](05-deploy-railway.md): Deploy your API-enabled bot to production
