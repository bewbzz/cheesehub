

# Fix Farm Status Display Bugs

## Problem
Farm statuses are displaying incorrectly in multiple places:
- Badge next to farm name shows "Closed" (amber) instead of "Permanently Closed" (red)
- Farm Information section shows "Expired" instead of "Permanently Closed"
- Kick Users button not appearing because wrong status code is being checked

## Root Cause
The status code mapping is swapped, and the Farm Info section is missing closed/perm closed states entirely.

## Changes

### 1. Fix status code mapping in FarmDetail.tsx (line 187-188)
Swap the values:
- `isClosed = farm.status === 3` (was 2)
- `isPermClosed = farm.status === 2` (was 3)

### 2. Fix `isUnderConstruction` logic in FarmDetail.tsx (line 180)
Change from `||` to `&&`:
- `const isUnderConstruction = farm.status === 0 && farm.expiration === 0`

This ensures a farm that was opened (has non-zero expiration) but still has status 0 is treated as Active/Expired, not Under Construction.

### 3. Add Closed/Permanently Closed to Farm Info section (lines 348-355)
The Farm Status display only handles Under Construction, Expired, and Active. Add:
- Permanently Closed (red) 
- Closed (amber)

These should be checked before Expired/Active since they take priority.

### 4. Update FarmCard.tsx to show closed/perm closed badges
Currently only shows "Expired". Add status badges for Closed and Permanently Closed farms in the browse view.

### 5. Update status comment
Fix the comment on line 186 to reflect the correct mapping:
`0 = Under Construction, 1 = Active, 2 = Permanently Closed, 3 = Closed`

## Files Modified
- `src/components/farm/FarmDetail.tsx` - Status code swap, isUnderConstruction fix, Farm Info display
- `src/components/farm/FarmCard.tsx` - Add closed/perm closed badges

