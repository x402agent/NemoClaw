# Agent 2: Token Launch Monitor — Bot Commands, Formatters & Wiring

## Objective

Add `/monitor` command support to the existing PumpFun Telegram bot, create notification formatters for new token launches, and wire the `TokenLaunchMonitor` (built by Agent 1) into the bot's startup flow.

## Context

The existing telegram-bot at `telegram-bot/src/` has:
- `bot.ts` — grammY bot with command handlers (`/watch`, `/unwatch`, `/list`, `/status`, `/help`)
- `formatters.ts` — HTML message formatters for Telegram (claim notifications, help text, etc.)
- `index.ts` — Entry point that creates bot, creates monitor, wires callbacks, starts everything
- `store.ts` — Simple in-memory store for watch entries
- `types.ts` — All shared types
- `config.ts` — Environment variable loader

**Agent 1 is simultaneously building** `token-launch-monitor.ts` which exports:
- `TokenLaunchMonitor` class (constructor takes `BotConfig` and `onTokenLaunch` callback)
- `TokenLaunchEvent` interface
- `TokenLaunchMonitorState` interface

Agent 1 is also adding to `types.ts`:
- `enableLaunchMonitor: boolean` to `BotConfig`
- `githubOnlyFilter: boolean` to `BotConfig`  
- `ipfsGateway: string` to `BotConfig`

And to `config.ts`:
- `ENABLE_LAUNCH_MONITOR`, `GITHUB_ONLY_FILTER`, `IPFS_GATEWAY` env vars

**Study these files carefully before making changes:**
- `telegram-bot/src/bot.ts` — Existing command handler pattern
- `telegram-bot/src/formatters.ts` — Existing HTML formatting style
- `telegram-bot/src/index.ts` — Startup/wiring flow
- `telegram-bot/src/store.ts` — Storage pattern

## Files to Create/Modify

### 1. Create `telegram-bot/src/launch-store.ts`

In-memory store tracking which chat IDs have the launch monitor active, with optional filters:

```typescript
/**
 * PumpFun Telegram Bot — Launch Monitor Store
 *
 * Tracks which chats have /monitor active and their filter preferences.
 */

export interface LaunchMonitorEntry {
  /** Telegram chat ID */
  chatId: number;
  /** Who activated monitoring */
  activatedBy: number;
  /** Only show tokens with GitHub links */
  githubOnly: boolean;
  /** Active status */
  active: boolean;
  /** When activated (unix ms) */
  activatedAt: number;
}
```

Functions to implement:
- `activateMonitor(chatId, userId, githubOnly)` — Add/update entry
- `deactivateMonitor(chatId)` — Set active = false
- `getActiveMonitors()` — Return all active entries
- `isMonitorActive(chatId)` — Check if chat has active monitor
- `getMonitorEntry(chatId)` — Get entry for a chat

### 2. Modify `telegram-bot/src/bot.ts`

Add these new commands:

#### `/monitor [github]`
- Activates the real-time token launch feed for the current chat
- Optional `github` argument: only show tokens with GitHub links
- Examples:
  - `/monitor` — Show ALL new token launches
  - `/monitor github` — Only show tokens with GitHub links
- Response: Confirmation message with current filter settings
- If already active, update the filter and confirm

#### `/stopmonitor`
- Deactivates the token launch feed for the current chat
- Response: Confirmation message

#### Update `/help`
- Add the new commands to the help text

#### Update `/status`
- Include token launch monitor stats (tokens detected, tokens with GitHub, monitor mode)

**Implementation pattern** — follow the exact same pattern as existing commands:
```typescript
bot.command('monitor', (ctx) => handleMonitor(ctx));
bot.command('stopmonitor', (ctx) => handleStopMonitor(ctx));
```

The `createBot` function needs to accept the `TokenLaunchMonitor` as an additional parameter (or accept it as optional so the code compiles even before Agent 1's work is integrated).

### 3. Modify `telegram-bot/src/formatters.ts`

Add these new formatter functions:

#### `formatTokenLaunchNotification(event: TokenLaunchEvent)`

Rich HTML notification for a new token launch. Example output:

```
🚀 New Token Launched!

🪙 Name: MyToken (MTK)
👤 Creator: Ab3f...8x2Q
🔗 Mint: 7xKX...9pQm

🌐 GitHub: https://github.com/user/repo
⚡ Mayhem Mode: ❌
🕐 Time: 2026-02-27 14:32:15 UTC

🔗 View TX · Solscan · pump.fun
```

Include links:
- Solscan TX link: `https://solscan.io/tx/{signature}`
- Solscan mint: `https://solscan.io/token/{mintAddress}`
- pump.fun: `https://pump.fun/coin/{mintAddress}`
- GitHub link(s) if present

#### `formatMonitorActivated(githubOnly: boolean)`

```
✅ Token Launch Monitor Activated!

Mode: {All launches / GitHub-linked only}
You'll receive real-time notifications for new PumpFun token launches.

Stop with: /stopmonitor
```

#### `formatMonitorDeactivated()`

```
⏹️ Token Launch Monitor Stopped

No more launch notifications will be sent to this chat.
Re-enable with: /monitor
```

#### `formatMonitorStatus(state: TokenLaunchMonitorState)`

Stats display for the token launch monitor, to be included in `/status` output.

### 4. Modify `telegram-bot/src/index.ts`

Wire everything together in the entry point:

```typescript
// Pseudocode flow:
import { TokenLaunchMonitor } from './token-launch-monitor.js';
import { getActiveMonitors } from './launch-store.js';

// Create the token launch monitor
const launchMonitor = new TokenLaunchMonitor(config, async (event) => {
  // Get all active monitor subscriptions
  const monitors = getActiveMonitors();
  
  for (const entry of monitors) {
    // Apply github filter
    if (entry.githubOnly && !event.hasGithub) continue;
    
    // Send notification
    try {
      const message = formatTokenLaunchNotification(event);
      await bot.api.sendMessage(entry.chatId, message, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      });
    } catch (err) {
      log.error('Failed to send launch notification to chat %d:', entry.chatId, err);
    }
  }
});

// Start if enabled
if (config.enableLaunchMonitor) {
  await launchMonitor.start();
}
```

**Important**: Handle the case where Agent 1's files don't exist yet gracefully. Use dynamic imports or optional chaining so the bot still starts without the monitor.

### 5. Update help text and status in formatters

Update `formatHelp()` to include:
```
📡 Launch Monitor:
/monitor [github] — Start real-time token launch feed
/stopmonitor — Stop the launch feed
```

Update `formatStatus()` to accept an optional `TokenLaunchMonitorState` parameter and display launch monitor stats.

## Constraints

- Follow the EXACT same code style as existing files — same JSDoc patterns, same formatting, same eslint conventions
- Use grammY's `ctx.reply()` with `{ parse_mode: 'HTML' }` for all responses
- All HTML must be properly escaped using the existing `escapeHtml` helper in formatters.ts
- Use the existing `shortAddr` helper for truncating addresses
- Do NOT install any new npm packages
- Keep the launch-store.ts simple (in-memory Map, no persistence needed)
- Make sure the bot still compiles and works even if token-launch-monitor.ts hasn't been created yet (use try/catch around dynamic imports if needed)

## Integration Notes

When pasting changes, be aware that Agent 1 may have already modified `types.ts` and `config.ts`. If there are merge conflicts:
- Agent 1's changes to `types.ts` add: `CREATE_V2_DISCRIMINATOR`, `CREATE_DISCRIMINATOR`, and new `BotConfig` fields
- Agent 1's changes to `config.ts` add: new env var loading
- Your changes should be **additive** and not conflict with Agent 1's

## Terminal Management

- **Always use background terminals** (`isBackground: true`) for every command
- **Always kill the terminal** after the command completes
- Do not reuse foreground shell sessions

