

## Redesign CheeseDrip — Elastic Melted Cheese Effect (10s duration)

The current implementation drops small blobs straight down like rain. The video reference shows thick, gooey cheese that **clings to the top edge**, slowly **stretches and elongates** downward with elastic, viscous behavior.

### New approach — `src/components/cheesenull/CheeseDrip.tsx` (full rewrite)

**Structure per drip:**
- Container anchored to `top: 0` with `transform-origin: top center`
- Tall rounded-rectangle "strand" that stretches downward via `scaleY` animation — simulating cheese pulling from the edge
- Bulbous "blob" at the bottom that grows heavier as it stretches
- Strand stays connected to the top (no detachment)

**Animations:**
- `cheese-stretch`: `scaleY(0.05)` → `scaleY(1)` with `transform-origin: top` — slow elastic elongation
- `cheese-bulge`: Bottom blob grows as gravity pulls
- `cheese-sway`: Subtle `translateX` oscillation for wobble
- Some drips stretch fully; others hang partway

**Drip variety:** 10-12 drips, thicker (10-30px), clustered along edges with a few in middle, staggered delays (0-2s), slow durations (4-8s). Thick cheese coating bar along top edge.

**Duration:** Visible for **10 seconds**. Update timeout in both files to `10000`.

### Files
- **Rewrite** `src/components/cheesenull/CheeseDrip.tsx`
- **Edit** `src/pages/CheeseNull.tsx` — update timeout from `4500` to `10000`

