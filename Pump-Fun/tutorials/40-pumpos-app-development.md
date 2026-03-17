# Tutorial 40: Building PumpOS Apps for the Pump Store

> Create desktop applications for the PumpOS browser-based operating system — windows, file system, notifications, and the Pump Store.

## Prerequisites

- Basic HTML/CSS/JavaScript
- A text editor
- Understanding of `postMessage` for iframe communication

## What Is PumpOS?

PumpOS is a browser-based desktop environment with:
- **Window manager** — Draggable, resizable windows with titlebar controls
- **Virtual file system** — IndexedDB-backed, encrypted per-user
- **Multi-user profiles** — Isolated, encrypted storage
- **Pump Store** — App marketplace with 29+ applications
- **NTX API** — `postMessage`-based API for apps to access OS features
- **Offline mode** — Service worker caches everything

```
┌─────────────────────────────────────┐
│  PumpOS Desktop                     │
│  ┌──────────┐  ┌──────────┐        │
│  │  Your App │  │ Dashboard │       │
│  │  (iframe) │  │ (iframe)  │       │
│  │           │  │           │       │
│  └──────────┘  └──────────┘        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  [Start] [Apps...]        [Clock]   │
└─────────────────────────────────────┘
```

## Step 1: Create a Basic App

Each PumpOS app is a standalone HTML file that runs in an iframe:

```html
<!-- my-app.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My Pump App</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #1a1a2e;
      color: #eee;
    }
    h1 { color: #00ff88; margin-top: 0; }
    button {
      background: #00ff88;
      color: #000;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover { background: #00cc6a; }
  </style>
</head>
<body>
  <h1>🚀 My Pump App</h1>
  <p>Hello from PumpOS!</p>
  <button onclick="showNotification()">Send Notification</button>
  <button onclick="readFile()">Read File</button>
  <button onclick="askUser()">Ask Question</button>

  <div id="output"></div>

  <script>
    // Access the PumpOS SDK via parent window
    const sdk = window.parent.pumpfunsdk;

    function showNotification() {
      sdk.notify("Hello from My App!", "info");
    }

    async function readFile() {
      const content = await sdk.getFileByPath("/documents/notes.txt");
      document.getElementById("output").textContent =
        content || "File not found";
    }

    async function askUser() {
      const answer = await sdk.ask("What's your favorite token?");
      document.getElementById("output").textContent =
        "Answer: " + answer;
    }
  </script>
</body>
</html>
```

## Step 2: The PumpOS SDK API

Every app has access to `window.parent.pumpfunsdk`:

```javascript
const sdk = window.parent.pumpfunsdk;

// === Dialogs ===
const answer = await sdk.ask("What's your name?");     // Text input dialog
sdk.say("Hello, " + answer);                           // Alert dialog
const ok = await sdk.justConfirm("Delete file?");      // Confirm dialog

// === Notifications ===
sdk.notify("Token launched!", "success");               // Toast notification

// === File System ===
await sdk.createFile("notes.txt", "/documents/", "Hello world");
const content = await sdk.getFileByPath("/documents/notes.txt");
const file = await sdk.getFileById("file-uid-123");
const files = await sdk.getFileNamesByFolder("/documents/");

// === App Management ===
const apps = sdk.appInstances();                        // All open windows
sdk.openFile("path/to/file");                          // Open in default app

// === Utilities ===
const uid = sdk.genUID();                              // Generate unique ID
const compressed = sdk.shrinkString(longText);         // Compress string
const original = sdk.unshrinkString(compressed);       // Decompress

// === Current User ===
const username = sdk.CurrentUsername;
```

## Step 3: Inter-App Communication

Apps communicate via the Event Bus:

```javascript
// In App A: Send a message
window.parent.postMessage({
  __eventBus: true,
  payload: {
    type: "token-alert",
    event: "new-launch",
    data: {
      mint: "TokenMint...",
      name: "PumpCoin",
      price: 0.001,
    },
  },
}, "*");

// In App B: Listen for messages
window.addEventListener("message", (event) => {
  if (event.data?.__eventBus && event.data.payload?.type === "token-alert") {
    const { mint, name, price } = event.data.payload.data;
    console.log(`New launch: ${name} at ${price} SOL`);
  }
});
```

## Step 4: Build a Token Dashboard App

A more complete example — a live token price tracker:

```html
<!-- token-dashboard.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Token Dashboard</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body {
      font-family: monospace;
      background: #0d1117;
      color: #c9d1d9;
      padding: 12px;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .header h2 { color: #58a6ff; font-size: 14px; }
    .token-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }
    .token-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 10px;
    }
    .token-name { color: #58a6ff; font-weight: bold; }
    .token-price { color: #3fb950; font-size: 18px; margin: 4px 0; }
    .token-meta { color: #8b949e; font-size: 11px; }
    .status { color: #8b949e; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>📊 Token Dashboard</h2>
    <span class="status" id="status">Connecting...</span>
  </div>
  <div class="token-grid" id="grid"></div>

  <script>
    const sdk = window.parent.pumpfunsdk;
    const tokens = new Map();

    // Listen for token events from other apps
    window.addEventListener("message", (event) => {
      if (!event.data?.__eventBus) return;
      const payload = event.data.payload;

      if (payload.type === "token-update") {
        updateToken(payload.data);
      }
    });

    function updateToken(data) {
      tokens.set(data.mint, data);
      render();
    }

    function render() {
      const grid = document.getElementById("grid");
      grid.innerHTML = "";

      for (const [mint, token] of tokens) {
        const card = document.createElement("div");
        card.className = "token-card";
        card.innerHTML = `
          <div class="token-name">${escapeHtml(token.name)}</div>
          <div class="token-price">${token.price.toFixed(6)} SOL</div>
          <div class="token-meta">
            ${token.holders || "?"} holders · ${token.progress || "?"}% curve
          </div>
          <div class="token-meta">${mint.slice(0, 8)}...</div>
        `;
        grid.appendChild(card);
      }

      document.getElementById("status").textContent =
        `${tokens.size} tokens tracked`;
    }

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    // Notify the OS that we're ready
    sdk.notify("Dashboard loaded", "info");
  </script>
</body>
</html>
```

## Step 5: Register in the Pump Store

Add your app to the store by creating an entry:

```
site/Pump-Store/apps/
├── my-app.html           ← Your app file
├── dashboard.html
├── cli.html
├── portfolio.html
└── ... (29 apps total)
```

### App Metadata

Register your app in the Pump Store database with:

```javascript
// App registration object
const appEntry = {
  name: "Token Dashboard",
  icon: "📊",
  description: "Real-time token price tracker for PumpOS",
  category: "DeFi",
  author: "Your Name",
  file: "token-dashboard.html",
  width: 600,
  height: 400,
  resizable: true,
};
```

## Step 6: Working with the File System

Create a notes app that persists data:

```javascript
const sdk = window.parent.pumpfunsdk;
const username = sdk.CurrentUsername;

// Save user notes
async function saveNotes(content) {
  await sdk.createFile(
    "trading-notes.txt",
    `/users/${username}/documents/`,
    content
  );
  sdk.notify("Notes saved!", "success");
}

// Load user notes
async function loadNotes() {
  const content = await sdk.getFileByPath(
    `/users/${username}/documents/trading-notes.txt`
  );
  return content || "";
}

// List all files in a folder
async function listDocuments() {
  return await sdk.getFileNamesByFolder(
    `/users/${username}/documents/`
  );
}
```

## Existing Pump Store Apps

| App | Description |
|-----|-------------|
| `cli` | Terminal emulator |
| `dashboard` | DeFi dashboard |
| `portfolio` | Token portfolio tracker |
| `pumpai` | AI assistant |
| `pumpbot` | Trading bot UI |
| `pumpdefi` | DeFi aggregator |
| `pumpdocs` | Documentation viewer |
| `cryptonews` | Crypto news feed |
| `json` | JSON editor |
| `paintviz` | Drawing tool |
| `pdfviewer` | PDF viewer |

## Best Practices

| Do | Don't |
|----|-------|
| Escape all user content with `textContent` | Use `innerHTML` with untrusted data |
| Use `sdk.notify()` for feedback | Use `alert()` (blocks the OS) |
| Keep apps under 100KB | Load heavy frameworks |
| Use OS dark theme colors | Force light backgrounds |
| Handle missing `sdk` gracefully | Assume `window.parent.pumpfunsdk` exists |

## Next Steps

- See [Tutorial 26](./26-live-dashboard-deployment.md) for standalone dashboards
- See [Tutorial 43](./43-standalone-plugin-artifacts.md) for chat-embedded interactive UIs
- Browse existing apps in `site/Pump-Store/apps/` for inspiration
