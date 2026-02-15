

# Fix: WAX Payment "minTokenOut" Failure in cheesefeefee Contract

## Problem

When using the 265 WAX payment option for farm/DAO creation, the Alcor swap fails with:
```
assertion failure: Received lower than minTokenOut: 527852745872, poolId: 1236
```

The contract calculates WAXDAO output using **spot price** (reserves ratio), then applies a 2% slippage buffer. But swapping 215 WAX through the AMM has significant **price impact** that exceeds 2%, so Alcor rejects the trade.

## Solution

Update the contract's `calculate_waxdao_from_wax()` function to use the **constant product AMM formula** instead of spot price. This gives the actual expected output including price impact, then apply a small slippage buffer on top.

### AMM Formula

For a constant product AMM (`x * y = k`):
```
output = (input * reserveOut) / (reserveIn + input)
```

This naturally accounts for price impact and will always produce a realistic expected output.

## Technical Changes

### 1. Contract: `cheesefeefee.hpp`

Add a new helper function declaration:
```cpp
asset calculate_waxdao_swap_output(double wax_input);
```

### 2. Contract: `cheesefeefee.cpp`

**Replace `calculate_waxdao_from_wax`** to use the AMM formula:

```cpp
asset cheesefeefee::calculate_waxdao_from_wax(double wax_value) {
    alcor_pools_table pools(ALCOR_CONTRACT, ALCOR_CONTRACT.value);
    auto pool_itr = pools.find(WAXDAO_WAX_POOL_ID);
    check(pool_itr != pools.end(), "Alcor pool 1236 not found");
    check(pool_itr->active, "Alcor pool 1236 not active");

    // Get raw reserves
    double reserveA = static_cast<double>(pool_itr->tokenA.quantity.amount); // WAX
    double reserveB = static_cast<double>(pool_itr->tokenB.quantity.amount); // WAXDAO
    uint8_t precA = pool_itr->tokenA.quantity.symbol.precision();
    uint8_t precB = pool_itr->tokenB.quantity.symbol.precision();

    // Normalize
    double normA = reserveA / pow(10.0, precA);
    double normB = reserveB / pow(10.0, precB);

    // Spot price check (deviation guard still applies)
    double waxdao_per_wax = normB / normA;
    check(waxdao_per_wax > 0, "Invalid WAXDAO/WAX price");
    auto [baseline_cheese, baseline_waxdao] = get_baselines();
    check_price_deviation(waxdao_per_wax, baseline_waxdao, "WAXDAO/WAX price");

    // AMM constant product formula: output = (input * reserveOut) / (reserveIn + input)
    double amm_output = (wax_value * normB) / (normA + wax_value);

    int64_t waxdao_units = static_cast<int64_t>(amm_output * 100000000.0);
    check(waxdao_units > 0, "Calculated WAXDAO amount too small");

    return asset(waxdao_units, WAXDAO_SYMBOL);
}
```

**Update `on_wax_transfer`** -- the `minTokenOut` slippage line:

Change the slippage buffer from 2% to a smaller value (e.g., 1%) since the AMM formula already accounts for price impact:

```cpp
// Line 131: AMM formula already includes impact, just buffer for block timing
int64_t min_output = static_cast<int64_t>(waxdao_amount.amount * 0.99);
```

### 3. Frontend: No changes needed

The frontend (`cheeseFees.ts`, `CreateFarm.tsx`, `CreateDao.tsx`) sends 265 WAX to the contract -- no frontend changes are required. The fix is entirely in the smart contract logic.

## Summary

| What | Before | After |
|------|--------|-------|
| Price calculation | Spot price (reserves ratio) | AMM formula with price impact |
| Slippage buffer | 2% on top of spot price | 1% on top of AMM output |
| Swap success | Fails for large trades | Matches real AMM output |

After updating the contract code, recompile and redeploy `cheesefeefee` to WAX mainnet.

