

# Fix Music NFT Library Loading Timeouts

## Problem

When loading a user's music NFT library, the API requests time out too quickly (5 seconds per endpoint). For users with large collections, many paginated requests are needed, and the AtomicAssets APIs often take longer than 5 seconds to respond -- especially under load. This causes partial loads, requiring multiple refreshes to see the full collection.

## Changes

### 1. Increase timeouts in `useMusicNFTs.ts`

- **`fetchApiPage`**: Increase timeout from 5s to 15s -- these are paginated queries that can be slow for large collections
- **`fetchAssetMetadata`**: Increase timeout from 5s to 12s -- batch ID lookups can also be slow

### 2. Increase default timeout in `fetchWithFallback.ts`

- Change default timeout from 8s to 15s so any caller not specifying a timeout also gets a more generous window

### 3. Add per-endpoint retry with backoff in `fetchWithFallback.ts`

- Before moving to the next fallback endpoint, retry the current endpoint once after a 1-second delay if the failure was a timeout (abort). This handles transient slowness without immediately burning through all endpoints.

## Files to Edit

| File | Change |
|------|--------|
| `src/lib/fetchWithFallback.ts` | Increase default timeout to 15s; add single retry on timeout for each endpoint |
| `src/hooks/useMusicNFTs.ts` | Change timeout in `fetchApiPage` from 5000 to 15000; change timeout in `fetchAssetMetadata` from 5000 to 12000 |

## Technical Details

**`fetchWithFallback.ts`** -- updated logic:

```text
for each endpoint:
  attempt 1: fetch with timeout
  if timeout -> wait 1s, attempt 2 with same endpoint
  if still fails -> move to next endpoint
```

**`useMusicNFTs.ts`** -- two line changes:

- Line ~259: `fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 5000)` becomes `12000`
- Line ~338: `fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 5000)` becomes `15000`

This should allow the library to fully load on the first attempt for most users without needing to refresh.

