# Contributing to Pump SDK

Thank you for your interest in contributing to Pump SDK! Every contribution helps — whether it's a bug report, documentation improvement, or new feature.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [PR Checklist](#pr-checklist)

---

## Prerequisites

Before contributing, ensure you have:

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | ≥ 18.0 | `node --version` |
| npm | ≥ 9.0 | `npm --version` |
| Git | ≥ 2.30 | `git --version` |
| Rust (optional) | ≥ 1.70 | `rustc --version` (for vanity generator) |

No API keys or RPC endpoints are needed for development — the core SDK is offline-first and all unit tests use fixtures.

---

## Getting Started

1. **Fork** the repository on GitHub

2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pump-fun-sdk.git
   cd pump-fun-sdk
   ```

3. **Install** dependencies:
   ```bash
   npm install
   ```

4. **Build** the project:
   ```bash
   npm run build
   ```

5. **Run** tests to verify your setup:
   ```bash
   npm test
   ```

6. **Verify** TypeScript types:
   ```bash
   npm run typecheck
   ```

If all tests pass, you're ready to contribute.

---

## Development Workflow

### Branch Naming

Create a branch from `main` using these prefixes:

| Prefix | Use |
|--------|-----|
| `feat/` | New features (`feat/amm-deposit-instruction`) |
| `fix/` | Bug fixes (`fix/slippage-calculation`) |
| `docs/` | Documentation changes (`docs/api-reference`) |
| `refactor/` | Code restructuring (`refactor/pda-module`) |
| `test/` | Adding/fixing tests (`test/fee-tier-coverage`) |
| `chore/` | Maintenance (`chore/update-dependencies`) |

```bash
git checkout -b feat/your-feature-name
```

### Making Changes

1. Make your changes in the `src/` directory
2. Add or update tests in `src/__tests__/`
3. Run the test suite: `npm test`
4. Run type checking: `npm run typecheck`
5. Run linting: `npm run lint`
6. Build to verify: `npm run build`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build CJS + ESM with type declarations |
| `npm run dev` | Build in watch mode |
| `npm test` | Run all tests |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run typecheck` | Type-check without emitting |
| `npm run clean` | Remove `dist/` directory |

---

## Code Style

### TypeScript Conventions

- **Strict mode** is enabled — no `any` types without justification
- Use `BN` (bn.js) for all financial math — never JavaScript `number` for amounts
- Return `TransactionInstruction[]` from instruction builders, never `Transaction`
- Use `PublicKey` or `PublicKeyInitData` for address parameters
- Prefer explicit return types on public functions

### Formatting

The project uses ESLint with Prettier integration:

```bash
# Check
npm run lint

# Fix
npm run lint:fix
```

### What NOT to Do

- Do not use `createInstruction` (v1) — it is deprecated; use `createV2Instruction`
- Do not use JavaScript `number` for lamport or token amounts
- Do not add Node.js-specific APIs to `src/` (the SDK runs in browsers too)
- Do not import from `src/idl/` directly in new code — use SDK methods
- Do not commit `.env` files or private keys

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Single file
npx jest src/__tests__/bondingCurve.test.ts

# With coverage
npx jest --coverage
```

### Writing Tests

- Place unit tests in `src/__tests__/` alongside the modules they test
- Use shared fixtures from `src/__tests__/fixtures.ts`
- Test both happy paths and error cases
- Name test files `<module>.test.ts`

### Coverage Expectations

The project enforces per-file coverage thresholds:

| File | Lines | Branches | Functions |
|------|-------|----------|-----------|
| `bondingCurve.ts` | 90% | 90% | 80% |
| `fees.ts` | 75% | 75% | 80% |
| `analytics.ts` | 50%+ | 50%+ | 80%+ |
| `tokenIncentives.ts` | 75%+ | 60%+ | 80%+ |

New code should maintain or improve these thresholds.

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Build process, dependencies, tooling |
| `perf` | Performance improvement |

### Examples

```
feat(sdk): add ammDepositInstruction for LP operations
fix(fees): correct fee tier lookup for zero market cap
docs(readme): add fee sharing example
test(analytics): add price impact edge cases
```

---

## Pull Request Process

1. **Update your branch** with the latest `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push** your branch:
   ```bash
   git push origin feat/your-feature-name
   ```

3. **Open a PR** against `main` on GitHub

4. **Fill out** the PR template:
   - What does this PR do?
   - How was it tested?
   - Are there breaking changes?

5. **Wait for review** — maintainers aim to review within a few days

6. **Address feedback** with additional commits (don't force-push during review)

7. **Squash merge** will be used by maintainers when merging

---

## Issue Reporting

### Bug Reports

Include:
- SDK version (`npm list @nirholas/pump-sdk`)
- Node.js version
- Minimal reproduction code
- Expected vs. actual behavior
- Error message and stack trace

### Feature Requests

Include:
- Use case description
- Proposed API (TypeScript signature)
- Why existing APIs can't solve this

---

## PR Checklist

Before submitting, verify:

- [ ] Code compiles: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Types check: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] New functions have tests
- [ ] Public API changes are documented
- [ ] No `console.log` statements left in `src/`
- [ ] No private keys or `.env` files committed
- [ ] Commit messages follow conventional commits
- [ ] BN is used for all financial amounts (not `number`)
