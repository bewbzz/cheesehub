

# Add Permanent Close Farm Feature + Fix Close Farm Messaging

## Overview

Two changes are needed:
1. **Fix incorrect messaging** in `CloseFarmDialog` - it incorrectly states rewards will be returned
2. **Add new `PermCloseFarmDialog`** for permanently removing farm records from the contract

## Files to Create

### `src/components/farm/PermCloseFarmDialog.tsx` (New File)

A dialog component for permanently closing a farm using the `permclosefrm` action:

| Element | Description |
|---------|-------------|
| Trigger Button | Red "Perm Close" button with Trash2 icon |
| Title | "Permanently Close Farm" with AlertTriangle icon |
| Warning | Destructive alert explaining this is irreversible and removes the farm entirely |
| Confirmation | Cancel / "Permanently Close" footer |

## Files to Modify

### 1. `src/lib/farm.ts`

Add a new action builder function after `buildCloseFarmAction` (after line 504):

```typescript
export function buildPermCloseFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "permclosefrm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
    },
  };
}
```

### 2. `src/components/farm/CloseFarmDialog.tsx`

Fix the incorrect reward return messaging:

| Lines | Current | New |
|-------|---------|-----|
| 94-98 | "Closing the farm will permanently shut it down. Any remaining rewards in the pool will be returned to you." | "Closing the farm will permanently shut it down. Stakers will no longer be able to claim rewards." |
| 102-119 | Section showing "Remaining Reward Balances" with "These tokens will be returned" | Remove this entire section |

### 3. `src/components/farm/FarmDetail.tsx`

| Line | Change |
|------|--------|
| 72 | Add import for `PermCloseFarmDialog` |
| 314-316 | Display both buttons for expired farms |

Current:
```tsx
{isCreator && isExpired && (
  <CloseFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
```

New:
```tsx
{isCreator && isExpired && (
  <>
    <CloseFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
    <PermCloseFarmDialog farm={farm} onSuccess={() => navigate('/farm')} />
  </>
)}
```

## Summary

| File | Action |
|------|--------|
| `src/lib/farm.ts` | Add `buildPermCloseFarmAction` function |
| `src/components/farm/CloseFarmDialog.tsx` | Remove incorrect reward return messaging |
| `src/components/farm/PermCloseFarmDialog.tsx` | Create new dialog component |
| `src/components/farm/FarmDetail.tsx` | Import and display `PermCloseFarmDialog` |

