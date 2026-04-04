

## Revised Plan: Poll `pendingnft.a` + Construct Card Images + Collect Assets

### Discovery
GPK card images follow a **deterministic IPFS URL pattern**. No image storage needed.

```text
Series 1 (boxtype "five"):
  QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/{variant}/{cardid}{quality}.{ext}

Series 2 (boxtype "gpktwoeight", "gpktwo25", "gpktwo55"):
  QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/{variant}/{cardid}{quality}.{ext}

Back images:
  {same hash}/back/{cardid}.jpg

Extension: .jpg for base/collector/golden, .gif for prism/sketch/slime/raw
```

The `pendingnft.a` table rows contain `boxtype`, `variant`, `cardid`, and `quality` - everything needed to construct the exact image URL. No API calls, no template lookups, no image storage.

### New Flow

```text
Pack opened (tx success)
  → Poll gpk.topps pendingnft.a table (scoped to user)
  → Find new rows with done=0 for the latest unboxingid
  → Construct card images from IPFS pattern
  → Reveal animation with real card images
  → "Collect Assets" button appears
  → User clicks → getcards transaction fires
  → Success → refresh collection
```

### Changes

**1. `src/lib/gpkCardImages.ts` (new file)**
- Export `buildGpkCardImageUrl(boxtype, variant, cardid, quality)` that returns the IPFS URL
- Map boxtypes to series IPFS hashes
- Map variants to file extensions (.jpg vs .gif)
- Export `buildGpkCardBackUrl(boxtype, cardid)` for back images

**2. `src/components/simpleassets/PackRevealDialog.tsx`**
- Add new props: `session` (Session | null)
- Change polling target for real opens: poll `gpk.topps` table `pendingnft.a` scoped to `accountName` instead of wallet assets
- `preOpenAssetIds` becomes `preOpenUnboxingIds` (Set of known unboxingids before opening)
- Filter rows where `done === 0` and unboxingid not in pre-open set
- Convert pending rows to `RevealCard` objects using `buildGpkCardImageUrl`
- Remove hard timeout - let polling continue indefinitely with status messages at 30s and 60s
- After all cards revealed, show **"Collect Assets"** button instead of "Awesome! Close"
- On click: fire `gpk.topps::getcards` with `{ from: accountName, unboxing: unboxingId, card_ids: [rowId1, rowId2, ...] }`
- On success: toast, call `onComplete()`, show "Close" button
- On failure: show error, keep button available to retry
- Demo mode unchanged (skips collect phase entirely)

**3. `src/components/simpleassets/GpkPackCard.tsx`**
- Pass `session` to `PackRevealDialog`
- Change `snapshotAssetIds` to `snapshotUnboxingIds`: query `pendingnft.a` scoped to user, collect unique unboxingid values
- Pass pre-open unboxingid set instead of asset id set

**4. `src/components/simpleassets/PackBrowserDialog.tsx`**
- Same changes as GpkPackCard: pass `session`, change snapshot to capture unboxingids
- Update `snapshotAssetIds` prop type/usage accordingly

### Technical details
- `pendingnft.a` query: `code: 'gpk.topps'`, `scope: accountName`, `table: 'pendingnft.a'`
- Row fields: `id` (row id for getcards), `unboxingid`, `cardid`, `quality`, `variant`, `boxtype`, `done`, `user`
- `getcards` action: `{ from: string, unboxing: number, card_ids: number[] }` where card_ids = array of row `id` values
- Card name can be derived from the user's `collectionAssets` by matching cardid+quality, or shown as "Card #{cardid}{quality}" fallback

### Files: 4
- `src/lib/gpkCardImages.ts` (new)
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/PackBrowserDialog.tsx`

