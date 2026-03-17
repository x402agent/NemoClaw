---
applyTo: "**"
---
# Pump Segments SDK (pump-fun/pump-segments-sdk)

## Skill Description

Reference the official Pump Segments SDK when working with user segmentation, A/B testing, cohort targeting, or user analytics pipelines. This SDK provides client-side access to Pump's user segmentation system backed by DynamoDB and BigQuery.

**Repository:** [pump-fun/pump-segments-sdk](https://github.com/pump-fun/pump-segments-sdk)

## When to Use

- Checking if a user belongs to a specific segment
- Querying segment membership for feature flags or A/B tests
- Exporting user lists from segments (paginated)
- Streaming large segment populations
- Understanding Pump's user segmentation architecture
- Building notifications, campaigns, or targeted features

## Architecture

| Component | Purpose |
|-----------|---------|
| `SegmentClient` | DynamoDB client for segment queries |
| `Segment` | High-level wrapper for a single segment |
| `SegmentDefinition` | SQL-based segment definition (BigQuery) |
| Lambda (backend) | Runs BigQuery SQL on schedule, writes results to DynamoDB |

**Data flow:** BigQuery SQL → Lambda (scheduled) → DynamoDB → SegmentClient (this SDK)

## Key Classes

### SegmentClient

```typescript
import { SegmentClient } from '@pump-fun/pump-segments-sdk';

const client = new SegmentClient({
  tableName: 'segments',
  region: 'us-east-1',
});

// Check membership
const isMember = await client.isMember('mobile-users-no-notifications', 'user_123');

// Get detailed membership
const membership = await client.getMembership('mobile-high-volume-traders', 'user_456');
// { inSegment: true, versionId: '5', sampleBucket: 4231, joinedAt: 1709... }

// Get metadata
const meta = await client.getMetadata('mobile-active-yesterday');
// { segmentId, versionId, memberCount, updatedAt, status, stats }

// Export users (paginated)
const result = await client.exportUsers('mobile-users-no-notifications', { limit: 1000 });

// Stream all users
for await (const batch of client.streamUsers('mobile-active-yesterday', 500)) {
  console.log(`Batch of ${batch.length} users`);
}
```

### Segment (high-level wrapper)

```typescript
import { SegmentClient, segment } from '@pump-fun/pump-segments-sdk';

const client = new SegmentClient({ tableName: 'segments' });
const seg = segment(client, 'mobile-high-volume-traders');

await seg.contains('user_123');           // boolean
await seg.getAll({ limit: 100 });         // ExportResult
await seg.getSample(0.1);                 // 10% sample
await seg.count();                        // number
for await (const batch of seg.stream()) { /* ... */ }
```

## Built-in Segments

| Segment ID | Description | Schedule |
|------------|-------------|----------|
| `mobile-users-no-notifications` | Mobile users with 0 notifications in last 8 days | Daily |
| `mobile-high-volume-traders` | Mobile users with $1k+ weekly volume | Daily |
| `mobile-active-yesterday` | Mobile users active yesterday | Daily |

## Key Types

```typescript
interface SegmentClientConfig {
  tableName: string;
  region?: string;
  endpoint?: string;  // For local DynamoDB
}

interface SegmentMetadata {
  segmentId: SegmentId;
  versionId: string;
  memberCount: number;
  updatedAt: number;
  status: 'ready' | 'updating' | 'failed';
  stats?: { added?: number; removed?: number; durationMs: number; bigQueryBytes: number };
}

interface MembershipResult {
  inSegment: boolean;
  versionId: string;
  sampleBucket?: number;  // 0-9999, for deterministic sampling
  joinedAt?: number;
}
```

## Sampling System

Uses MurmurHash3 for deterministic bucketing:
```typescript
import { computeSampleBucket, isInSample } from '@pump-fun/pump-segments-sdk';

const bucket = computeSampleBucket(userId, segmentId, salt); // 0-9999
const inSample = isInSample(bucket, 0.1); // true if bucket < 1000 (10%)
```

## DynamoDB Schema

| Key | Pattern | Content |
|-----|---------|---------|
| PK | `SEGMENT#{id}#META` / SK: `METADATA` | Segment metadata |
| PK | `SEGMENT#{id}#V#{version}` / SK: `USER#{userId}` | User membership |

## Critical Rules

1. Segments are **read-only** from the SDK — a Lambda populates DynamoDB
2. `sampleBucket` enables deterministic A/B testing without additional randomization
3. Always use `SegmentId` type (union of valid segment IDs) — not arbitrary strings
4. Pagination uses base64-encoded DynamoDB `LastEvaluatedKey` as cursor
