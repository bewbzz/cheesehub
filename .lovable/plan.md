

# Replace Calendar with Duration Presets in Farm Dialogs

## Overview
Replace the calendar date picker in both the "Open Farm" and "Extend Farm" dialogs with simple duration preset options. This provides a much better user experience by eliminating the need to manually select dates.

## Duration Options

```typescript
const DURATION_OPTIONS = [
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 24 * 7 },
  { value: "30d", label: "30 days", hours: 24 * 30 },
  { value: "90d", label: "90 days", hours: 24 * 90 },
  { value: "180d", label: "180 days", hours: 24 * 180 },
  { value: "360d", label: "360 days", hours: 24 * 360 },
];
```

## UI Design

```text
+--------------------------------+
| Open Farm / Extend Farm        |
| Set how long the farm runs     |
+--------------------------------+
| [Current Expiration: Feb 1]    |  <- Only for Extend dialog
+--------------------------------+
| Farm Duration                  |
| +----------------------------+ |
| | ( ) 24 hours               | |
| | ( ) 7 days                 | |
| | (x) 30 days                | |
| | ( ) 90 days                | |
| | ( ) 180 days               | |
| | ( ) 360 days               | |
| +----------------------------+ |
|                                |
| Expires: March 2, 2026 3:45 PM |
+--------------------------------+
| [Cancel]         [Open Farm]   |
+--------------------------------+
```

## Implementation Plan

### 1. Update `src/components/farm/OpenFarmDialog.tsx`

**Remove:**
- Calendar component import
- Popover imports  
- CalendarIcon import
- `date` state and minDate calculation

**Add:**
- RadioGroup, RadioGroupItem imports from `@/components/ui/radio-group`
- Clock icon import from lucide-react
- `DURATION_OPTIONS` constant with all 6 options
- `selectedDuration` state (string, default to "7d")

**Modify:**
- Calculate expiration date from selected duration using `useMemo`
- Replace calendar Popover UI with RadioGroup showing the six duration options
- Show calculated expiration date/time below the options
- Update submit handler to use computed expiration timestamp
- Update disabled logic on submit button

### 2. Update `src/components/farm/ExtendFarmDialog.tsx`

**Same changes as OpenFarmDialog, plus:**
- Keep the "Current Expiration" info display at the top
- Duration is calculated from NOW (current time), not from current expiration
- Update reward shortfall calculation to use the computed expiration date
- Show "New Expiration" date clearly

## Technical Details

### Expiration Calculation
```typescript
const expirationDate = useMemo(() => {
  const option = DURATION_OPTIONS.find(o => o.value === selectedDuration);
  if (!option) return null;
  const date = new Date();
  date.setHours(date.getHours() + option.hours);
  return date;
}, [selectedDuration]);

const expirationTimestamp = expirationDate 
  ? Math.floor(expirationDate.getTime() / 1000) 
  : 0;
```

### ExtendFarmDialog Shortfall Integration
The existing reward shortfall calculation uses `date` state - we'll replace that with the computed `expirationDate` from the duration preset. The shortfall logic calculates hours from current expiration to new expiration, which will continue to work correctly.

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/farm/OpenFarmDialog.tsx` | Modify | Replace calendar with 6 duration radio buttons |
| `src/components/farm/ExtendFarmDialog.tsx` | Modify | Replace calendar with 6 duration radio buttons, maintain shortfall logic |

