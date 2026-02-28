

## Simplify: Use Contract's 14:00 UTC Anchor Directly

### Approach
Stop normalizing to midnight UTC entirely. Just use the raw on-chain `slot.time` (14:00 UTC) for everything -- labels, countdowns, and filtering. This eliminates all offset hacks and alignment issues.

### Changes

**`src/components/bannerads/SlotCalendar.tsx`**

1. **Remove `toMidnightUTC` helper** -- no longer needed
2. **Simplify `filterFutureGroups`** -- just compare raw time to now:
   ```
   const nowSec = Math.floor(Date.now() / 1000);
   return groups.filter(g => g.time > nowSec);
   ```
3. **Simplify `LiveCountdown`** -- count down to `slotTime` directly instead of midnight:
   ```
   const diffSec = Math.max(0, slotTime - now);
   ```
4. **Update sub-heading** from "UTC Day" to "Starts 14:00 UTC" so users know the exact start time
5. **Keep `formatSlotDateUTC`** as-is -- it already formats using UTC timezone, and since the raw timestamp is on the correct date at 14:00 UTC, the label will be correct

**No changes needed in dialog files** -- they already call `formatSlotDateUTC(slot.time)` with the raw timestamp, which will now show the correct date since we're no longer normalizing.

### Result (at Feb 28, 15:00 UTC)

| On-chain time | Label | Countdown | Shown? |
|---|---|---|---|
| Feb 28, 14:00 | Sat, Feb 28 | Already past | No (filtered out) |
| Mar 1, 14:00 | Sun, Mar 1 | ~23 hrs | Yes |
| Mar 2, 14:00 | Mon, Mar 2 | ~47 hrs | Yes |
| Mar 3, 14:00 | Tue, Mar 3 | ~71 hrs | Yes |

### Why This Works
- The contract literally starts slots at 14:00 UTC on the labeled date
- Countdown matches reality (how long until that slot actually goes live)
- No normalization, no offsets, no timezone mismatches
- Bookings made for "Mar 1" will show under "Mar 1" because the on-chain timestamp IS Mar 1 at 14:00 UTC

