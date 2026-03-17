# Code Cleanup — Resolve All TODOs

## Objective

Fix the 4 remaining code TODOs scattered across the codebase. These are small, isolated changes.

## Tasks

### 1. First-Visit Pulse Animation

**File:** `site/scripts/scripties.js` (line 6)

**Current:**
```javascript
// TODO: Add subtle pulse animation on first visit (check localStorage for first-time user)
```

**Implementation:**
```javascript
// After SVG is loaded into #mm:
if (!localStorage.getItem('pump_visited')) {
  localStorage.setItem('pump_visited', '1');
  const logo = document.querySelector('#mm svg');
  if (logo) {
    logo.style.animation = 'pulse 2s ease-in-out 3';
  }
}
```

Also add CSS (either inline via JS or in a `<style>` tag):
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}
```

Remove the TODO comment.

### 2. Remove `createAt` Field Migration

**File:** `packages/defi-agents/scripts/formatters/agent-formatter.ts` (line 224)

**Current:**
```typescript
if (!agent.createdAt) {
  // TODO: Remove createAt field
  agent.createdAt = agent.createAt;
}
```

**Implementation:**
- Check if all agent JSON files already have `createdAt` (not `createAt`)
- If yes: remove the migration code entirely — just delete the if block
- If no: run the migration first (update all agent JSONs), then remove the code
- Also delete the `createAt` property from any TypeScript interface/type that defines it

### 3. Drop `e.data.props` in SperaxOS Client v2

**File:** `packages/plugin.delivery/packages/sdk/client/speraxOS.ts` (line 37)

**Current:**
```typescript
// TODO: drop e.data.props in v2
const payload = e.data.payload || e.data.props; // Backward compat
```

**Implementation:**
- This is a v2 breaking change. For now, add a console.warn deprecation notice:
```typescript
const payload = e.data.payload || e.data.props;
if (e.data.props && !e.data.payload) {
  console.warn('[SperaxOS] e.data.props is deprecated. Use e.data.payload instead. Will be removed in v2.');
}
```
- Update the TODO to: `// DEPRECATED: e.data.props support will be removed in v2`

### 4. WebSocket Placeholder in UV Worker

**File:** `site/website/uv/uv.worker.js` (line 79)

**Current:**
```javascript
// WebSocket support - placeholder for now
```

**This is a third-party UV proxy file.** Do NOT modify it — leave the comment as-is. UV (Ultraviolet) WebSocket support is handled by the UV framework, not us.

**Action:** No change needed. Remove this from the TODO tracking.

## Verification

After changes, verify:
```bash
# Check no remaining TODOs (besides intentional ones)
grep -rn "TODO" site/scripts/scripties.js
grep -rn "TODO" packages/defi-agents/scripts/formatters/agent-formatter.ts
grep -rn "TODO" packages/plugin.delivery/packages/sdk/client/speraxOS.ts
```
