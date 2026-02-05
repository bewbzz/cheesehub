
# Fix CHEESEDrops - Nothing Loads / White Squares

## Problem Analysis

I've identified the **root causes** from the network requests and code:

### Why Nothing Loads Now

| Issue | Impact | Evidence |
|-------|--------|----------|
| **Batch queries grouped by collection** | 30 collections = 30 API calls (not 1-2 as expected) | Each collection makes separate request |
| **`collection_name` filter causes empty results** | Templates exist but not returned | `downunderpic&ids=901656` returns `data:[]` |
| **Indexer inconsistency** | blacklusion returns 404, eosamsterdam returns 200 | Network logs show both |
| **Abort signals cancel fallbacks** | Individual fallback requests get aborted before completing | `signal is aborted without reason` |

### The Fix: Use NFTHive's Proven Approach

NFTHive uses **just `?ids=xxx,yyy,zzz`** without the `collection_name` filter. This:
- Fetches ALL templates in 1 request (up to 100)
- Works across multiple collections
- Doesn't fail when one collection's indexer is behind

---

## Solution: 4-Part Fix

### 1. Remove `collection_name` from Batch Query

The batch query should use **just the `ids` parameter** like NFTHive does:

```text
Before: /templates?collection_name=foo&ids=1,2,3 (per collection = many calls)
After:  /templates?ids=1,2,3,4,5,6,7,8,9,10 (all at once = 1 call)
```

```typescript
// Fetch ALL templates at once, no collection grouping
const allIds = Array.from(uniqueRequests.values()).map(r => r.templateId);
const chunks = chunkArray(allIds, 100);

for (const chunk of chunks) {
  const params = new URLSearchParams({
    ids: chunk.join(','),
    limit: '100',
  });
  const path = `${ATOMIC_API.paths.templates}?${params}`;
  const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
  // ... parse results using template.collection.collection_name from response
}
```

### 2. Don't Abort Enrichment on Re-render

Currently, changing pages aborts in-flight enrichment. The fallback individual fetches get cancelled mid-request.

Fix: Only abort when the drops themselves change, not on every effect run:

```typescript
// In useEnrichDrops - don't abort enrichment in progress unless drops actually changed
useEffect(() => {
  // Only abort if we're starting enrichment for a DIFFERENT set of drops
  if (keyChanged && abortRef.current) {
    abortRef.current.abort();
  }
  // ... rest of enrichment
}, [dropsKey]); // Remove dropsNeedingEnrichment.length dependency
```

### 3. Process Fallback Templates in Parallel (All at Once)

Current code processes fallbacks in batches of 5 sequentially. This is too slow for 20+ missing templates:

```typescript
// Before: Sequential batches of 5 (20 missing = 4 rounds)
for (let i = 0; i < missingTemplates.length; i += 5) {
  await Promise.allSettled(batch.map(...));  // Waits before next batch
}

// After: All fallbacks in parallel (20 missing = 1 round)
await Promise.allSettled(
  missingTemplates.map(async ({ templateId, collectionName }) => {
    const data = await fetchTemplateById(templateId, collectionName);
    if (data?.image) results.set(key, data);
  })
);
```

### 4. Better Indexer Fallback Order

The eosamsterdam indexer has better coverage than blacklusion for newly indexed templates. Reorder:

```typescript
baseUrls: [
  'https://wax-aa.eu.eosamsterdam.net',  // Better coverage for new templates
  'https://wax.api.atomicassets.io',
  'https://aa.wax.blacklusion.io',
  'https://atomic.wax.eosrio.io',
],
```

---

## File Changes

| File | Change |
|------|--------|
| `src/services/atomicApi.ts` | Fix batch query to use just `ids` without `collection_name`; parallelize all fallbacks |
| `src/hooks/useEnrichDrops.ts` | Fix abort logic to only abort on drops change |
| `src/lib/waxConfig.ts` | Reorder indexers (eosamsterdam first) |

---

## Expected Results

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| API calls for 50 drops | 30+ (one per collection) | 1-2 (100 per batch) |
| Missing template fallbacks | Sequential batches of 5 | All in parallel |
| Aborted requests | Many (on re-render) | Only when drops change |
| White squares | Many | Near zero |

---

## Technical Details

### Updated `fetchTemplatesBatch` Function

```typescript
export async function fetchTemplatesBatch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, { name: string; image: string }>> {
  // Deduplicate by templateId only (not by collection)
  const uniqueTemplateIds = new Map<string, { templateId: string; collectionName: string }>();
  for (const req of requests) {
    if (!uniqueTemplateIds.has(req.templateId)) {
      uniqueTemplateIds.set(req.templateId, req);
    }
  }

  const results = new Map<string, { name: string; image: string }>();
  const allIds = Array.from(uniqueTemplateIds.keys());
  
  console.log(`[NFTHive Batch] Fetching ${allIds.length} unique templates`);

  // Fetch ALL templates at once (chunks of 100 for API limit)
  const chunks = chunkArray(allIds, 100);
  
  for (const chunk of chunks) {
    try {
      const params = new URLSearchParams({
        ids: chunk.join(','),
        limit: '100',
      });
      const path = `${ATOMIC_API.paths.templates}?${params}`;
      const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
      const json = await response.json();

      if (json.success && json.data) {
        for (const template of json.data) {
          const data = template.immutable_data || {};
          const collectionName = template.collection?.collection_name || '';
          const key = `${collectionName}:${template.template_id}`;
          results.set(key, {
            name: data.name || template.name || `Template #${template.template_id}`,
            image: getImageUrl(data.img || data.image),
          });
        }
      }
    } catch (error) {
      console.warn(`[NFTHive Batch] Batch fetch failed:`, error);
    }
  }

  // Find missing templates and fetch ALL in parallel
  const missingTemplates = Array.from(uniqueTemplateIds.values()).filter(req => {
    const key = `${req.collectionName}:${req.templateId}`;
    return !results.has(key);
  });

  if (missingTemplates.length > 0) {
    console.log(`[NFTHive Batch] Fetching ${missingTemplates.length} missing templates in parallel`);
    
    await Promise.allSettled(
      missingTemplates.map(async ({ templateId, collectionName }) => {
        try {
          const data = await fetchTemplateById(templateId, collectionName);
          if (data && data.image && !data.image.includes('placeholder')) {
            const key = `${collectionName}:${templateId}`;
            results.set(key, { name: data.name, image: data.image });
          }
        } catch (e) {
          // Ignore individual fetch errors
        }
      })
    );
  }

  console.log(`[NFTHive Batch] Successfully fetched ${results.size} templates`);
  return results;
}
```

---

## Summary

The "nothing loads" issue stems from a flawed batch query approach:
1. Grouping by collection creates 30+ API calls instead of 1-2
2. The `collection_name` filter causes empty results for some templates  
3. Abort signals cancel fallback requests before they complete

The fix removes the collection grouping, uses just `ids` parameter (like NFTHive does), and processes all fallbacks in parallel without premature abortion.
