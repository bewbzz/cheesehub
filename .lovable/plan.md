

# Revert Burn/Stake Split to 66/34

## What Changed by Mistake

The previous edit accidentally changed the burn/stake ratio from 66/34 to 80/20. This plan reverts only those changes while keeping the correct Pool 1236 comment fixes.

## Changes

### File: `contracts/cheesefeefee/cheesefeefee.hpp`
- Revert `BURN_PERCENT` from `0.80` back to `0.66`
- Revert comment from "80% burn, 20% liquidity staking" back to "66% burn, 34% liquidity staking"

### File: `contracts/cheesefeefee/cheesefeefee.cpp`
- Revert 3 comments referencing the split percentages:
  - "80% burn, 20% liquidity staking" -> "66% burn, 34% liquidity staking"
  - "Burn 80% to eosio.null" -> "Burn 66% to eosio.null"
  - "Send 20% to liquidity staking" -> "Send 34% to liquidity staking"

All Pool 1236 comment fixes remain untouched.

