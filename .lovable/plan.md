

## Add GPK Topps Pack Tokens to SimpleAssets Viewer

### Important caveat — "Open Pack" action
The `open` action on `packs.topps` is the standard eosio.token `open` (creates a zero-balance row). Pack opening historically worked by **transferring** the pack token to an unboxing contract. Before implementing an open/unbox button, we'd need to confirm:
1. Which contract receives the transfer (likely `unbox.topps` or `packs.topps` itself)
2. Whether that contract still processes opens (Topps GPK on WAX may be defunct)

**Recommendation**: Add the pack token display now. Add an "Open Pack" button as a follow-up once we confirm the unbox mechanism is still live.

### Changes

**1. New hook: `src/hooks/useGpkPacks.ts`**
- Query `packs.topps` contract, `accounts` table, scoped by user account
- Returns balances for GPKFIVE, GPKMEGA, GPKTWOA, GPKTWOB, GPKTWOC
- Each result includes symbol, amount, precision
- Uses existing `fetchTableRows` from waxRpcFallback

**2. Modify `src/pages/SimpleAssets.tsx`**
- Import and call `useGpkPacks(accountName)`
- Add a "GPK Topps Packs" section above or below the SimpleAssets NFT grid
- Show pack token cards in a smaller grid row with:
  - GPK logo/icon (or a pack emoji 📦)
  - Token symbol (e.g., GPKFIVE)
  - Balance amount
  - Greyed-out "Open Pack" button with tooltip "Coming soon — verifying unbox contract status"
- Only show the section if user has any GPK pack balance > 0

**3. New component: `src/components/simpleassets/GpkPackCard.tsx`**
- Card showing pack symbol, balance, and a descriptive label (e.g., "GPK Series 2A Pack")
- Disabled "Open Pack" button placeholder for future implementation

### GPK Pack Labels
| Symbol | Label |
|--------|-------|
| GPKFIVE | GPK Series 5 Pack |
| GPKMEGA | GPK Mega Pack |
| GPKTWOA | GPK Series 2A Pack |
| GPKTWOB | GPK Series 2B Pack |
| GPKTWOC | GPK Series 2C Pack |

### Files
- **New**: `src/hooks/useGpkPacks.ts`, `src/components/simpleassets/GpkPackCard.tsx`
- **Modified**: `src/pages/SimpleAssets.tsx`

### Technical detail
The `packs.topps` `accounts` table uses the standard eosio.token structure. Each row has `{ balance: "5 GPKFIVE" }`. We query with scope = user account and parse the asset string to extract amount and symbol.

