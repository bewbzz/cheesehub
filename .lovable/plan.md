

## Remove CHEESE Payment Option from Banner Ads

### Overview
Remove the CHEESE payment method from both the smart contract and the frontend UI, leaving WAX as the only accepted payment. The contract will still distribute received WAX through the ecosystem (once the fund distribution update is implemented separately).

### Contract Changes

**`contracts/cheesebannad/cheesebannad.hpp`**
- Remove the `on_cheese_transfer` notification handler
- Remove the `get_cheese_wax_price()` and `check_price_deviation()` private methods
- Remove the `distribute_cheese()` private method
- Remove the `alcor_pool` struct (no longer needed for price lookups)
- Remove `wax_per_cheese_baseline` from the `config` table
- Remove constants: `CHEESE_CONTRACT`, `CHEESE_SYMBOL`, `NULL_ACCOUNT`, `LIQUIDITY_STAKING`, `BURN_PERCENT`, `DEFAULT_WAX_PER_CHEESE`
- Update `setconfig` action to only take `wax_price_per_day` (no baseline)
- Keep `ALCOR_CONTRACT` and `CHEESE_WAX_POOL_ID` if the WAX fund distribution (swap to CHEESE) will be added later; otherwise remove

**`contracts/cheesebannad/cheesebannad.cpp`**
- Remove the entire `on_cheese_transfer` function
- Remove `get_cheese_wax_price()`, `check_price_deviation()`, and `distribute_cheese()` functions
- Simplify `setconfig` to only accept `wax_price_per_day`
- Update `get_config()` to return only the WAX price (no baseline)

### Frontend Changes

**`src/components/bannerads/RentSlotDialog.tsx`**
- Remove the `payMethod` state and the "Payment Method" radio group entirely
- Remove the CHEESE payment branch from `handleRent` (always use WAX via `eosio.token`)
- Simplify: the dialog shows days input, rental type selector, total WAX price, and a "Rent Slot" button

### Technical Details

The `setconfig` action signature changes from:
```text
setconfig(asset wax_price_per_day, double wax_per_cheese_baseline)
```
to:
```text
setconfig(asset wax_price_per_day)
```

Note: The Alcor-related structs and constants for the WAX fund distribution feature (20% to cheeseburner, 80% swapped to CHEESE) should be added back when that feature is implemented as a separate step.

