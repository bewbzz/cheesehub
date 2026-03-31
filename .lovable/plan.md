

## Persist Card Binder Layout (Cloud Storage)

The project currently has no backend. We'll set up Lovable Cloud (Supabase) to store each user's card arrangement tied to their WAX account name.

### Database

**New table: `card_layouts`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | auto-generated |
| wax_account | text (unique) | the user's WAX wallet name |
| layout | jsonb | ordered array of asset IDs with empty slots |
| updated_at | timestamptz | auto-updated |

RLS policy: anyone can read/write rows matching their `wax_account` (no auth — keyed by WAX account name, same trust model as the rest of the app).

### New files

**`src/lib/cardLayoutApi.ts`**
- `fetchLayout(supabase, waxAccount)` — SELECT from `card_layouts` WHERE `wax_account`
- `saveLayout(supabase, waxAccount, layout)` — UPSERT the layout JSON

**`src/hooks/useCardLayout.ts`**
- Takes `waxAccount` and `filteredAssetIds`
- On mount: fetches saved layout from Supabase
- Merges saved order with current assets (handles new/removed NFTs gracefully)
- Exposes `layout`, `swapCards(srcIdx, targetIdx)`, `isLoading`
- Auto-saves to Supabase on change (debounced ~1s)

### Modified files

**`src/pages/SimpleAssets.tsx`**
- Replace local `customOrder` state with `useCardLayout` hook
- Pass layout from the hook into the grid rendering
- Swap handler calls `useCardLayout.swapCards` instead of local state mutation
- Layout persists across sessions and devices for the same WAX account

### Behavior
- First visit: cards appear in ID order (default)
- User drags to rearrange: saves automatically after 1 second of inactivity
- Return visit: layout loads from cloud, merged with any new/removed assets
- Filter/search active: temporarily overrides binder view (no saves while filtering)
- Clear filters: binder layout returns

### Setup required
- Enable Lovable Cloud (Supabase integration)
- Create the `card_layouts` table via migration
- Add Supabase client to the project

