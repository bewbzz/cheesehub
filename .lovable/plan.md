

# Import CHEESENull into CHEESEHub

## Overview
CHEESENull is a token burning dApp powered by the `cheeseburner` smart contract. Users click a "NULL" button to claim vote rewards, swap 80% to CHEESE (burning 63%, rewarding 10% to caller, sending 7% to xCHEESE), and compound-staking the remaining 20% WAX. It has a 24-hour cooldown between burns.

## What Gets Added

### New Files (6 files)

1. **`src/lib/cheeseNullApi.ts`** -- All WAX blockchain API utilities from the original `waxApi.ts`, adapted to use CHEESEHub's existing `fetchWithFallback` for RPC endpoint rotation. Includes functions for fetching voter info, global state, Alcor pool prices, contract stats, and all formatting/calculation helpers.

2. **`src/hooks/useCheeseNullData.ts`** -- Real-time data hook (from `useWaxData.ts`) that calculates estimated burn amounts, reward breakdowns, cooldown timers, and claimability status. Uses react-query with 30s refresh intervals.

3. **`src/hooks/useCheeseNullStats.ts`** -- Lifetime statistics hook (from `useContractStats.ts`) that fetches total burns, total CHEESE nulled, total rewards distributed, etc.

4. **`src/components/cheesenull/NullButton.tsx`** -- The big "NULL" button component adapted from `BurnButton.tsx`. Uses `useWax()` context instead of the standalone WalletContext. Sends the `cheeseburner::burn` action via the unified session with Greymass Fuel sponsorship.

5. **`src/components/cheesenull/NullStats.tsx`** -- Current estimated burn display with distribution breakdown (Your Reward, xCHEESE, Compound) and cooldown timer. Adapted from `BurnStats.tsx`.

6. **`src/components/cheesenull/NullTotalStats.tsx`** -- Lifetime statistics card showing total CHEESE nulled, rewards distributed, xCHEESE sent, WAX compounded, and total null count. Adapted from `TotalStats.tsx`.

7. **`src/pages/CheeseNull.tsx`** -- Main page wrapped in the shared `Layout` component (providing CHEESEHub background, header, and footer). Contains the NullStats, NullButton, and NullTotalStats components arranged vertically.

### Modified Files (2 files)

1. **`src/components/Header.tsx`** -- Add "CHEESENull" link to the secondary navigation row (Row 2, alongside CHEESEFarm). Uses the `Flame` icon from lucide-react. Highlights when on `/cheesenull` route.

2. **`src/App.tsx`** -- Add route: `<Route path="/cheesenull" element={<CheeseNull />} />`

### Home Page Update (1 file)

3. **`src/pages/Index.tsx`** -- Add a CHEESENull card to the CHEESETools grid section, with the flame emoji, description of the burn mechanism, and a "Go to CHEESENull" button linking to `/cheesenull`.

## Key Adaptation: Wallet Integration

The original CHEESENull uses its own `WalletContext`. In CHEESEHub, all components use the unified `useWax()` context. The NullButton will be adapted to:

```text
Original:  const { session, transact } = useWallet();
Adapted:   const { session } = useWax();
           // Build action and call session.transact() directly
           // with getTransactPlugins(session) for Greymass Fuel
```

## No New Dependencies Required

All libraries needed (react-query, lucide-react, wharfkit, shadcn/ui) are already installed in CHEESEHub.

## Technical Details

- The `waxApi.ts` functions will be placed in `src/lib/cheeseNullApi.ts` to avoid conflicts with existing CHEESEHub API utilities
- BigInt-based voteshare calculations are preserved exactly as-is for precision
- The Alcor pool price fetch uses the public Alcor API (no RPC needed)
- The cooldown timer updates every second via `setInterval` in the hook
- All components use existing CHEESEHub CSS classes (`text-cheese`, `cheese-glow`, `bg-cheese/20`, etc.) for consistent styling

