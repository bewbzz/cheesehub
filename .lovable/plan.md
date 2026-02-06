

# Add "Staked Only" Filter to CHEESEFarm Browse

## Overview

Add a checkbox to the Browse Farms filter bar that, when checked, only shows farms where the connected user currently has NFTs staked. This reuses the existing `fetchUserGlobalStakes` function which returns a list of farm names the user is staking in.

## How It Works

1. When the checkbox is checked, fetch the user's global stakes (list of farm names they're staking in)
2. Filter the farms list to only show farms matching those names
3. The checkbox is only enabled when a wallet is connected
4. When unchecked or wallet not connected, all farms show as normal

## Technical Details

### File: `src/components/farm/BrowseFarms.tsx`

**New state and query:**
- Add `showStakedOnly` state (default: false)
- Import `useWax` to get `accountName` and `isConnected`
- Import `fetchUserGlobalStakes` from `@/lib/farm`
- Add a `useQuery` call for `fetchUserGlobalStakes(accountName)`, enabled only when `showStakedOnly` is true and wallet is connected

**New filter in `filteredFarms` memo:**
- When `showStakedOnly` is true and staked farm data is available, filter results to only include farms whose `farm_name` appears in the staked farms list
- Add `showStakedOnly` and staked data to the memo dependencies

**New UI element:**
- Add a `Checkbox` + `Label` pair next to the existing "Active only" switch
- Label text: "Staked only"
- Disabled when wallet is not connected (with reduced opacity)
- Auto-unchecks if wallet disconnects

### Imports to add:
- `Checkbox` from `@/components/ui/checkbox`
- `useWax` from `@/context/WaxContext`
- `fetchUserGlobalStakes` from `@/lib/farm`
- `useQuery` is already imported

### UI Layout

The filter bar will look like:

```text
[Search input...                    ] [x] Active only  [x] Staked only  [Sort ▼]
```

The "Staked only" checkbox sits between "Active only" and the sort dropdown, using the same styling pattern.

