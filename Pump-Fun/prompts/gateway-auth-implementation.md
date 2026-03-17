# Gateway — Basic Auth & OAuth2 Support

## Objective

Implement Basic Auth and OAuth2 authorization in the plugin gateway, and enable the 2 skipped tests.

## Context

The gateway at `packages/plugin.delivery/packages/gateway/src/gateway.ts` routes plugin API calls through SwaggerClient. It currently supports API Key and Bearer Token auth, but Basic Auth and OAuth2 are commented out with a TODO.

## Files to Modify

### 1. `packages/plugin.delivery/packages/gateway/src/gateway.ts`

**Current state** (around line 297):
```typescript
// TODO: Basic Auth and OAuth2
// if (key.endsWith('_username') && key.endsWith('_password')) {
//   authorizations.basicAuth = new SwaggerClient.PasswordAuthorization(username, password);
// } else if (key.endsWith('_clientId') && key.endsWith('_clientSecret')) {
//   authorizations.oauth2 = { accessToken, clientId, clientSecret };
```

**Implementation:**
- Parse settings keys ending in `_username` + matching `_password` for Basic Auth
- Parse settings keys ending in `_clientId` + matching `_clientSecret` + `_accessToken` for OAuth2
- Construct proper SwaggerClient authorization objects
- Handle edge cases: missing counterpart keys, empty values

**Pseudocode:**
```typescript
// After existing API key / bearer token logic:

// Basic Auth: look for paired _username + _password settings
const usernameKey = Object.keys(settings).find(k => k.endsWith('_username'));
const passwordKey = Object.keys(settings).find(k => k.endsWith('_password'));
if (usernameKey && passwordKey) {
  const username = settings[usernameKey];
  const password = settings[passwordKey];
  if (username && password) {
    authorizations.basicAuth = new SwaggerClient.PasswordAuthorization(username, password);
  }
}

// OAuth2: look for _clientId + _clientSecret + _accessToken
const clientIdKey = Object.keys(settings).find(k => k.endsWith('_clientId'));
const clientSecretKey = Object.keys(settings).find(k => k.endsWith('_clientSecret'));
const accessTokenKey = Object.keys(settings).find(k => k.endsWith('_accessToken'));
if (clientIdKey && clientSecretKey) {
  authorizations.oauth2 = {
    clientId: settings[clientIdKey],
    clientSecret: settings[clientSecretKey],
    ...(accessTokenKey && { accessToken: settings[accessTokenKey] })
  };
}
```

### 2. `packages/plugin.delivery/packages/gateway/tests/edge.test.ts`

**Current state** (lines ~493 and ~530):
```typescript
it.skip('should handle authorization correctly for basicAuth', ...
it.skip('should handle authorization correctly for OAuth2', ...
```

**Change:** Remove `.skip` from both tests:
```typescript
it('should handle authorization correctly for basicAuth', ...
it('should handle authorization correctly for OAuth2', ...
```

**Verify:** Run `vitest` and confirm both tests pass.

## Rules

- Match the existing code style exactly
- Don't break existing API Key / Bearer Token auth
- Both auth methods should coexist — if multiple auth types are configured, include all
- Never log credentials (username, password, clientSecret, accessToken)
- Remove the TODO comment after implementation

## Verification

```bash
cd packages/plugin.delivery
npx vitest run packages/gateway/tests/edge.test.ts
```

All tests should pass including the previously skipped ones.
