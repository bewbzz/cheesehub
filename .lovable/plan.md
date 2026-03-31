

## Focus SimpleAssets Viewer on GPK Topps Only

Filter the viewer to only show assets authored by `gpk.topps` and remove generic UI elements that no longer apply.

### Changes

**`src/hooks/useSimpleAssets.ts`**
- After fetching all `sassets` rows, filter to only keep assets where `author === 'gpk.topps'`
- This happens at the data level so no unnecessary assets are processed

**`src/pages/SimpleAssets.tsx`**
- Update page title to "GPK Topps Collection" (or similar)
- Update description text to reference GPK Topps cards
- Remove the Author filter dropdown (no longer needed since all cards are gpk.topps)
- Keep the Category filter (useful for distinguishing series) and search bar
- Keep GPK Packs section at top

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**
- No structural changes needed — author field will always show gpk.topps but can remain visible for reference

### Files modified: 2
- `src/hooks/useSimpleAssets.ts`
- `src/pages/SimpleAssets.tsx`

