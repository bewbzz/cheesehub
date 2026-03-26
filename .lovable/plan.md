

## Surface Additional Asset Metadata

### What's available
SimpleAssets' `sassets` table has no native mint-number or max-supply field. However:
- Many authors embed fields like `mint`, `edition`, `serial`, `supply`, `maxsupply`, `backimg`, `video` etc. inside `idata`/`mdata` JSON
- `container` and `containerf` arrays hold attached NFTs/FTs (nested assets)

### Changes

**1. `src/components/simpleassets/SimpleAssetCard.tsx`**
- After category/ID row, show a mint badge if any of these keys exist in combined idata+mdata: `mint`, `serial`, `edition`, `num`, `mint_num`
- If a field like `edition` contains "34/356" format, display as-is
- If separate `mint` and `maxsupply`/`supply` fields exist, show "Mint #34 / 356"
- Show a small "📎" indicator if `container` or `containerf` is non-empty

**2. `src/hooks/useSimpleAssets.ts`**
- Add `container` and `containerf` to the `SimpleAsset` interface (as arrays)
- Pass them through from the raw row data

**3. `src/components/simpleassets/SimpleAssetDetailDialog.tsx`**
- Add a "Mint Info" row at the top of metadata if mint/edition fields are detected
- Add a "Contained Assets" section if container/containerf arrays are non-empty, showing count and IDs

### Files
- **Modified**: `src/hooks/useSimpleAssets.ts` — expand interface, pass container fields
- **Modified**: `src/components/simpleassets/SimpleAssetCard.tsx` — show mint badge
- **Modified**: `src/components/simpleassets/SimpleAssetDetailDialog.tsx` — show mint info and contained assets

