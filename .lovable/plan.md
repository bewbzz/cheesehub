

# Update cheesebannad WAX Distribution: Add cheesepowerz 10% Split

## Summary

Change the WAX payment distribution from a 20/80 split to a 20/10/70 split, adding a new 10% allocation to `cheesepowerz` for ecosystem financing. The CHEESE distribution (66% burn, 34% liquidity) stays the same.

```
BEFORE:                          AFTER:
WAX -> 20% cheeseburner         WAX -> 20% cheeseburner
    -> 80% Alcor swap                -> 10% cheesepowerz
                                     -> 70% Alcor swap

CHEESE (unchanged):              CHEESE (unchanged):
    -> 66% burn (eosio.null)         -> 66% burn (eosio.null)
    -> 34% xcheeseliqst              -> 34% xcheeseliqst
```

## Changes

### 1. Contract: `contracts/cheesebannad/cheesebannad.hpp`

- Add new constant: `static constexpr name CHEESEPOWERZ = "cheesepowerz"_n;`
- Add new constant: `static constexpr double WAX_POWERZ_PERCENT = 0.10;`
- Update `WAX_BURNER_PERCENT` comment (value stays 0.20)
- Update doc comments referencing the 20/80 split to reflect 20/10/70

### 2. Contract: `contracts/cheesebannad/cheesebannad.cpp`

Update `distribute_wax_funds` to calculate three splits instead of two:

- 20% to `cheeseburner` (unchanged)
- 10% to `cheesepowerz` (new -- raw WAX transfer)
- 70% remainder to Alcor swap (was 80%)

```cpp
void cheesebannad::distribute_wax_funds(asset quantity) {
    int64_t burner_amount = static_cast<int64_t>(quantity.amount * WAX_BURNER_PERCENT);
    int64_t powerz_amount = static_cast<int64_t>(quantity.amount * WAX_POWERZ_PERCENT);
    int64_t swap_amount   = quantity.amount - burner_amount - powerz_amount;

    // 20% WAX to cheeseburner
    if (burner_amount > 0) { /* existing transfer action */ }

    // 10% WAX to cheesepowerz
    if (powerz_amount > 0) {
        action(
            permission_level{get_self(), "active"_n},
            WAX_CONTRACT, "transfer"_n,
            make_tuple(get_self(), CHEESEPOWERZ,
                asset(powerz_amount, WAX_SYMBOL),
                string("CHEESEAds ecosystem financing"))
        ).send();
    }

    // 70% WAX to Alcor swap -> CHEESE
    if (swap_amount > 0) { /* existing swap action */ }
}
```

### 3. Frontend: `src/components/bannerads/RentSlotDialog.tsx`

No pricing changes needed -- the rental cost to users stays the same. Only the backend distribution changes.

## Notes

- The `cheesepowerz` account must exist on WAX mainnet before deploying
- The contract must have `eosio.token::transfer` permission to send to `cheesepowerz`
- User-facing prices, discounts (shared 30%, promoz 50%), and refund logic are all unaffected
- The CHEESE distribution (66% burn / 34% liquidity) is completely unchanged

