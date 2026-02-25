

# Open Up CHEESEAds Frontend and Add Shared Pricing

## Current State

- Non-on-chain slots show a **disabled** "Rent" button with "Contract not yet initialized" tooltip (lines 195-210)
- The pricing bar only shows the base WAX price with no mention of the shared discount
- Rent/Join buttons only appear for on-chain slots

## Changes

### 1. Enable Rent button for all slots (`SlotCalendar.tsx`)

Remove the disabled/tooltip block for non-on-chain slots (lines 195-210) and replace it with an active "Rent" button that opens the `RentSlotDialog` -- same as the on-chain path. This makes all 30 days of slots immediately rentable once the contract is deployed.

Also update the availability check on lines 177-185 to include non-on-chain slots:

```
Before:  slot.isOnChain && slot.isAvailable && slot.rentalType === "exclusive"
After:   (slot.isAvailable || !slot.isOnChain) && slot.rentalType !== "shared"
```

### 2. Add shared pricing to the pricing bar (`SlotCalendar.tsx`)

Update the pricing display (line 133-135) to show both tiers:

```
Exclusive: 100 WAX/day | Shared: 70 WAX/day (30% off, 50% display time)
```

Calculated dynamically from `pricing.waxPerDay` and the 30% shared discount.

### 3. Remove "Not Live" badge for placeholder slots

Change the `SlotBadge` so non-on-chain slots show "Available" instead of "Not Live" -- since we're opening everything up.

### Files Modified

| File | Change |
|------|--------|
| `src/components/bannerads/SlotCalendar.tsx` | Enable rent for all slots, add shared pricing display, update badge |

