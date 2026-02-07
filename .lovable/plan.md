

# Improve "Your Rewards" Section Layout in Farm Detail

## Overview
Redesign the rewards section at the bottom of the farm detail page to spread data across the full width (instead of cramming everything on the left) and add a "Total Claimed" metric. The layout will use a 3-column grid: Claimable Now | Pending | Total Claimed, with the Claim button prominently placed below or to the right.

## Important Note on "Total Claimed"
The WaxDAO farms contract does **not** store a "total claimed" value on-chain per user. To provide this metric, we have two options:

1. **Track claims locally** in browser storage (localStorage) -- accumulate each successful claim amount. This is per-device and resets if the user clears storage, but provides an immediate working solution.
2. **Show "Total Claimed" as a session-only counter** that tracks claims made during the current session.

Option 1 (localStorage) is recommended as it persists across sessions and gives the best user experience, with a small note like "tracked locally" to set expectations.

## Changes

### 1. `src/components/farm/NFTStaking.tsx` -- Redesign rewards layout

**Current layout**: A left-aligned stack of "Claimable Now" and "Pending" with the Claim button floated right.

**New layout**: A responsive grid with 3 metric columns plus the claim button:

```
+-------------------+-------------------+-------------------+
|  Claimable Now    |     Pending       |   Total Claimed   |
|  1234.5678 CHEESE |  +12.3456 CHEESE  |  5000.0000 CHEESE |
|                   |  (in 2:34)        |  (tracked locally)|
+-------------------+-------------------+-------------------+
|              [ Claim Rewards Button ]                     |
+-----------------------------------------------------------+
```

- Each column shows the token logo, amount badge, and label
- On mobile, the grid collapses to a single column with clear spacing
- The Claim button spans full width below the metrics
- NFT count ("3 NFTs staked") moves to the card header area next to "Your Rewards"

### 2. `src/components/farm/NFTStaking.tsx` -- Add Total Claimed tracking

- Add state for `totalClaimed` loaded from localStorage on mount
- Key format: `farm_claimed_{farmName}_{account}` to track per-farm per-user
- On successful claim, add the claimed amounts to the stored totals
- Display with a subtle "(tracked locally)" label so users understand the data source

### 3. `src/components/farm/NFTStaking.tsx` -- Update claim handler

- After a successful claim transaction, read the current `pendingRewards` values and add them to the localStorage totals
- Refresh the `totalClaimed` state

## Technical Details

- **localStorage key**: `cheese_farm_claimed_{farmName}_{accountName}` storing a JSON object like `{ "CHEESE": 1234.5678, "WAX": 0.5 }`
- **Grid classes**: `grid grid-cols-1 sm:grid-cols-3 gap-4` for the 3-column responsive layout
- **Claim button**: Moves below the grid as a full-width button with `w-full` class
- **NFT count badge**: Moves to header row: "Your Rewards -- 3 NFTs staked"
- No new dependencies needed

