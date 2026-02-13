

# Fix Farm "Under Construction" Detection

## Problem
The farm `testfarm4` has `status: 0` and `expiration: 1` from the contract. Our code assumes `expiration === 0` means "under construction", but the WaxDAO contract actually uses `expiration: 1` as the sentinel value for "never opened." Since `1 < now` is true, the farm incorrectly displays as "Expired" instead of "Under Construction."

## Solution
Change the under-construction check from `expiration === 0` to `expiration <= 1` to account for the contract's actual sentinel value.

## Changes

### `src/components/farm/FarmDetail.tsx` (line 180)

Change:
```js
const isUnderConstruction = farm.status === 0 && farm.expiration === 0;
```
To:
```js
const isUnderConstruction = farm.status === 0 && farm.expiration <= 1;
```

### `src/components/farm/BrowseFarms.tsx` and `src/components/farm/MyFarms.tsx`

Search for any other `expiration === 0` checks used for under-construction detection and update them to `expiration <= 1` as well.

### `src/components/farm/NFTStaking.tsx`

Same fix for the reward accrual capping logic -- if it checks expiration for "never opened" state, update it too.

## Impact
- Farm `testfarm4` (and any new farm) will correctly show "Under Construction" with the "Open Farm" button
- The "Close" and "Perm Close" buttons will no longer appear on under-construction farms
- The creator guidance box will show the correct "Add stakeable assets... then press Open Farm" message

