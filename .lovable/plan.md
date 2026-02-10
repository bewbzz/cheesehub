

# Fix: isExpired Must Exclude Closed/PermClosed Farms

## Problem

Line 181 in `FarmDetail.tsx`:
```
const isExpired = !isUnderConstruction && farm.expiration < now;
```

This evaluates to `true` for closed farms (status 2) that have a past expiration -- which is almost always the case. So testfarm3 shows "Expired" with a "Close Farm" button instead of "Closed" with "Kick Users" / "Open Farm" buttons.

## Fix

**File: `src/components/farm/FarmDetail.tsx`** (line 181)

Exclude closed and permanently closed farms from the expired check:

```
const isExpired = !isUnderConstruction && !isClosed && !isPermClosed && farm.expiration < now;
```

This requires reordering the declarations so `isClosed` and `isPermClosed` are defined before `isExpired`. Move lines 186-187 above line 181.

## Resulting Status Logic

| On-chain state | UI Status | Buttons (creator) |
|---|---|---|
| status 0, expiration 0 | Under Construction | Open Farm |
| status 0, expiration > now | Active | Close Farm, Extend, etc. |
| status 0, expiration < now | Expired | Close Farm |
| status 2, stakers > 0 | Closed | Kick Users |
| status 2, stakers = 0 | Closed | Open Farm |
| status 3 | Permanently Closed | Empty Farm (if rewards remain) |

