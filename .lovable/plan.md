
# Why testtestfarm Still Shows as Expired

## Root Cause

The code logic is now correct — `isUnderConstruction` is properly defined and the Kick Users button condition is right. The problem is **the React Query cache is not being reliably cleared and the RPC node itself is returning cached/stale data**.

Here is the exact sequence of failures:

1. `handleFarmUpdated` calls `queryClient.removeQueries(...)` — this removes the cache entry.
2. Then it calls `await refetch()` — but `refetch()` is a reference to the query's refetch function captured before the remove. After `removeQueries`, the query has been unmounted from the cache. In some versions of React Query, calling `refetch()` on a removed query re-creates it but may not guarantee a fresh network request if the component is simultaneously re-rendering and re-mounting the same query.
3. Even if the network request goes out, **the WAX RPC node (eosphere.io, pink.gg, etc.) has its own server-side caching** — they can return the same old `expiration` value for 10–30+ seconds after a transaction.
4. The `staleTime: 30000` on the query (line 107) means that if React Query sees fresh-ish data (from the RPC node's cache), it will happily accept it and not go to the network again.

The delayed refetches at 2s and 5s also call `removeQueries` then `refetch()` — same issue.

Additionally, the manual **Refresh button** (`handleRefresh` at line 130) only calls `refetch()` without first calling `removeQueries`, so it also serves stale data.

## The Fix

Two changes to `src/components/farm/FarmDetail.tsx`:

### Fix 1 — Set `staleTime: 0` on the farmDetail query

Change the query from `staleTime: 30000` to `staleTime: 0`. This ensures that every time a refetch is requested, it **always goes to the network** rather than potentially returning data from React Query's own cache.

```tsx
// Before
staleTime: 30000,

// After
staleTime: 0,
```

### Fix 2 — Replace `refetch()` calls with `queryClient.fetchQuery` in `handleFarmUpdated`

Instead of calling `refetch()` (which is a reference to the old query that may be stale after `removeQueries`), use `queryClient.fetchQuery` which is guaranteed to trigger a fresh network request and update the cache. This is the correct React Query pattern for imperatively fetching fresh data.

```tsx
const handleFarmUpdated = async () => {
  // Remove stale cache entirely
  queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
  queryClient.invalidateQueries({ queryKey: ["myV2farms"] });

  // Immediately trigger a fresh fetch (guaranteed network request)
  await queryClient.fetchQuery({
    queryKey: ["farmDetail", farmName],
    queryFn: () => fetchFarmDetails(farmName!),
    staleTime: 0,
  });

  // Delayed refetches to handle RPC node propagation lag (nodes can cache for 10-30s)
  setTimeout(async () => {
    queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
    await queryClient.fetchQuery({
      queryKey: ["farmDetail", farmName],
      queryFn: () => fetchFarmDetails(farmName!),
      staleTime: 0,
    });
  }, 3000);

  setTimeout(async () => {
    queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
    await queryClient.fetchQuery({
      queryKey: ["farmDetail", farmName],
      queryFn: () => fetchFarmDetails(farmName!),
      staleTime: 0,
    });
  }, 7000);
};
```

Also fix the **Refresh button** handler to clear the cache before refreshing:

```tsx
const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    queryClient.removeQueries({ queryKey: ["farmDetail", farmName] });
    await queryClient.fetchQuery({
      queryKey: ["farmDetail", farmName],
      queryFn: () => fetchFarmDetails(farmName!),
      staleTime: 0,
    });
    toast({ title: "Farm data refreshed!" });
  } finally {
    setIsRefreshing(false);
  }
};
```

## Why This Works

- `queryClient.fetchQuery` is explicitly designed to fetch fresh data imperatively and update the cache — it does not have the stale-reference problem that `refetch()` can have after `removeQueries`.
- `staleTime: 0` on the query declaration means React Query never considers existing data "fresh enough to skip the network", so every request goes to the RPC node.
- The 3s and 7s delayed refetches (slightly longer than before) give WAX RPC nodes enough time to propagate the transaction and return the updated `expiration: 1` value.

## Files to Change

| File | Change |
|---|---|
| `src/components/farm/FarmDetail.tsx` | Set `staleTime: 0` on farmDetail query; replace `refetch()` calls with `queryClient.fetchQuery` in `handleFarmUpdated`; fix `handleRefresh` to also clear cache first |
