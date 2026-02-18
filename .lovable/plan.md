
# Add Permanent 50% Discount for `cheesepromoz` in `cheesebannad`

## Overview

The `cheesepromoz` account gets a hardcoded 50% discount on all banner ad slot rentals — both exclusive and shared modes. This is implemented entirely inside the smart contract so it cannot be bypassed at the frontend level.

## How Pricing Currently Works

In `on_wax_transfer`, the required payment is calculated as:

```cpp
double multiplier = (mode == 's' || mode == 'j') ? (1.0 - SHARED_DISCOUNT) : 1.0;
int64_t required = static_cast<int64_t>(price_per_day.amount * multiplier) * num_days;
```

The fix adds one extra step: if `from == "cheesepromoz"_n`, apply an additional 50% reduction to the `multiplier` before computing `required`.

## Files to Change

### 1. `contracts/cheesebannad/cheesebannad.hpp`

Add a new constant near the other discount constants:

```cpp
// After SHARED_DISCOUNT line (~line 55):
static constexpr name   PROMOZ_ACCOUNT      = "cheesepromoz"_n;
static constexpr double PROMOZ_DISCOUNT     = 0.50;   // 50% off for cheesepromoz
```

### 2. `contracts/cheesebannad/cheesebannad.cpp`

In `on_wax_transfer`, after the existing multiplier calculation (around line 245), apply the promoz discount:

```cpp
// Existing shared discount
double multiplier = (mode == 's' || mode == 'j') ? (1.0 - SHARED_DISCOUNT) : 1.0;

// NEW: Permanent 50% discount for cheesepromoz (applies on top of any shared discount)
if (from == PROMOZ_ACCOUNT) {
    multiplier *= (1.0 - PROMOZ_DISCOUNT);
}

int64_t required = static_cast<int64_t>(
    static_cast<double>(price_per_day.amount) * multiplier
) * static_cast<int64_t>(num_days);
```

## Resulting Price Matrix

| Account | Mode | Final Multiplier | Example (100 WAX/day) |
|---|---|---|---|
| Anyone | Exclusive | 1.00× | 100 WAX/day |
| Anyone | Shared | 0.70× | 70 WAX/day |
| cheesepromoz | Exclusive | 0.50× | 50 WAX/day |
| cheesepromoz | Shared | 0.35× | 35 WAX/day |

The promoz discount stacks multiplicatively with the shared discount (50% of 70% = 35%), which is the most logical and fair approach.

## Frontend Update

### `src/components/bannerads/RentSlotDialog.tsx`

The dialog currently calculates the preview price client-side. Add a promoz discount check using the connected wallet session:

```tsx
const PROMOZ_DISCOUNT = 0.50;
const SHARED_DISCOUNT = 0.30;

const isPromoz = session?.actor?.toString() === "cheesepromoz";
const sharedMultiplier = rentalMode === "shared" ? (1 - SHARED_DISCOUNT) : 1;
const promozMultiplier = isPromoz ? (1 - PROMOZ_DISCOUNT) : 1;
const priceMultiplier = sharedMultiplier * promozMultiplier;
const totalWax = waxPricePerDay * numDays * priceMultiplier;
```

A small badge is shown in the price summary when the connected account is `cheesepromoz`:

```tsx
{isPromoz && (
  <p className="text-xs text-green-500 font-medium">🧀 Promoz 50% discount applied</p>
)}
```

## What Does NOT Change

- No new table or admin action is required — the discount is a compile-time constant.
- All other users are completely unaffected.
- Overpayment refund logic already handles the case correctly — if `cheesepromoz` pays more than the discounted required amount, the excess is refunded as normal.
- The existing shared discount logic is untouched; the promoz discount is a clean multiplicative layer on top.

## Files Summary

| File | Change |
|---|---|
| `contracts/cheesebannad/cheesebannad.hpp` | Add `PROMOZ_ACCOUNT` and `PROMOZ_DISCOUNT` constants |
| `contracts/cheesebannad/cheesebannad.cpp` | Apply promoz multiplier in `on_wax_transfer` after shared discount |
| `src/components/bannerads/RentSlotDialog.tsx` | Show discounted price and badge when `cheesepromoz` is connected |
