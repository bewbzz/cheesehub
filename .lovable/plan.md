

## Implement WAX Payment Split in cheesebannad Contract

### Overview
When users pay WAX for banner ad rentals, the contract will split received funds through the CHEESE ecosystem. All operations happen as inline actions within the same transaction -- if any step fails (including the Alcor swap), the **entire transaction reverts atomically** and the user loses nothing.

- **20% WAX** -- sent to `cheeseburner` account (ecosystem financing, NOT a direct burn)
- **80% WAX** -- swapped to CHEESE via Alcor Pool 1252
- **Swapped CHEESE** -- 66% sent to `eosio.null` (burn), 34% sent to `xcheeseliqst` (liquidity staking)

### Atomicity Guarantee
EOSIO inline actions execute within the same transaction context. If the Alcor swap fails (pool inactive, insufficient liquidity, etc.), the entire transaction reverts -- including slot assignment, the 20% transfer to cheeseburner, and the user's original WAX transfer. The user's WAX is never at risk.

### Fund Flow

```text
User sends WAX for banner slot
         |
on_wax_transfer: validate payment, assign slots
         |
distribute_wax_funds() (all inline, same transaction):
  |-- 20% WAX --> cheeseburner (ecosystem financing)
  |-- 80% WAX --> swap.alcor Pool 1252
  |                  memo: "swapexactin#1252#cheesebannad#0.0001 CHEESE#0"
  |                  (CHEESE sent back to contract)
         |
on_cheese_transfer triggered (same transaction):
  |-- from swap.alcor? --> distribute_cheese_funds()
         |
  |-- 66% CHEESE --> eosio.null (burn)
  |-- 34% CHEESE --> xcheeseliqst (liquidity staking)

If ANY step fails --> entire transaction reverts, user keeps WAX
```

### Contract Changes

**`contracts/cheesebannad/cheesebannad.hpp`**

Add constants:
| Constant | Value | Purpose |
|----------|-------|---------|
| `ALCOR_CONTRACT` | `"swap.alcor"_n` | Alcor DEX |
| `CHEESE_WAX_POOL_ID` | `1252` | CHEESE/WAX pool |
| `CHEESE_CONTRACT` | `"cheeseburger"_n` | CHEESE token contract |
| `CHEESE_SYMBOL` | `symbol("CHEESE", 4)` | CHEESE token symbol |
| `NULL_ACCOUNT` | `"eosio.null"_n` | Burn destination |
| `LIQUIDITY_STAKING` | `"xcheeseliqst"_n` | Liquidity staking |
| `CHEESEBURNER` | `"cheeseburner"_n` | Ecosystem financing (20% WAX) |
| `WAX_BURNER_PERCENT` | `0.20` | 20% to cheeseburner |
| `CHEESE_BURN_PERCENT` | `0.66` | 66% CHEESE burn |

Add notification handler:
```text
[[eosio::on_notify("cheeseburger::transfer")]]
void on_cheese_transfer(name from, name to, asset quantity, string memo);
```

Add private methods:
- `void distribute_wax_funds(asset quantity)` -- splits WAX 20/80
- `void distribute_cheese_funds(asset quantity)` -- splits CHEESE 66/34

**`contracts/cheesebannad/cheesebannad.cpp`**

1. **`on_wax_transfer`** -- after `assign_slots()`, call `distribute_wax_funds(quantity)`:
   - Calculate 20% (`quantity.amount * 0.20`), send to `cheeseburner` via inline transfer
   - Calculate 80% (`quantity.amount - burner_amount`), send to `swap.alcor` with memo `swapexactin#1252#cheesebannad#0.0001 CHEESE#0`

2. **`on_cheese_transfer`** (new handler) -- receives CHEESE from Alcor swap result:
   - Guard: ignore outgoing transfers (`from == get_self()`) and non-contract transfers (`to != get_self()`)
   - If `from == ALCOR_CONTRACT`: call `distribute_cheese_funds(quantity)` and return
   - Ignore all other CHEESE transfers

3. **`distribute_cheese_funds`** -- splits incoming CHEESE:
   - 66% to `eosio.null` via inline transfer through `cheeseburger` contract
   - 34% (remainder) to `xcheeseliqst` via inline transfer through `cheeseburger` contract

### Alcor Swap Memo Format
Following the exact pattern from `cheesefeefee`:
```text
swapexactin#1252#cheesebannad#0.0001 CHEESE#0
```
- `1252` = Pool ID (CHEESE/WAX)
- `cheesebannad` = Recipient (contract receives CHEESE back)
- `0.0001 CHEESE` = Minimum output (low threshold, prevents zero-output swaps)
- `0` = No referral

### Files Modified

| File | Changes |
|------|--------|
| `contracts/cheesebannad/cheesebannad.hpp` | Add constants, `on_cheese_transfer` handler, `distribute_wax_funds`, `distribute_cheese_funds` private methods |
| `contracts/cheesebannad/cheesebannad.cpp` | Implement new methods, add `distribute_wax_funds()` call in `on_wax_transfer` after slot assignment |

No frontend changes required.

