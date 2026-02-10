

# Fix: Kick Users Button Missing and Open Farm Button Incorrectly Showing

## Root Cause

The `isUnderConstruction` flag on line 179 of `FarmDetail.tsx` is defined as:

```text
const isUnderConstruction = farm.status === 0 || farm.expiration === 0;
```

When the WaxDAO contract closes a farm (status 2), it likely resets or zeroes the expiration field. This causes `farm.expiration === 0` to be true, making `isUnderConstruction` true **even though the farm is closed**. This has two effects:

- The "Open Farm" button appears (it renders when `isUnderConstruction` is true)
- The "Kick Users" button is hidden because the Farm Status display area doesn't show closed/permclosed states, and `isClosed` conditions are evaluated separately but the UI flow is broken by the incorrect status cascade

Additionally, the Farm Status text display (lines 347-355) only shows "Under Construction", "Expired", or "Active" -- it never shows "Closed" or "Permanently Closed", making it confusing for creators.

## The Fix

### File: `src/components/farm/FarmDetail.tsx`

**Change 1: Fix `isUnderConstruction` to exclude closed/permclosed farms**

Update line 179 to:
```text
const isUnderConstruction = (farm.status === 0 || farm.expiration === 0) 
  && farm.status !== 2 && farm.status !== 3;
```

This ensures that closed (status 2) and permanently closed (status 3) farms are never treated as "under construction", even if their expiration is 0.

**Change 2: Fix the Farm Status text display**

Update lines 347-355 to include Closed and Permanently Closed states:
```text
{isPermClosed ? (
  <span className="text-red-400">Permanently Closed</span>
) : isClosed ? (
  <span className="text-amber-400">Closed</span>
) : isUnderConstruction ? (
  <span className="text-amber-400">Under Construction</span>
) : isExpired ? (
  <span className="text-red-400">Expired</span>
) : (
  <span className="text-green-400">Active</span>
)}
```

**Change 3: Ensure Open Farm button also checks closed status explicitly**

Update lines 291-293 and 343-345 to add explicit guards:
```text
{isCreator && isUnderConstruction && !isClosed && !isPermClosed && (
  <OpenFarmDialog ... />
)}
```

This is a belt-and-suspenders safeguard in case other code paths set `isUnderConstruction` incorrectly.

**Change 4: Show Open Farm button for closed farms with no stakers**

Per the existing memory context, closed farms (not permclosed) can be reopened. Add the "Open Farm" button alongside the "No stakers to kick" message for closed farms:
```text
{isCreator && isClosed && !hasStakers && (
  <OpenFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
```

## Result

After these changes:
- Closing a farm will correctly show the "Closed" badge and status text
- The "Kick Users" button will appear when the farm is closed and has stakers
- The "Open Farm" button will only appear for genuinely under-construction farms, or for closed farms with no stakers remaining
- The status display will correctly show all 5 states: Under Construction, Active, Expired, Closed, Permanently Closed
