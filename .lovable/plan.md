

# Fix: Close Farm Transaction Not Broadcasting + isUnderConstruction Logic

## Problem 1: AlertDialogAction auto-closes before transaction sends

The Radix UI `AlertDialogAction` component automatically closes the dialog on click. Since `handleCloseFarm` is async (it needs to wait for wallet signing and broadcast), the dialog unmounts before the transaction completes. The toast fires from the `try` block but the `session.transact()` call gets interrupted.

## Problem 2: isUnderConstruction uses OR instead of AND

The current logic `(farm.status === 0 || farm.expiration === 0)` means any farm with status 0 is "under construction" even if it was opened and expired. The WaxDAO contract keeps status at 0 for active/expired farms. It should use AND -- a farm is only under construction if it has never been opened (status 0 AND expiration 0).

## Changes

### File: `src/components/farm/CloseFarmDialog.tsx` (line 98-101)

Add `e.preventDefault()` to stop the AlertDialogAction from auto-closing:

```
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault();
    handleCloseFarm();
  }}
  disabled={isSubmitting}
  ...
```

### File: `src/components/farm/PermCloseFarmDialog.tsx` (line 98-101)

Same fix -- add `e.preventDefault()`:

```
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault();
    handlePermCloseFarm();
  }}
  disabled={isSubmitting}
  ...
```

### File: `src/components/farm/EmptyFarmDialog.tsx` (line 95-98)

Same fix -- add `e.preventDefault()`:

```
<AlertDialogAction
  onClick={(e) => {
    e.preventDefault();
    handleEmpty();
  }}
  disabled={isSubmitting}
  ...
```

### File: `src/components/farm/FarmDetail.tsx` (line 179)

Change OR to AND:

```
const isUnderConstruction = farm.status === 0 && farm.expiration === 0;
```

This means:
- `status: 0, expiration: 0` = genuinely never opened = "Under Construction" with Open Farm button
- `status: 0, expiration: non-zero` = was opened, now expired = "Expired"
- `status: 2` = closed = "Closed" with Kick Users / Open Farm (if no stakers)
- `status: 3` = permanently closed

The existing Change 4 from the previous edit (showing Open Farm for closed farms with no stakers) remains correct and is already in place.

## Result

- Close/PermClose/Empty dialogs will stay open while the wallet signs and broadcasts
- Farm status displays correctly after closure
- Kick Users button appears for closed farms with stakers
- Open Farm button appears for: (1) never-opened farms, and (2) closed farms after all stakers are kicked
