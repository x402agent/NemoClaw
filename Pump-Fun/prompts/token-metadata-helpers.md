# Token Metadata Helpers

## Objective

Add token metadata utilities to the core SDK for uploading images/metadata to Arweave and IPFS, and building the metadata JSON required by `createV2`.

## Context

When creating a token via `createV2Instruction`, the `uri` parameter must point to a JSON metadata file hosted on IPFS or Arweave. Currently, users must handle this themselves. This feature adds helpers to the SDK.

**Existing SDK patterns** (study these first):
- `src/sdk.ts` — `PumpSdk` class, instruction builders
- `src/online-sdk.ts` — `OnlinePumpSdk` with RPC fetchers
- `src/types.ts` — Shared types

## Architecture

### New Files

```
src/
├── metadata/
│   ├── index.ts              # Re-exports
│   ├── types.ts              # Metadata types
│   ├── builder.ts            # Metadata JSON builder
│   ├── ipfs.ts               # IPFS upload (Pinata, nft.storage, web3.storage)
│   ├── arweave.ts            # Arweave upload (Bundlr/Irys)
│   └── validation.ts         # Metadata schema validation
```

### Metadata JSON Schema (Metaplex Standard)

```typescript
interface TokenMetadata {
  name: string;                    // Required — token name
  symbol: string;                  // Required — ticker
  description?: string;            // Optional
  image: string;                   // Required — URL to image
  external_url?: string;           // Optional — website
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;              // MIME type
    }>;
    category?: string;           // "image"
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
  // PumpFun-specific extensions
  twitter?: string;
  telegram?: string;
  website?: string;
}
```

### Builder API

```typescript
const metadata = new MetadataBuilder()
  .setName('My Token')
  .setSymbol('MTK')
  .setDescription('A cool token')
  .setImage(imageBuffer, 'image/png')   // Auto-uploads
  .setWebsite('https://mytoken.com')
  .setTwitter('https://twitter.com/mytoken')
  .setTelegram('https://t.me/mytoken')
  .build();

// Upload to IPFS
const uri = await uploadToIPFS(metadata, { provider: 'pinata', apiKey: '...' });

// Or Arweave
const uri = await uploadToArweave(metadata, { provider: 'irys', wallet: keypair });

// Use in createV2
const instructions = sdk.createV2Instruction({ ..., uri });
```

### IPFS Providers

1. **Pinata** — `https://api.pinata.cloud/pinning/pinFileToIPFS`
2. **nft.storage** — `https://api.nft.storage/upload` (free, IPFS + Filecoin)
3. **web3.storage** — `https://api.web3.storage/upload`

### Arweave Providers

1. **Irys (formerly Bundlr)** — Pay with SOL, permanent storage
2. **Arweave direct** — AR token payment

## Implementation Rules

1. Builder pattern — fluent API with method chaining
2. Image upload before metadata upload (image URI goes into metadata JSON)
3. Validate metadata schema before upload
4. Support both `Buffer` and `File`/`Blob` for images
5. Return the final URI string ready for `createV2Instruction`
6. No new crypto libraries — use `@solana/web3.js` for signing Arweave uploads
7. All providers are optional — user chooses which to use

## Deliverables

1. Complete `src/metadata/` directory
2. `MetadataBuilder` class with fluent API
3. IPFS upload (Pinata + nft.storage)
4. Arweave upload (Irys)
5. Metadata validation
6. Export from `src/index.ts`
7. Tests with mocked upload responses
8. Update `README.md` usage examples
