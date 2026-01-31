
# Restore Calendar Date Picker to Open Farm Dialog

## Overview
Replace the preset duration radio buttons in the Open Farm dialog with a calendar date picker, matching the pattern already used in the Extend Farm dialog.

## Current State
The Open Farm dialog uses preset durations (24h, 7d, 30d, etc.) via a RadioGroup.

## Target State
The Open Farm dialog will use a Calendar date picker for selecting the expiration date, consistent with how Extend Farm works.

## Changes to `src/components/farm/OpenFarmDialog.tsx`

### Imports
- Remove: `RadioGroup`, `RadioGroupItem`, `Label`
- Add: `Calendar`, `Popover`, `PopoverContent`, `PopoverTrigger`, `CalendarIcon`, `cn`

### State Changes
- Remove: `selectedDuration` state and `DURATION_OPTIONS` constant
- Add: `date` state as `Date | undefined`

### Logic Changes
- Remove: `useMemo` for calculating expiration from duration
- Update: Derive `expirationDate` directly from `date` state
- Add: Minimum date constraint (tomorrow)

### UI Changes
Replace the RadioGroup with a Popover + Calendar picker:

```text
Before:                          After:
+------------------+             +---------------------------+
| ( ) 24 hours     |             | Expiration Date           |
| (o) 7 days       |             | [Pick a date        📅]   |
| ( ) 30 days      |             +---------------------------+
| ( ) 90 days      |             | Calendar popover          |
| ( ) 180 days     |             |                           |
| ( ) 360 days     |             +---------------------------+
+------------------+
```

### Key Implementation Details
- Use `pointer-events-auto` class on Calendar to ensure it works inside the dialog
- Set minimum date to tomorrow to prevent selecting past dates
- Keep the "Farm expires" preview box showing the selected date/time
- Disable date picker when rewards are missing (same as current behavior)

## File Summary

| File | Action |
|------|--------|
| `src/components/farm/OpenFarmDialog.tsx` | Replace RadioGroup with Calendar date picker |
