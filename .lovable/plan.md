

## Plan: Add third-party contract disclaimer to User Responsibilities

**What**: Add two new bullet points to the existing "6. User Responsibilities" `<ul>` in `src/pages/Terms.tsx` (after line 51):

1. A bullet stating that CHEESEHub is solely a frontend portal to smart contracts on WAX, and that anyone could build their own frontend at any time.
2. A bullet stating that some contracts — notably WaxDAO and NFTHive — are built, owned, and controlled by other individuals or entities, and that users should contact those owners directly for any issues relating to those contracts.

**File**: `src/pages/Terms.tsx` — insert two `<li>` elements before the closing `</ul>` on line 52.

