---
applyTo: "**"
---
# Transfer Hook Authority Program (pump-fun/transfer-hook-authority)

## Skill Description

Reference the official Pump transfer hook authority program when working with Token2022 transfer hooks, token transfer restrictions, or the Pump protocol's transfer hook mechanism.

**Repository:** [pump-fun/transfer-hook-authority](https://github.com/pump-fun/transfer-hook-authority)

## When to Use

- Implementing or interacting with Token2022 transfer hooks on Pump tokens
- Understanding why Pump tokens use transfer hooks
- Working with the `ExtraAccountMetaList` for Pump token transfers
- Debugging Token2022 transfer failures related to transfer hooks
- Building instructions that include transfer hook accounts

## Program Details

| Field | Value |
|-------|-------|
| Program ID | `333UA891CYPpAJAthphPT3hg1EkUBLhNFoP9HoWW3nug` |
| Framework | Anchor |
| Language | Rust |
| Purpose | No-op transfer hook authority for Pump Token2022 tokens |

## What This Program Does

The transfer hook authority program is intentionally **empty** — it's a no-op program. It exists solely to satisfy the Token2022 transfer hook interface requirement. When Pump tokens are created with `create_v2` (Token2022), they are configured with this program as their transfer hook authority.

```rust
use anchor_lang::prelude::*;

declare_id!("333UA891CYPpAJAthphPT3hg1EkUBLhNFoP9HoWW3nug");

#[program]
pub mod transfer_hook_authority {}
```

## Why It Exists

1. **Token2022 requirement**: Pump tokens created via `create_v2` use Token2022 with transfer hooks
2. **No-op by design**: The program does nothing — it just needs to exist on-chain so the Token2022 runtime can call it during transfers
3. **Transfer hook interface**: Token2022 expects `ExtraAccountMetaList` and an `execute` instruction; this program satisfies the interface without adding restrictions

## Integration with Pump SDK

When building transfer instructions for Pump Token2022 tokens:

1. Include the transfer hook program ID (`333UA891CYPpAJAthphPT3hg1EkUBLhNFoP9HoWW3nug`) in remaining accounts
2. Include the `ExtraAccountMetaList` PDA account
3. The token program will CPI into this no-op program during transfers — no special handling needed

## Critical Rules

1. **Do not modify this program** — it must remain a no-op for all Pump Token2022 tokens to transfer correctly
2. Always include transfer hook accounts when transferring Pump Token2022 tokens
3. This program is only relevant for `create_v2` tokens (Token2022), not legacy `create` tokens (SPL Token)
