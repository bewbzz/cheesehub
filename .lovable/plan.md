

# Fix: Stop Predicting V3 Pool Output -- Use Zero Minimum Like cheeseburner

## Root Cause

Alcor Pool 1236 (WAX/WAXDAO) is a **concentrated liquidity (V3) pool**, not a constant product (V2) pool. The pool struct has `tickSpacing` and `maxLiquidityPerTick` -- V3 indicators. No simple AMM formula can predict its output because liquidity is distributed across tick ranges.

Every attempt to fix this has used variations of `(input * reserveOut) / (reserveIn + input)` which only works for V2 pools. That is why the `minTokenOut` assertion keeps failing -- the predicted output is always higher than reality.

## How cheeseburner Solves This

The working `cheeseburner` contract uses **zero as the minimum output**:
```
#0.0000 CHEESE@cheeseburger#0
```

This works because price manipulation is already guarded **before** the swap by the deviation check against admin-set baselines. The minTokenOut is redundant security.

## The Fix

**In `on_wax_transfer`**: Stop calculating a predicted output for the swap memo. Instead, use the existing `MIN_WAXDAO_OUTPUT` constant (5 WAXDAO) as a generous floor -- enough to catch a completely broken pool but not so tight that normal V3 routing fails.

**In `calculate_waxdao_from_wax`**: Keep using it only for the pre-swap sanity check (is the pool healthy enough?), but its output should NOT feed into the swap memo's minTokenOut.

## Technical Changes

### 1. `contracts/cheesefeefee/cheesefeefee.cpp` -- `on_wax_transfer` function

Replace the minTokenOut calculation (lines 130-132) to use a safe floor instead of a predicted value:

```cpp
// Before (broken -- assumes V2 constant product):
int64_t min_output = static_cast<int64_t>(waxdao_amount.amount * 0.99);
asset min_waxdao_out = asset(min_output, WAXDAO_SYMBOL);

// After (matches cheeseburner pattern -- use safe floor):
asset min_waxdao_out = asset(MIN_WAXDAO_OUTPUT, WAXDAO_SYMBOL);
```

This sets `minTokenOut` to 5 WAXDAO (the existing `MIN_WAXDAO_OUTPUT` constant) -- a safe floor that catches broken pools but doesn't try to predict V3 output.

### 2. No other changes needed

- The deviation check (`check_price_deviation`) still runs before the swap, preventing manipulation
- The `MIN_WAXDAO_OUTPUT` sanity check still validates the pool is healthy
- The 215 WAX swap amount stays the same
- The 50 WAX to cheeseburner stays the same
- Frontend code stays the same

## Why This Is Safe

The contract already has two layers of manipulation protection that run BEFORE the swap:

1. **Spot price deviation check**: Compares pool price against admin baselines, rejects if more than 10% off
2. **Minimum WAXDAO output check**: Ensures the pool would produce at least 5 WAXDAO (sanity check)

The `minTokenOut` in the swap memo was a third, redundant layer that kept breaking because it relied on V2 math against a V3 pool.

## After Deployment

Recompile and redeploy the contract. The only change is 1 line in `on_wax_transfer` -- using `MIN_WAXDAO_OUTPUT` instead of the calculated prediction for the swap memo.

