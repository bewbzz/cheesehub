
# Revert Unnecessary Price Deviation Guard from cheesebannad

## Why the Guard is Not Needed Here

The price deviation guard in `cheesefeefee` exists because that contract reads the Alcor pool price and sends WAXDAO tokens directly to a user. If the price is manipulated, the contract could be drained or users shortchanged. There is a direct financial risk to token holders.

`cheesebannad` is fundamentally different. The swap output (CHEESE) goes entirely to:
- 66% burned to `eosio.null`
- 34% to `xcheeseliqst` (liquidity staking)

No tokens are ever returned to the user. The slot is assigned before the swap runs. The worst case of a manipulated pool price is that slightly more or less CHEESE gets burned — not a security risk. The guard adds operational overhead (admin must keep baseline current, users get blocked during volatile markets) for zero security benefit.

## What We Do Keep

The **memo format fix** is still valid and important. The current code builds the swap memo as a raw string with a hardcoded `"0.0001 CHEESE@cheeseburger"`. This should use the proper extended asset construction `asset(MIN_CHEESE_OUTPUT, CHEESE_SYMBOL).to_string() + "@" + CHEESE_CONTRACT.to_string()` to ensure correctness and maintainability — consistent with how `cheesefeefee` builds its memos.

## What We Remove / Never Add

- `alcor_pool` struct and `alcor_pools_table` typedef — not needed
- `get_wax_per_cheese()` helper — not needed
- `get_wax_per_cheese_baseline()` helper — not needed
- `check_price_deviation()` helper — not needed
- `MAX_PRICE_DEVIATION` constant — not needed
- `#include <cmath>` — not needed
- The `wax_per_cheese_baseline` field in the config table can be removed entirely, or left harmlessly unused (leaving it avoids a schema change if already deployed)

## Files to Modify

| File | Change |
|---|---|
| `contracts/cheesebannad/cheesebannad.hpp` | Remove `alcor_pool` struct, `MAX_PRICE_DEVIATION` constant, and the three helper declarations. Keep `MIN_CHEESE_OUTPUT`. Keep `wax_per_cheese_baseline` in the config struct (avoid unnecessary schema change). |
| `contracts/cheesebannad/cheesebannad.cpp` | Remove `#include <cmath>`. Remove `get_wax_per_cheese()`, `get_wax_per_cheese_baseline()`, `check_price_deviation()` implementations. In `distribute_wax_funds()`, remove the deviation check call. Fix the swap memo to use the proper extended asset string construction. |
| `contracts/cheesebannad/README.md` | Update WAX payment flow to remove references to price deviation guard. Note that the memo uses extended asset format. |

## The Only Real Change: Swap Memo Fix

```cpp
// Before (fragile raw string):
string swap_memo = "swapexactin#" + to_string(CHEESE_WAX_POOL_ID) +
    "#" + get_self().to_string() + "#0.0001 CHEESE@" + CHEESE_CONTRACT.to_string() + "#0";

// After (proper extended asset construction, consistent with cheesefeefee):
asset min_cheese_out = asset(MIN_CHEESE_OUTPUT, CHEESE_SYMBOL);
string swap_memo = string("swapexactin#") + to_string(CHEESE_WAX_POOL_ID)
    + "#" + get_self().to_string()
    + "#" + min_cheese_out.to_string() + "@" + CHEESE_CONTRACT.to_string()
    + "#0";
```

This is a small but meaningful correctness fix — the asset `to_string()` method ensures the amount and symbol are always formatted correctly without relying on a hardcoded string that could get out of sync.
