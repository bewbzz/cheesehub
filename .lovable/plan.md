
# Add Close Farm Button for Expired Farms

## Overview

When a WaxDAO V2 farm expires, the creator should see a "Close Farm" button instead of the "Extend" button. This calls the `closefarm` action on the `farms.waxdao` contract to properly shut down the farm.

## Current Behavior

- The "Extend" button appears for creators on all active farms (lines 310-311 in FarmDetail.tsx)
- The extend button is shown regardless of whether the farm has expired
- No `closefarm` action exists in the codebase

## Proposed Changes

### 1. Add `buildCloseFarmAction` to `src/lib/farm.ts`

Add a new action builder following the existing pattern (similar to `buildExtendFarmAction`):

```typescript
export function buildCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "closefarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
    },
  };
}
```

### 2. Create `CloseFarmDialog` Component

New file: `src/components/farm/CloseFarmDialog.tsx`

This dialog will:
- Show a confirmation warning that closing the farm is permanent
- Display information about any remaining reward balances that will be returned to the creator
- Include a destructive-styled "Close Farm" button
- Call the `closefarm` action on the contract

Key features:
- Uses `AlertDialog` pattern for destructive action confirmation
- Shows remaining reward pool balances so the creator knows what will be returned
- Includes clear warning about the irreversible nature of closing

### 3. Update `FarmDetail.tsx`

Modify the "Expires" section (lines 307-322) to conditionally render:
- **If NOT expired**: Show `ExtendFarmDialog` (current behavior)
- **If expired**: Show `CloseFarmDialog` instead

```text
Before (current):
  {isCreator && !isUnderConstruction && (
    <ExtendFarmDialog ... />
  )}

After:
  {isCreator && !isUnderConstruction && !isExpired && (
    <ExtendFarmDialog ... />
  )}
  {isCreator && isExpired && (
    <CloseFarmDialog ... />
  )}
```

## Technical Details

### CloseFarmDialog Component Structure

| Element | Description |
|---------|-------------|
| Trigger Button | Red/destructive styled "Close" button (matches the Extend button size) |
| Dialog Title | "Close Farm" |
| Warning Alert | Explains that closing is permanent |
| Reward Balance Display | Shows remaining tokens that will be returned |
| Cancel Button | Closes dialog without action |
| Confirm Button | Destructive button that calls `closefarm` action |

### File Changes Summary

| File | Change |
|------|--------|
| `src/lib/farm.ts` | Add `buildCloseFarmAction` function |
| `src/components/farm/CloseFarmDialog.tsx` | New component for close farm confirmation |
| `src/components/farm/FarmDetail.tsx` | Import `CloseFarmDialog`, conditionally render based on expiration status |

## User Flow

1. Farm creator views their expired farm
2. Instead of "Extend" button, they see a red "Close" button next to "Expires"
3. Clicking "Close" opens a confirmation dialog
4. Dialog shows warning and remaining reward pool balances
5. Creator clicks "Close Farm" to confirm
6. Transaction is submitted to the blockchain
7. Success toast appears and farm data refreshes
