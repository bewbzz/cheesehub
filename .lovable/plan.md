

# Add Warning for NFTs Already Staked in Other Farms

## Overview
This implementation adds a warning system to the NFT staking interface that alerts users when they try to stake NFTs that are already registered in another WaxDAO V2 farm. Since V2 farms are non-custodial but enforce single-farm staking per asset, users need clear feedback before attempting to stake.

## Problem Context
WaxDAO V2 farms use a global tracking system where each NFT can only be staked in one V2 farm at a time. When a user tries to stake an NFT already registered elsewhere, they get the error:
```
assertion failure with message: asset id [ID] is already staked here
```

The "here" refers to the global contract tracking, not the current farm.

## Solution Design
Add a query to fetch all NFTs the user has globally staked across V2 farms, then display visual indicators on NFTs that are already staked elsewhere, along with information about which farm they are staked in.

```text
+---------------------------+
|  NFT Card (Eligible)      |
|  +-------------------+    |
|  |                   |    |
|  |     [NFT Image]   |    |
|  |                   |    |
|  +-------------------+    |
|  | Name: Cool NFT    |    |
|  | Staked in: farm1  | <-- Warning badge
+---------------------------+
```

## Implementation Plan

### 1. Add Global Staking Query Function to `src/lib/farm.ts`

Add a new function `fetchUserGlobalStakes` that queries the `stakers` table using the user index (index 2) to get all farms where the user has staked NFTs:

```typescript
// Return type
interface GlobalStakeInfo {
  farmName: string;
  assetIds: string[];
}

// Fetches all asset IDs the user has staked across ALL V2 farms
export async function fetchUserGlobalStakes(account: string): Promise<GlobalStakeInfo[]>
```

This function will:
- Query the `stakers` table at contract scope with index 2 (by user)
- Return an array of objects containing farm name and staked asset IDs
- Allow the UI to identify which NFTs are staked elsewhere and in which farm

### 2. Update `src/components/farm/NFTStaking.tsx`

**Add new state and query:**
- Add a React Query hook to fetch global stakes for the connected user
- Create a computed `globallyStakedMap` that maps asset_id -> farm_name for quick lookup (excluding current farm)

**Update the eligible NFTs display:**
- Modify the NFTCard rendering to show a warning indicator when an NFT is staked in another farm
- Add a tooltip or badge showing which farm the NFT is currently staked in

**Add a warning banner:**
- When any selected NFTs are staked elsewhere, show a prominent warning above the stake button
- List which NFTs would fail and provide the option to deselect them

**Disable staking for already-staked NFTs:**
- Prevent selection of NFTs that are globally staked
- Or allow selection but show clear warning with option to auto-deselect

### 3. UI Design Updates

**NFT Card Enhancement:**
Add a visual indicator for NFTs staked elsewhere:
- Amber/yellow overlay or border on NFT cards that are staked in another farm
- Small badge showing "Staked in [farmname]"
- Reduce opacity slightly to indicate unavailability

**Selection Behavior:**
- When selecting an NFT staked elsewhere, show a toast warning
- Or prevent selection entirely with a visual "locked" indicator

**Stake Button Warning:**
If any selected NFTs are staked elsewhere, show:
```
Warning: X NFT(s) are already staked in other farms and will fail:
- NFT #123 (in farmA)
- NFT #456 (in farmB)
[Remove from selection] [Stake anyway]
```

## Technical Details

### Contract Query Strategy
The `stakers` table at `farms.waxdao` scope with index 2 (key_type: name) returns all staking records for a user. Each row contains:
- `user`: account name
- `farmname`: the farm where NFTs are staked
- `asset_ids`: array of staked asset IDs
- Other metadata (claimable_balances, etc.)

### Performance Considerations
- Cache the global stakes query with appropriate staleTime (30s)
- Only refetch when user navigates to farm or after stake/unstake operations
- Use a Map for O(1) lookups when rendering NFT cards

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/farm.ts` | Modify | Add `fetchUserGlobalStakes` function |
| `src/components/farm/NFTStaking.tsx` | Modify | Add global stakes query, update NFTCard with warning indicators, add stake button warning |

