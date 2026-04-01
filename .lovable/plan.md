

## Fix Pack Reveal Polling to Include SimpleAssets

### Problem
The `PackRevealDialog` and `GpkPackCard.snapshotAssetIds` only poll the **AtomicAssets API** (`collection_name=gpk.topps`). However, GPK cards — particularly Series 1 — are minted on the **SimpleAssets contract** (`simpleassets::sassets` table, author `gpk.topps`). The current polling would miss newly minted cards entirely for Series 1 packs, and possibly Series 2 as well.

### Fix

**`src/components/simpleassets/GpkPackCard.tsx`**
- Change `snapshotAssetIds` to snapshot **both** sources:
  - AtomicAssets API (current approach, for `gpk.topps` collection)
  - SimpleAssets on-chain table (`simpleassets::sassets`, filtered by `author === 'gpk.topps'`)
- Combine both sets of IDs into the pre-open snapshot

**`src/components/simpleassets/PackRevealDialog.tsx`**
- Change `fetchGpkAssets` to poll **both** sources in parallel:
  - AtomicAssets API (existing)
  - SimpleAssets table rows via RPC (`fetchTableRows` from `@/lib/waxRpcFallback`)
- Merge results, deduplicate by ID, then compare against the pre-open snapshot
- Normalize the SimpleAssets data format (parse `idata`/`mdata` JSON strings) to extract card name, image, rarity — same as `useSimpleAssets` already does

### No other changes needed
The rest of the reveal animation logic (flip cards, stagger, timeout) stays the same. The `onComplete` callback already triggers `refetchSa()` + `refetchAa()` + `refetchPacks()`.

### Files modified: 2
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/PackRevealDialog.tsx`

