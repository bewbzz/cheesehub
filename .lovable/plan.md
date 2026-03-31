

## Show Both SimpleAssets and AtomicAssets GPK Cards Together

GPK cards that have been bridged to AtomicAssets live in the `atomicassets` contract under the `gpk.topps` collection. We'll fetch those alongside the existing SimpleAssets cards and add a source filter.

### New Hook

**`src/hooks/useGpkAtomicAssets.ts`**
- Fetch the user's AtomicAssets owned under `collection_name = gpk.topps` using the existing AtomicAssets API (`/atomicassets/v1/assets?owner=X&collection_name=gpk.topps`)
- Map each asset to a `SimpleAsset`-compatible shape so both sources can share the same card components and grid
- Extract `cardid` and `quality` from `immutable_data` / `data` for consistent sorting
- Resolve front/back images using the same `resolveAllImages` pattern
- Add a `source: 'simpleassets' | 'atomicassets'` field to distinguish them

### Changes

**`src/hooks/useSimpleAssets.ts`**
- Add `source: 'simpleassets' | 'atomicassets'` to the `SimpleAsset` interface
- Set `source: 'simpleassets'` on all parsed assets

**`src/pages/SimpleAssets.tsx`**
- Import and call `useGpkAtomicAssets(accountName)`
- Merge both arrays into a combined list, applying the same cardid+quality sort
- Add a new "Source" dropdown with three options:
  - **All** (default) — shows both SimpleAssets and AtomicAssets together
  - **Simple Assets** — only SimpleAssets
  - **Atomic Assets** — only bridged AtomicAssets
- Show source badge on each card (small "SA" or "AA" indicator) so the user can tell which standard each card is on
- Existing search, category filter, and drag-to-reorder all work on the combined/filtered list

**`src/components/simpleassets/SimpleAssetCard.tsx`**
- Add a small source indicator badge (e.g., corner label showing "SA" or "AA")

### Files modified: 4
- `src/hooks/useSimpleAssets.ts` (add `source` field)
- `src/hooks/useGpkAtomicAssets.ts` (new)
- `src/pages/SimpleAssets.tsx` (merge sources, add filter)
- `src/components/simpleassets/SimpleAssetCard.tsx` (source badge)

