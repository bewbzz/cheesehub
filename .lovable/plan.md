

## Add Crash Gordon & Tiger King Pack Opening Support

### Background
Crash Gordon and Tiger King (exotic) cards are **already displayed** in the viewer since they're AtomicAssets under `gpk.topps`. But pack opening for these collections uses a completely different mechanism than GPK Series 1/2:

- **Series 1/2**: Token-based packs via `packs.topps` → unbox via `gpk.topps` → cards in `pendingnft.a` → claim via `getcards`
- **Crash Gordon**: AtomicAssets NFT packs (template 13778) → transfer to `gpkcrashpack` with memo `unbox` → oracle → `logresult` with template_ids → claim via `claimunboxed`
- **Tiger King + Bernventures + Mittens**: AtomicAssets NFT packs → transfer to `burnieunpack` with memo `unbox` → same flow → `claimunboxed`

### Key differences from existing pack flow
1. Packs are **AtomicAssets NFTs** (not fungible tokens) — each has a unique `asset_id`
2. The unpack contract is different per series (`gpkcrashpack` vs `burnieunpack`)
3. Results come as `template_ids` in a `logresult` action (not `pendingnft.a` table rows)
4. Claim action is `claimunboxed` with `pack_asset_id` + `origin_roll_ids` (not `getcards`)
5. Card images come from AtomicAssets template data (IPFS URLs in template immutable_data), not deterministic IPFS patterns

### Plan

**1. New hook: `src/hooks/useGpkAtomicPacks.ts`**
- Fetch user's AtomicAssets in `gpk.topps` collection, schema `packs`
- Return packs grouped by template_id with name, image, description, count, and individual asset_ids
- Map each pack template to its unpack contract:
  - Template 13778 (Crash Gordon) → `gpkcrashpack`
  - Template 48479 (Bernventures) → `burnieunpack`
  - Template 51437 (Mitten) → `burnieunpack`
  - Template 53187 (GameStonk) → `burnieunpack` or `gpkpoolunbox`
  - Templates 59072, 59489-59492 (Food Fight) → `burnieunpack` or `gpkpoolunbox`

**2. New component: `src/components/simpleassets/AtomicPackCard.tsx`**
- Similar layout to `GpkPackCard` but for AtomicAssets NFT packs
- Shows pack image (from template data), name, count
- "Open Pack" button transfers the pack NFT to the appropriate unpack contract
- Open action: single `atomicassets::transfer` action with `asset_ids: [packAssetId]`, `to: unpackContract`, `memo: 'unbox'`
- After successful transfer, opens a modified reveal dialog

**3. New component or mode in PackRevealDialog: `AtomicPackRevealDialog`**
- Poll the unpack contract's table for results (need to check `gpkcrashpack` and `burnieunpack` table structure — likely a `results` or `unboxed` table scoped to the pack asset_id or user)
- Alternative: poll `logresult` actions via Hyperion for the `pack_asset_id`
- Simpler approach: poll the unpack contract tables for pending results, then use template_ids to fetch card images from AtomicAssets API
- After reveal animation, show "Collect Assets" button that calls `{contract}::claimunboxed` with `pack_asset_id` and `origin_roll_ids: [0, 1, 2, ..., N-1]` (where N = number of cards)

**4. Update `src/pages/SimpleAssets.tsx`**
- Import and use `useGpkAtomicPacks` alongside existing `useGpkPacks`
- Add a new section "GPK AtomicAssets Packs" showing Crash Gordon, Bernventures, Mitten, GameStonk, Food Fight packs
- Wire refetch callbacks

### Card image resolution for reveals
- After `logresult` provides `template_ids`, fetch each template from AtomicAssets API to get `img` and `backimg` from immutable_data
- Cache template data to avoid repeated fetches
- Use the existing `resolveRawImage` / `getIpfsUrl` utilities for IPFS resolution

### Technical details
- `gpkcrashpack::claimunboxed` signature: `{ origin_roll_ids: number[], pack_asset_id: number }`
- `burnieunpack::claimunboxed` signature: same
- Both contracts use `assoc_id` = pack asset_id for oracle correlation
- Crash Gordon packs contain 5 cards; Bernventures packs contain 2; Mitten packs contain 5; Food Fight packs contain 3

### Files to create/modify
- `src/hooks/useGpkAtomicPacks.ts` (new)
- `src/components/simpleassets/AtomicPackCard.tsx` (new)
- `src/components/simpleassets/AtomicPackRevealDialog.tsx` (new — separate from existing PackRevealDialog to avoid overcomplicating the gpk.topps-specific logic)
- `src/pages/SimpleAssets.tsx` (add atomic packs section)

