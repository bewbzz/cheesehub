
## Fix Timezone Handling in Slot Calendar

### Problem
The slot calendar uses `date-fns format()` which formats dates in the browser's local timezone (UTC+10 for you). This makes date labels and the "future slots" filter inconsistent with the actual UTC-based slot times.

### Changes (1 file)

**File: `src/components/bannerads/SlotCalendar.tsx`**

1. **Fix `filterFutureGroups`** -- Instead of comparing against "today's UTC midnight", simply compare `g.time` against `Math.floor(Date.now() / 1000)` (current epoch). This correctly filters out slots that have already started, regardless of timezone.

2. **Fix date formatting to use UTC** -- Replace `format(group.date, "EEE, MMM d yyyy")` with a UTC-based formatter. Use `date-fns/formatInTimeZone` is not available, so we'll use the built-in `Date.toLocaleDateString` with `timeZone: 'UTC'` option, or manually format from UTC getters:
   ```
   group.date.toLocaleDateString('en-US', {
     weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
   })
   ```

3. **Fix the `PreviewBannerDialog` title** -- Same UTC formatting fix for the `format(new Date(slot.time * 1000), "MMM d yyyy")` call in the preview dialog header.

### Result
- Date labels will always show the UTC date regardless of the user's local timezone
- The filter will correctly show/hide slots based on whether they've started (not based on UTC midnight)
- The countdown remains unchanged (it's already correct epoch math)
