
# Add Flashing "Stake Positions" Button to Collapsed Farm View

## Overview

Currently, when new stakeable incentives become available in an existing farm position, users only see this information after expanding the farm card. This change adds a prominently flashing "Stake Positions" button directly on the collapsed/main view to improve discoverability.

## Current Behavior

- The "Stake Position" or "Stake All" button only appears after clicking the expand chevron
- Users have no visual cue on the main view that new rewards are available to stake

## Proposed Change

Add a flashing green "Stake" button to the actions area of each farm position row (next to the Claim button) when `position.unstakedIncentives.length > 0`.

## Implementation Details

### File: `src/components/wallet/AlcorFarmManager.tsx`

**Location**: Inside the staked position card's actions section (around line 826-855), add a new button that appears before the Claim/Unstake buttons when there are unstaked incentives.

**Button Behavior**:
- Shows when `position.unstakedIncentives.length > 0`
- Single incentive: Shows "Stake" button that calls `handleStakeToIncentive`
- Multiple incentives: Shows "Stake (N)" button that calls `handleStakeAllIncentives`
- Uses `animate-pulse` class for attention-grabbing flashing effect
- Green styling to indicate positive action (earning opportunity)
- Compact size to fit alongside existing action buttons

**Visual Design**:
```
[Stake] [Claim] [▼]     ← When 1 unstaked incentive
[Stake (3)] [Claim] [▼] ← When 3 unstaked incentives
```

### Code Changes

In the actions `<div>` section (currently lines 826-855), add a conditional button before the existing claim/unstake logic:

```tsx
{/* Stake new incentives button - visible on collapsed view */}
{position.unstakedIncentives.length > 0 && (
  <Button
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      if (position.unstakedIncentives.length === 1) {
        handleStakeToIncentive(position.positionId, position.unstakedIncentives[0]);
      } else {
        handleStakeAllIncentives(position.positionId, position.unstakedIncentives);
      }
    }}
    disabled={isTransacting}
    className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse"
  >
    <Zap className="h-3 w-3 mr-1" />
    {position.unstakedIncentives.length === 1 
      ? 'Stake' 
      : `Stake (${position.unstakedIncentives.length})`
    }
  </Button>
)}
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/wallet/AlcorFarmManager.tsx` | Add flashing "Stake" button to the actions area of collapsed farm position cards when unstaked incentives are available |

## User Experience

1. User opens wallet and sees their farm positions
2. If any position has new incentives available, a pulsing green "Stake" button is immediately visible
3. Clicking the button stakes the position to the new incentive(s) without needing to expand the card
4. The expanded view continues to show the detailed breakdown of available incentives for users who want more information
