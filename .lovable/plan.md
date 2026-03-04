

## Fix: Checkboxes Not Visible on CHEESEAds Slots

### Problem
The `isSlotSelectable` function in `SlotCalendar.tsx` has a `!isAdmin` guard on both conditions (lines 206 and 210). If the logged-in user is an admin, checkboxes never render for any slot.

### Fix

**File: `src/components/bannerads/SlotCalendar.tsx`**

Remove the `!isAdmin` check from `isSlotSelectable`. Admins should also be able to multi-select and bulk-rent slots. The admin-specific buttons (Edit, Remove, Reinstate, Preview) already render separately and won't conflict.

```ts
// Before
if ((slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared" && !isAdmin && isWithinBuffer(...)) {

// After
if ((slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared" && isWithinBuffer(...)) {
```

Same change for the shared-slot joining condition on line 210.

Also remove `!isAdmin` from the multi-select hint message (line 244) so it shows for all users.

