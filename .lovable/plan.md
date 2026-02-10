

# Remove "Total Claimed" Metric from Your Rewards Section

## Summary
Remove the "Total Claimed" column from the 3-column rewards grid in the NFTStaking component, leaving only "Pending" and "Claimable Now" in a 2-column layout.

## Changes

### File: `src/components/farm/NFTStaking.tsx`

1. **Remove the "Total Claimed" grid column** -- delete the entire card/column that displays the locally-tracked total claimed amount
2. **Change the grid from 3 columns to 2 columns** -- update `grid-cols-3` to `grid-cols-2` in the rewards grid container
3. **Remove the claim button width constraint** -- adjust the desktop claim button from `md:w-1/3` to a more appropriate width for 2 columns (e.g., `md:w-1/2` or auto)
4. **Remove localStorage tracking logic** -- clean up the `totalClaimed` state, the `useEffect` that loads from localStorage, and the localStorage update in `handleClaim` since it's no longer displayed
5. **Remove the `CLAIMED_STORAGE_KEY` constant** since it's no longer needed

This simplifies the rewards section and removes the unreliable locally-tracked metric entirely.

