

# Performance Optimization Plan: Apply Drops-Style NFT Loading Across CHEESEHub

## Summary

The CHEESEDrops marketplace recently received significant performance improvements including batch template fetching (~50x faster), progressive caching, and video-field detection. These optimizations should be applied to other NFT-viewing interfaces throughout CHEESEHub for a consistent, fast user experience.

---

## Current State Analysis

### What Drops Does Well (To Apply Elsewhere)

| Optimization | Implementation |
|-------------|----------------|
| **Batch Template Fetching** | `fetchTemplatesBatch()` fetches up to 100 templates per API call vs 1 request per template |
| **Progressive Enrichment** | `useEnrichDrops` shows data as it loads, updates UI progressively |
| **Global In-Memory Cache** | `enrichedDropsCache` persists across component re-renders and navigation |
| **Video Field Detection** | `getMediaUrl()` checks for `video` field when `img` is missing |
| **Smart Retry System** | `retryFailedDrops()` clears cache for failed items and re-fetches |
| **Prefetch Next Page** | `usePrefetchDrops()` loads upcoming pages in background |
| **Abort Controllers** | Prevents stale requests when user navigates away |

### Current NFT Viewers Needing Optimization

| Component | Current Pattern | Issues |
|-----------|-----------------|--------|
| **NFTSendManager** (Wallet Send) | Uses `useUserNFTs` hook | Already optimized with batch fetching and template fallback |
| **TreasuryNFTDeposit** (DAO) | Uses `useUserNFTs` hook | Same as above - shares the hook |
| **NFTVotePicker** (DAO Voting) | Uses `fetchUserNFTsBySchema` | Has hybrid on-chain + API approach, but fetches templates sequentially |
| **NFTStaking** (Farm) | Inline `useQuery` with custom logic | Sequential template fetches, no caching, re-fetches on every navigation |
| **PremintNFTPicker** (Drops) | Uses `useUserNFTs` hook | Already shares optimizations |

---

## Optimization Opportunities

### Priority 1: NFTStaking.tsx (Farm) - Highest Impact

**Current Problems:**
- Fetches templates **one at a time** in a loop (lines 612-651)
- No caching - refetches every time user visits farm
- Re-renders cause duplicate fetches
- ~500ms per template = 5+ seconds for 10 unindexed NFTs

**Solution:**
1. Replace sequential template loop with batch `fetchTemplatesBatch()` call
2. Add localStorage cache for template metadata (like `useUserNFTs`)
3. Use progressive loading pattern from `useEnrichDrops`

### Priority 2: NFTVotePicker.tsx (DAO) - Medium Impact

**Current Problems:**
- `fetchUserNFTsBySchema` fetches templates sequentially (lines 934-950 in atomicApi.ts)
- No persistent cache across component mounts

**Solution:**
1. Update `fetchUserNFTsBySchema` to batch missing templates using `fetchTemplatesBatch()`
2. Add in-memory cache for template data during session

### Priority 3: Create Shared NFT Template Cache

**Goal:** Single source of truth for template metadata across all components

**Implementation:**
- Create `src/lib/templateCache.ts` with:
  - `getTemplate(templateId, collectionName)` - checks cache first
  - `setTemplate(templateId, collectionName, data)` - updates cache
  - `batchGetOrFetch(requests[])` - checks cache, batch-fetches missing, returns all
  - localStorage persistence with TTL

---

## Detailed Implementation

### Phase 1: Create Shared Template Cache

**New File: `src/lib/templateCache.ts`**

```typescript
// In-memory + localStorage cache for NFT template metadata
const CACHE_KEY = 'cheesehub_template_cache_v1';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface TemplateData {
  name: string;
  image: string;
  isVideo?: boolean;
  timestamp: number;
}

const memoryCache = new Map<string, TemplateData>();

function makeKey(templateId: string, collectionName: string) {
  return `${collectionName}:${templateId}`;
}

export function getCachedTemplate(templateId: string, collectionName: string): TemplateData | null {
  const key = makeKey(templateId, collectionName);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  return null;
}

export function setCachedTemplate(templateId: string, collectionName: string, data: Omit<TemplateData, 'timestamp'>) {
  const key = makeKey(templateId, collectionName);
  memoryCache.set(key, { ...data, timestamp: Date.now() });
}

export async function batchGetOrFetch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, TemplateData>> {
  const results = new Map<string, TemplateData>();
  const toFetch: typeof requests = [];

  // Check cache first
  for (const req of requests) {
    const cached = getCachedTemplate(req.templateId, req.collectionName);
    if (cached) {
      results.set(makeKey(req.templateId, req.collectionName), cached);
    } else {
      toFetch.push(req);
    }
  }

  // Batch fetch missing from API
  if (toFetch.length > 0) {
    const fetched = await fetchTemplatesBatch(toFetch);
    for (const [key, data] of fetched) {
      const withTimestamp = { ...data, timestamp: Date.now() };
      memoryCache.set(key, withTimestamp);
      results.set(key, withTimestamp);
    }
  }

  return results;
}
```

### Phase 2: Update NFTStaking.tsx

**Changes to make:**

1. Import the template cache:
```typescript
import { batchGetOrFetch, getCachedTemplate, setCachedTemplate } from '@/lib/templateCache';
```

2. Replace the sequential template fetch loop (lines 612-668) with batch call:

```typescript
// Before (SLOW - sequential):
for (const [templateId, assetIds] of templateGroups) {
  const templatePath = `/atomicassets/v1/templates/${meta.collection}/${templateId}`;
  const templateResponse = await fetchWithFallback(...);
  // ... process one by one
}

// After (FAST - batch):
const templateRequests = Array.from(templateGroups.entries()).map(([templateId, assetIds]) => ({
  templateId: String(templateId),
  collectionName: assetMetadataMap.get(assetIds[0])?.collection || '',
}));

const templateData = await batchGetOrFetch(templateRequests);

for (const [templateId, assetIds] of templateGroups) {
  const meta = assetMetadataMap.get(assetIds[0]);
  const key = `${meta?.collection}:${templateId}`;
  const template = templateData.get(key);
  
  for (const assetId of assetIds) {
    assets.push({
      asset_id: assetId,
      name: template?.name || `NFT #${assetId}`,
      image: template?.image || '/placeholder.svg',
      collection: meta?.collection || 'Unknown',
      schema: meta?.schema || '',
      template_id: String(templateId),
    });
  }
}
```

3. Apply same fix to staked NFT details fetch (lines 700-800)

### Phase 3: Update fetchUserNFTsBySchema

**File: `src/services/atomicApi.ts` (lines 920-970)**

Replace sequential template fetch with batch:

```typescript
// Before (lines 934-950 - sequential):
for (const [key, assets] of templateGroups) {
  const templateData = await fetchTemplateById(templateId, collectionName);
  // ...
}

// After (batch):
const templateRequests = Array.from(templateGroups.entries()).map(([key]) => {
  const [collectionName, templateId] = key.split(':');
  return { templateId, collectionName };
});

const templates = await fetchTemplatesBatch(templateRequests);

for (const [key, assets] of templateGroups) {
  const template = templates.get(key);
  for (const asset of assets) {
    results.push({
      asset_id: asset.asset_id,
      name: template?.name || `NFT #${asset.asset_id}`,
      image: template?.image || '/placeholder.svg',
      // ...
    });
  }
}
```

### Phase 4: Add Video Field Support to All Viewers

Currently only Drops uses `getMediaUrl()` for video detection. Apply to:

| File | Current | Update |
|------|---------|--------|
| `useUserNFTs.ts` line 265 | `getImageUrl(data.img \|\| data.image)` | Use `getMediaUrl(data)` |
| `NFTStaking.tsx` line 581 | `getImageUrl(asset.data?.img)` | Use `getMediaUrl(asset.data)` |
| `NFTVotePicker.tsx` line 188 | `getImageUrl(nft.image)` | Already receives processed URL |

---

## Technical Summary

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/templateCache.ts` | **New** - Shared template cache utility |
| `src/services/atomicApi.ts` | Update `fetchUserNFTsBySchema` to use batch fetch |
| `src/components/farm/NFTStaking.tsx` | Replace sequential template fetches with batch |
| `src/hooks/useUserNFTs.ts` | Add video field detection |

### Expected Performance Improvements

| Scenario | Before | After |
|----------|--------|-------|
| Farm page with 10 unindexed NFTs | ~5-10 seconds | ~1 second |
| DAO voting with 20 NFTs | ~10 seconds | ~1-2 seconds |
| Returning to previously visited farm | Full refetch | Instant (cached) |
| Video-only NFTs in Wallet/Farm | White squares | Proper placeholder |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Cache becomes stale | 15-minute TTL, manual refresh button |
| Memory usage | Limit cache size to 500 templates |
| Breaking existing functionality | Apply changes incrementally, test each component |

---

## Recommended Implementation Order

1. Create `templateCache.ts` utility (foundational)
2. Update `NFTStaking.tsx` (highest impact - farms are heavily used)
3. Update `fetchUserNFTsBySchema` (benefits DAO voting)
4. Add video field support to remaining components
5. Test all NFT viewers end-to-end

