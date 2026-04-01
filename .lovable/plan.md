

## Pack Opening Card Reveal Animation

### Current behavior
On successful pack open: a toast says "Pack Opened!", then after 2 seconds `onSuccess` fires which refetches pack balances and card lists. No visual reveal.

### Challenge
WAX RNG pack opening is **asynchronous** — the contract requests a random number from the WAX RNG oracle, and cards are minted in a separate callback (`receiverand → getcards`). This means cards don't appear instantly after the transaction succeeds. There's typically a 2-10 second delay.

### Plan

**New component: `src/components/simpleassets/PackRevealDialog.tsx`**
- A full-screen overlay dialog triggered after a successful pack-open transaction
- Shows the pack image with a shake/glow animation while "Waiting for cards..."
- Polls the user's AtomicAssets (gpk.topps collection, sorted by mint descending) every 2 seconds, comparing against a snapshot taken before opening
- Once new cards are detected, transitions to a card reveal sequence:
  - Cards appear face-down in a row, then flip over one-by-one with a staggered delay (CSS 3D flip transform)
  - Each card shows its image, name, and rarity/quality
- If no new cards appear after ~30 seconds, shows a fallback message: "Cards are still being minted. Check back in a moment." with a close button
- Close button dismisses the dialog and triggers the existing `onSuccess` refetch

**Modified: `src/components/simpleassets/GpkPackCard.tsx`**
- Before sending the transaction, snapshot the user's current AtomicAssets asset IDs (or just pass the count)
- On success, instead of just showing a toast, open the `PackRevealDialog` with the pack info and pre-open asset snapshot
- Pass `session`/`accountName` so the dialog can poll for new cards

**Modified: `src/pages/SimpleAssets.tsx`**
- Pass `accountName` down to `GpkPackCard` (already has `session`)

### Animation details (all CSS, no library needed)
- **Pack shake**: `@keyframes pack-shake` — small rotation oscillation for 1-2s
- **Pack burst**: scale up + fade out when cards are detected
- **Card flip**: CSS `perspective` + `rotateY(180deg)` transition, cards start face-down (showing a card-back pattern), flip to reveal the actual card image
- **Stagger**: each card flips 300ms after the previous one

### Technical details
- Polling uses the existing AtomicAssets API: `GET /atomicassets/v1/assets?owner={user}&collection_name=gpk.topps&order=desc&sort=asset_id&limit=N`
- Compare asset IDs before/after to identify newly minted cards
- Expected new card counts: GPKFIVE=5, GPKTWOA=8, GPKTWOB=25, GPKTWOC=55

### Files modified: 3 (1 new)
- `src/components/simpleassets/PackRevealDialog.tsx` (new)
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/pages/SimpleAssets.tsx`

