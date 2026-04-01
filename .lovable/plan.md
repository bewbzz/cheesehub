

## Pack Inventory Browser for Multiple Packs

### Current behavior
When a user has multiple of the same pack (e.g., 5x GPKTWOA), the `GpkPackCard` shows the count and a single "Open Pack" button that opens one immediately.

### New behavior
- When `pack.amount > 1`, the button text changes to **"Open Packs"**
- Clicking it opens a **dialog/drawer** showing individual pack instances laid out in a grid (same visual style as the card grid)
- Each instance shows the pack image and an "Open" button
- **Pagination**: show 10 packs per page with simple prev/next controls (not infinite scroll — keeps it simple and avoids rendering hundreds of DOM nodes for heavy collectors)
- When `pack.amount === 1`, behavior stays the same — single "Open Pack" button opens directly

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`**
- Add state for a new `packBrowserOpen` dialog
- When `pack.amount > 1`: button says "Open Packs", onClick opens the pack browser dialog
- When `pack.amount === 1`: button says "Open Pack", onClick opens directly (current behavior)
- Render the new `PackBrowserDialog` component

**`src/components/simpleassets/PackBrowserDialog.tsx`** (new)
- Full-screen or large dialog showing pack instances in a grid
- Each pack rendered as a card with the pack image and "Open" button
- Generate `pack.amount` virtual instances (they're fungible tokens, not unique — just visual slots)
- Paginated: 10 per page, prev/next buttons, page indicator
- Clicking "Open" on any instance triggers the same open logic (snapshot + transfer + unbox + reveal)
- After successful open, decrement the displayed count and remove that slot
- Reuses the existing `snapshotAssetIds`, `UNBOX_TYPE_MAP`, `SERIES_2_IMAGES`, and `PackRevealDialog`

### Files modified: 2 (1 new)
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/PackBrowserDialog.tsx` (new)

