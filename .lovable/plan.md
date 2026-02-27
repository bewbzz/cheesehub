

## 48-Hour Rent Buffer / 12-Hour Join Buffer

### Overview
Apply two separate time buffers to prevent gaming while still allowing shared slot joins:

- **Rent button** (new exclusive or shared rental): requires **48 hours** before go-live
- **Join button** (joining an existing shared slot): requires **12 hours** before go-live

This gives shared slot creators 36+ hours of visibility for others to join, while preventing last-minute joins that could disrupt display scheduling.

### Changes

**File: `src/components/bannerads/SlotCalendar.tsx`**

1. Add two constants and a helper:

```tsx
const MIN_RENT_BUFFER_HOURS = 48;
const MIN_JOIN_BUFFER_HOURS = 12;

function isWithinBuffer(slotTime: number, bufferHours: number): boolean {
  const cutoff = Math.floor(Date.now() / 1000) + bufferHours * 3600;
  return slotTime >= cutoff;
}
```

2. Add `isWithinBuffer(slot.time, 48)` condition to the **Rent** button (around line 155)

3. Add `isWithinBuffer(slot.time, 12)` condition to the **Join** button (around line 163)

4. Keep `filterFutureGroups` unchanged -- all future slots remain visible so users can see what's coming, buttons just become disabled/hidden based on buffer windows.

### Result
- Slots always visible with countdown timers
- Rent buttons disappear when less than 48 hours remain
- Join buttons disappear when less than 12 hours remain
- No way to game cheap exclusivity via last-minute shared rentals

