

## Fix: Live Countdown Showing Wrong Time

### Root Cause

The slot times on-chain are set to **14:00 UTC** each day, not midnight. The `filterFutureGroups` function filters using `todayMidnightUTC`, which is always 00:00 UTC of the current day. This means a slot at 14:00 UTC today still passes the filter even after it has already started. `LiveCountdown` then calculates `slotTime - now` as negative, clamps it to 0 via `Math.max`, and displays "< 1 min".

### Fix

**File: `src/components/bannerads/SlotCalendar.tsx`** (lines 121-126)

Change `filterFutureGroups` to compare each group's `time` against the current Unix timestamp (in seconds) instead of today's midnight:

```tsx
function filterFutureGroups(groups: BannerSlotGroup[]): BannerSlotGroup[] {
  const nowSec = Math.floor(Date.now() / 1000);
  return groups.filter((g) => g.time > nowSec);
}
```

This filters out any slot whose start time has already passed, regardless of what hour of the day it falls on. The result: only genuinely future slots appear, and the countdown will be accurate.

### What This Does NOT Change
- No slots are deleted or modified on-chain
- No changes to the `useBannerSlots` hook or any other component
- All existing rented/shared/available slot data remains intact
- Only the client-side visibility filter is corrected
