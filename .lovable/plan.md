
Goal: make the Banner Ads schedule truly UTC-day based so dates, filtering, and yellow “Live in …” use the same clock and no longer appear 24 hours ahead.

What is happening now (based on code + live network data):
1) Contract rows are anchored at 14:00 UTC increments (timestamps increase by 86400 seconds from that anchor), not 00:00 UTC.
2) In `SlotCalendar.tsx`, three different time interpretations are mixed:
   - Date label uses `format(group.date, ...)` (local timezone rendering).
   - Countdown uses `toMidnightUTC(slotTime)` (UTC-day rendering).
   - Filtering currently uses raw on-chain timestamp (`g.time > todayMidnightUTC`).
3) That mismatch causes the exact glitch you reported:
   - Visual date labels can shift by a day.
   - Countdown can reference the prior UTC day for that labeled row.
   - Net effect looks “24h ahead” (Mar 1 shows `<1 min`, Mar 2 shows `~9 hrs`, etc.).

Implementation plan

1. Normalize schedule logic to one canonical value: “slot UTC day start”
   - In `src/components/bannerads/SlotCalendar.tsx`, continue using `toMidnightUTC(...)` as the canonical day key.
   - Treat each slot as starting at `toMidnightUTC(rawSlotTime)` for all UI schedule semantics.

2. Fix filtering to use UTC-day comparison (not raw anchor time)
   - Update `filterFutureGroups` from:
     - `g.time > todayMidnightUTC`
   - To:
     - `toMidnightUTC(g.time) > todayMidnightUTC`
   - Result:
     - Any day whose UTC midnight already started is excluded.
     - The next visible row becomes the next UTC day (for your example: Mar 1 with ~9 hours remaining).

3. Fix row date label to render in UTC (not browser-local timezone)
   - Replace `format(group.date, "EEE, MMM d yyyy")` with a UTC formatter derived from the slot timestamp.
   - Use a small helper (inside `SlotCalendar.tsx` or shared util) based on `Intl.DateTimeFormat(..., { timeZone: "UTC" })`.
   - This guarantees “UTC Day” label text matches countdown semantics.

4. Keep countdown target at UTC midnight, but harden refresh behavior
   - Keep `LiveCountdown` based on `toMidnightUTC(slotTime) - now`.
   - Improve timer updates so countdown stays accurate while page remains open (not only when already under 1 hour).
   - Recommended: update every 30s or 60s continuously while mounted.
   - This prevents stale “hours/minutes” values in long-lived sessions.

5. Align admin/renter dialogs that display slot dates (consistency fix)
   - Update banner date rendering in:
     - `src/components/bannerads/RentSlotDialog.tsx`
     - `src/components/bannerads/RemoveBannerDialog.tsx`
     - `src/components/bannerads/ReinstateBannerDialog.tsx`
     - `PreviewBannerDialog` inside `SlotCalendar.tsx`
   - Use the same UTC-day formatter so all displayed slot dates are consistent with calendar rows and contract expectations.

Validation checklist after implementation
1) At Sat Feb 28, 2026 14:48 UTC:
   - First visible day should be Sun Mar 1, 2026.
   - “Live in” should be about 9 hours.
2) Next rows should be:
   - Mar 2: ~33 hours
   - Mar 3: ~57 hours
3) No row should display a UTC date that disagrees with its countdown.
4) Rent/Remove/Reinstate/Preview dialogs should show the same UTC date as the row.
5) Verify by clicking Refresh and waiting 1–2 minutes to confirm countdown updates correctly over time.

Why this is an issue (plain explanation)
- The contract stores slot timestamps at a fixed daily anchor (currently 14:00 UTC).
- The UI intended to present “UTC day starts at midnight,” but parts of the UI were still using local timezone and raw anchor time.
- Once all UI pieces use the same UTC-day normalization, the schedule becomes correct and predictable.

Technical notes
- No contract change required.
- No API shape change required.
- Frontend-only correction in date normalization/rendering and filter comparison.
- Keeps current rent/join lead-time buffers untouched (those are contract/on-chain constraints and should remain based on actual `slot.time`).
<lov-actions>
<lov-suggestion message="Test the Banner Ads calendar end-to-end in the preview and confirm Mar 1 shows about 9 hours remaining at Feb 28 14:xx UTC, with Mar 2 around 33 hours.">Verify the UTC-day fix end-to-end</lov-suggestion>
<lov-suggestion message="Apply the same UTC date formatter to all banner-related dialogs and toast messages so every slot date is consistent across the app.">Standardize UTC date display everywhere</lov-suggestion>
<lov-suggestion message="Add a small tooltip next to 'UTC Day' showing the exact slot start timestamp in UTC (e.g., 2026-03-01 00:00 UTC) for transparency.">Add exact UTC start tooltip</lov-suggestion>
</lov-actions>
