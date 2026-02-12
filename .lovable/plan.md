

# Fix WAX Fallback: Buy WAXDAO via Alcor Swap

## Problem
The current `on_wax_transfer` handler tries to send WAXDAO from the contract's own balance (line 127-133). But the WAX fallback exists precisely because the contract has no WAXDAO. It needs to **buy** WAXDAO from Alcor instead.

## Solution
Replace the direct WAXDAO transfer with an Alcor swap, following the proven pattern from the `cheeseburner` contract.

## What Changes

### Contract: `contracts/cheesefeefee/cheesefeefee.cpp`

In the `on_wax_transfer` handler (lines 126-133), replace the manual WAXDAO transfer with an Alcor `swapexactin` call:

- Send 205 WAX to `swap.alcor` with memo: `swapexactin#1236#<user>#<min_output> WAXDAO@token.waxdao#0`
- Alcor executes the swap and sends the purchased WAXDAO directly to the user (specified as recipient in the memo)
- The calculated `waxdao_amount` (already computed on line 120) is used as the minimum output for slippage protection
- The 45 WAX to cheeseburner remains unchanged

### No other file changes needed
- The `.hpp` file already has `ALCOR_CONTRACT`, `WAX_CONTRACT`, `WAXDAO_WAX_POOL_ID` defined
- The frontend code (`CreateFarm.tsx`, `CreateDao.tsx`, `cheeseFees.ts`) is already wired correctly from the previous implementation
- `calculate_waxdao_from_wax` stays as-is since it's still needed for the minimum output calculation

## Updated Flow

```text
[250 WAX from user] --> cheesefeefee
                         |-- [205 WAX] --> swap.alcor (Pool 1236)
                         |                  |-- [WAXDAO] --> user (via memo recipient)
                         |-- [45 WAX] --> cheeseburner
```

## Technical Detail

The single line change replaces:
```cpp
// OLD: Transfer WAXDAO we don't have
action(..., WAXDAO_CONTRACT, "transfer"_n,
    make_tuple(get_self(), from, waxdao_amount, ...)).send();
```
With:
```cpp
// NEW: Buy WAXDAO from Alcor, sent directly to user
int64_t wax_to_swap = static_cast<int64_t>(WAX_TO_WAXDAO * 100000000.0);
asset wax_swap_quantity = asset(wax_to_swap, WAX_SYMBOL);

string alcor_memo = string("swapexactin#") + to_string(WAXDAO_WAX_POOL_ID)
    + "#" + from.to_string()
    + "#" + waxdao_amount.to_string()
    + "#0";

action(permission_level{get_self(), "active"_n},
    WAX_CONTRACT, "transfer"_n,
    make_tuple(get_self(), ALCOR_CONTRACT, wax_swap_quantity, alcor_memo)
).send();
```

This follows the exact same Alcor interaction pattern used in `cheeseburner`.

