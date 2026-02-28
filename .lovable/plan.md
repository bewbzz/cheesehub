

## Minutes Countdown for Ad Slots Under 1 Hour

### What Changes

When an ad slot is less than 1 hour from going live, instead of showing "< 1 hr", it will display a live minutes countdown (e.g., "42 min", "5 min", "< 1 min") that updates every 30 seconds.

### Technical Details

**File: `src/components/bannerads/SlotCalendar.tsx`**

1. **Replace the static `hoursUntilLive` function** with a new React component `LiveCountdown` that:
   - Calculates the difference in seconds between now and the slot time
   - If >= 1 hour: displays static hours text (same as current behavior)
   - If < 1 hour: displays minutes remaining and uses a `useEffect` interval (every 30s) to re-render the countdown live
   - If < 1 minute: shows "< 1 min"

2. **Update the rendering** in the slot group row (around line 194) to use the new `<LiveCountdown slotTime={group.time} />` component instead of the `hoursUntilLive(group.time)` function call.

No new dependencies needed -- just `useState` and `useEffect` from React (already imported).

