

## Simulate Pack Opening Experience

### Approach
Add a **"Demo Open"** button (only visible in dev/preview) to `GpkPackCard` that skips the wallet transaction entirely and jumps straight to the `PackRevealDialog` with **mock card data** — pulling real images from the user's existing collection to make it feel authentic.

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`**
- Add a "Demo Open" button (shown always for testing, can be removed later)
- On click: open `PackRevealDialog` in a new **demo mode** where polling is skipped and mock cards are injected immediately

**`src/components/simpleassets/PackRevealDialog.tsx`**
- Add optional `demoCards` prop: `RevealCard[]`
- When `demoCards` is provided, skip all polling logic — go straight to `'revealing'` phase with those cards
- Everything else (flip animation, stagger, close behavior) stays identical

**`src/pages/SimpleAssets.tsx`**
- Pass the user's existing merged SA+AA assets down to `GpkPackCard` so demo mode can pick random cards from the real collection as placeholders

### How it works
1. User clicks **"Demo Open"** on any pack card
2. The dialog opens showing the pack shaking ("Opening pack...")
3. After a brief 2-second fake delay, it transitions to the reveal phase
4. Cards flip one-by-one using real images from the user's collection
5. "Awesome! Close" button appears — no transaction, no balance change

### Files modified: 3
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/components/simpleassets/PackRevealDialog.tsx`
- `src/pages/SimpleAssets.tsx`

