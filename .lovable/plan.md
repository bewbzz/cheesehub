

# Null Breakdown Popup on Homepage

Add a clickable popup to the "CHEESE Nulled" stat in the TokenStatsBanner that shows how much each contract (cheeseburner, cheesefeefee, cheesepowerz) has sent to eosio.null, along with each one's percentage of the total.

## How It Works

When the user clicks the "CHEESE Nulled" stat on the homepage, a small Popover appears showing a 3-row table:

| Contract | Nulled | % |
|----------|--------|---|
| cheeseburner | 1,234,567 CHEESE | 85.2% |
| cheesefeefee | 150,000 CHEESE | 10.3% |
| cheesepowerz | 65,000 CHEESE | 4.5% |

## Data Fetching

Each of these three contracts sends CHEESE to `eosio.null` via the `cheeseburger` token contract. To get per-contract totals, we query Hyperion's `get_actions` endpoint for transfer actions from each contract to `eosio.null`.

## Technical Details

### 1. New utility: `src/lib/cheeseNullBreakdown.ts`
- Export an async function `fetchNullBreakdown()` that queries Hyperion for `cheeseburger::transfer` actions where `to=eosio.null` for each of the 3 sender accounts: `cheeseburner`, `cheesefeefee`, `cheesepowerz`
- Paginates through all actions (same pattern as `fetchLogburnActions` in `fetchLeaderboard.ts`)
- Sums the transferred amounts per contract
- Returns an array of `{ contract: string, amount: number, percent: number }`

### 2. New hook: `src/hooks/useNullBreakdown.ts`
- Wraps the fetch function in a `useQuery` with a long `staleTime` (5 min) since this data changes slowly
- Returns the breakdown data, loading, and error states

### 3. Modify `src/components/home/TokenStatsBanner.tsx`
- Import Radix `Popover` component
- Wrap the "CHEESE Nulled" stat in a `PopoverTrigger` with a cursor-pointer style
- The `PopoverContent` shows a compact table with 3 rows (one per contract), each showing contract name, formatted amount, and percentage of total
- Table uses the existing `Table` UI component for consistency
- Add a subtle hover indicator (e.g., underline or opacity change) so users know the stat is clickable

