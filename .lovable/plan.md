

# Fix: cheesefeefee WAX Payment Swap Slippage

## Problem
The `on_wax_transfer` function in the `cheesefeefee` contract always fails when routing 250 WAX because it sets `minTokenOut` to the exact reserves-based price, which doesn't account for Alcor's swap fee (~0.3%) and price impact. The swap output is always slightly less than the theoretical calculation, causing `Received lower than minTokenOut` every time.

## Root Cause (line 120-133 of `cheesefeefee.cpp`)
1. `calculate_waxdao_from_wax(205.0)` calculates WAXDAO using raw reserves ratio
2. That exact amount is passed as `minTokenOut` in the Alcor swap memo
3. Alcor's AMM deducts fees, so actual output is always less -- swap reverts

## Fix

### Contract Change: `contracts/cheesefeefee/cheesefeefee.cpp`

Add a slippage buffer (2%) to the `minTokenOut` used in the Alcor swap memo. The contract already validates the calculated amount against `MIN_WAXDAO_OUTPUT` (5 WAXDAO) for dust protection, so lowering `minTokenOut` slightly is safe.

**Before (line 126-133):**
```cpp
// 1. Swap 205 WAX for WAXDAO via Alcor Pool 1236 (sent directly to user)
int64_t wax_to_swap = static_cast<int64_t>(WAX_TO_WAXDAO * 100000000.0);
asset wax_swap_quantity = asset(wax_to_swap, WAX_SYMBOL);

string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
    + "#" + from.to_string()
    + "#" + waxdao_amount.to_string() + "@" + WAXDAO_CONTRACT.to_string()
    + "#0";
```

**After:**
```cpp
// 1. Swap 205 WAX for WAXDAO via Alcor Pool 1236 (sent directly to user)
int64_t wax_to_swap = static_cast<int64_t>(WAX_TO_WAXDAO * 100000000.0);
asset wax_swap_quantity = asset(wax_to_swap, WAX_SYMBOL);

// Apply 2% slippage buffer to minTokenOut (reserves price != swap price due to fees)
int64_t min_output = static_cast<int64_t>(waxdao_amount.amount * 0.98);
asset min_waxdao_out = asset(min_output, WAXDAO_SYMBOL);

string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
    + "#" + from.to_string()
    + "#" + min_waxdao_out.to_string() + "@" + WAXDAO_CONTRACT.to_string()
    + "#0";
```

The same fix should also be applied to the CHEESE payment path in `calculate_waxdao_amount` if it ever performs an Alcor swap (currently it doesn't -- it sends from contract balance, so only the WAX path is affected).

### Header Change: `contracts/cheesefeefee/cheesefeefee.hpp`

Add a constant for the slippage tolerance:
```cpp
static constexpr double SWAP_SLIPPAGE_TOLERANCE = 0.02; // 2% for AMM fee + price impact
```

## Deployment Required

This is a **smart contract fix** -- after updating the `.cpp` and `.hpp` files, you will need to:
1. Recompile the contract (`make` in `contracts/cheesefeefee/`)
2. Redeploy to the `cheesefeefee` account on WAX mainnet

No frontend changes are needed.

## Security Note
- The `MIN_WAXDAO_OUTPUT` check (5 WAXDAO minimum) still protects against dust attacks
- The 10% price deviation guard still protects against manipulation
- The 2% slippage buffer only affects the Alcor swap's minimum output, not the amount sent to the user (Alcor sends whatever the swap actually produces)

