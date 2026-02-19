
# Fix CloseFarmDialog: Wrong Toast + Stale UI After Closing

## Two Bugs to Fix

### Bug 1 — Wrong Toast Message
In `src/components/farm/CloseFarmDialog.tsx`, the success toast incorrectly says:
```
"Farm Permanently Closed!"
```
It should say:
```
"Farm Closed!"
```
This is a simple one-line text change.

### Bug 2 — Kick Users Button Not Appearing After Close
After closing the farm, the UI still shows "Close" and "Permanently Closed" buttons instead of "Kick Users". This is caused by stale React Query cache.

**Root cause:** The `handleFarmUpdated` callback in `FarmDetail.tsx` invalidates `["farmDetail", farmName]` and calls `refetch()`, but the WAX RPC node has its own caching delay. By the time the refetch runs, the node may still return the old `status` value. Additionally, the `staleTime: 30000` on the query means React Query may serve the old cached data even after `refetch()` is called in some cases.

**The fix:** In `FarmDetail.tsx`, the `handleFarmUpdated` function needs to:
1. Force the query out of stale state by setting `staleTime` to `0` for the invalidation, or more practically, call `queryClient.removeQueries` to fully clear the cache entry before refetching — ensuring fresh data is always fetched from the network.
2. Also invalidate the `["myV2farms"]` list cache so other views stay in sync.

## Files to Change

### 1. `src/components/farm/CloseFarmDialog.tsx`
Change line in the success toast:
```tsx
// Before
title: "Farm Permanently Closed!",
description: `${farm.farm_name} has been permanently removed.`

// After  
title: "Farm Closed!",
description: `${farm.farm_name} has been closed.`
```

### 2. `src/components/farm/FarmDetail.tsx`
Update `handleFarmUpdated` to remove (not just invalidate) the cached query entry before refetching, ensuring the UI always gets fresh on-chain data:

```tsx
const handleFarmUpdated = async () => {
  // Remove stale cache entirely so refetch always goes to network
  queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
  queryClient.invalidateQueries({ queryKey: ["myV2farms"] });

  // Immediate refetch
  await refetch();

  // Delayed refetches to handle RPC node propagation lag
  setTimeout(() => {
    queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
    refetch();
  }, 2000);

  setTimeout(() => {
    queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
    refetch();
  }, 5000);
};
```

## Why `removeQueries` Instead of `invalidateQueries`
- `invalidateQueries` marks the data as stale but React Query may still return the cached value while fetching in the background, causing the old buttons to flash briefly or persist.
- `removeQueries` fully clears the cache entry, so the next `refetch()` is guaranteed to fetch from the network and the UI shows fresh data.

## Summary

| File | Change |
|---|---|
| `src/components/farm/CloseFarmDialog.tsx` | Fix toast title/description to say "Farm Closed!" not "Permanently Closed!" |
| `src/components/farm/FarmDetail.tsx` | Replace `invalidateQueries` with `removeQueries` in `handleFarmUpdated` and also invalidate `myV2farms` list |
