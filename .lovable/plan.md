

## Always Show Upcoming Slots (Frontend-Generated)

### Problem
The calendar only shows slots returned by the contract. Since the contract hasn't launched, no rows exist, so users see an empty "not initialized" message instead of the full UI.

### Solution
Generate the next 30 days of placeholder slots in the frontend. Merge any real on-chain data on top of them. Slots not yet initialized on-chain show as "Not Live" (disabled Rent button) instead of being hidden.

### Changes

**File: `src/components/bannerads/SlotCalendar.tsx`**

- Generate 30 days of placeholder `BannerSlotGroup` entries starting from today's UTC midnight
- Each day gets 2 placeholder slots (position 1 and 2) marked as `isAvailable: true` but with a new `isOnChain: false` flag
- Merge real on-chain slot data over placeholders (matching by time + position)
- For slots where `isOnChain === false`, show a "Not Live" badge and disable the Rent button
- Remove the empty-state card entirely -- the grid always renders

**File: `src/hooks/useBannerSlots.ts`**

- Add `isOnChain: boolean` to the `BannerSlot` interface (always `true` for contract-fetched data)

**File: `src/components/bannerads/SlotCalendar.tsx` -- SlotBadge updates**

- New badge state: if `!slot.isOnChain`, render a grey "Not Live" badge
- Rent button: disabled when `!slot.isOnChain` with a tooltip/title saying "Contract not yet initialized"

### Result
- The full 30-day calendar with both positions always renders
- Users can see the upcoming slot schedule and pricing
- Once the contract launches and admin initializes slots, they seamlessly become rentable (badge flips to "Available" and Rent button enables)

