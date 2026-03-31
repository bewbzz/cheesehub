

## Add Drag-and-Drop Card Reordering (Swap)

### Approach
Use the native HTML5 Drag and Drop API (no new dependencies) to allow users to drag a card onto another, swapping their positions in the grid.

### Changes

**1. `src/pages/SimpleAssets.tsx`**
- Add a `customOrder` state (`string[]` of asset IDs) initialized from `filtered` results
- When `customOrder` is set, use it to reorder `filtered` for display
- Pass `onDragStart`, `onDragOver`, `onDrop` handlers to each `SimpleAssetCard`
- On drop: swap the dragged card's position with the drop target's position in `customOrder`
- Reset `customOrder` when filters/search change

**2. `src/components/simpleassets/SimpleAssetCard.tsx`**
- Accept optional drag props: `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`
- Add `draggable` attribute to the Card
- Add visual feedback: highlight border/opacity change when dragging or when a card is a valid drop target
- Prevent the drag from triggering the `onClick` (detail dialog)

### Technical detail
- Store drag source ID in a ref (no re-renders during drag)
- On drop, find both indices in the order array and swap them
- `customOrder` persists only for the session — reloading or changing filters resets it
- No new dependencies needed

