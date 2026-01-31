
# Show Farm End Time for Creator Only

## Overview
Add the exact local time when the farm expires, displayed only to the farm creator. This gives creators precise visibility into when their farm will end without cluttering the view for regular users.

## Current Display
```text
Expires: 2/15/2026
```

## New Display (Creator Only)
```text
Expires: 2/15/2026
         3:45:30 PM  ← Only visible to creator
```

## Implementation

### File: `src/components/farm/FarmDetail.tsx`

**Current code (line 314):**
```tsx
<p className="font-medium">{expirationDate.toLocaleDateString()}</p>
```

**New code:**
```tsx
<div>
  <p className="font-medium">{expirationDate.toLocaleDateString()}</p>
  {isCreator && !isUnderConstruction && (
    <p className="text-xs text-muted-foreground">
      {expirationDate.toLocaleTimeString()}
    </p>
  )}
</div>
```

## Technical Notes

- Uses `toLocaleTimeString()` which automatically formats the time based on the user's browser locale/timezone
- The time is hidden when the farm is "under construction" (no expiration set yet)
- Styled as smaller, muted text to keep focus on the date
- No additional dependencies needed - uses native JavaScript Date methods
