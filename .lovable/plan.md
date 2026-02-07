

# Show Effective Reward Pool Balances (Accounting for Accrued Rewards)

## Problem
Currently, reward pool balances shown on the farm detail page and farm cards only reflect the raw on-chain `total_funds` value. This balance only decreases when a staker actually claims their rewards. This is misleading because a significant portion of those funds may already be "spoken for" (accrued by stakers but not yet claimed).

## Solution
Calculate and display an **estimated effective balance** by subtracting accrued (unclaimed) rewards from the raw on-chain balance. Additionally, show a **drain rate** so potential stakers can assess how long the pool will last.

The formula:
```text
effective_balance = total_funds - (total_hourly_reward * hours_since_last_payout)
```

Where `hours_since_last_payout` uses the farm-level `last_state_change` timestamp as a rough proxy for when rewards were last globally updated. This won't be 100% precise (each staker has their own claim timing), but it's far more accurate than the raw balance.

We'll also show:
- **Hourly drain rate** (the `total_hourly_reward` value) per pool
- **Estimated time remaining** = effective_balance / total_hourly_reward

## Changes

### 1. `src/lib/farm.ts` - Add effective balance calculation utility

Add a helper function `calculateEffectiveBalance` that takes a reward pool, the farm's `last_payout` timestamp, and current time, and returns:
- `effectiveBalance`: total_funds minus estimated accrued rewards (floored at 0)
- `hourlyRate`: the total hourly reward rate
- `hoursRemaining`: estimated hours until pool is empty

### 2. `src/lib/farm.ts` - Store `last_payout` properly

Currently `last_payout` comes from `row.last_state_change`. Verify this is being captured correctly in both `fetchAllFarms` and `fetchFarmDetails`. It is -- no change needed here.

### 3. `src/components/farm/FarmDetail.tsx` - Update Reward Pools display

Update the reward pool cards to show:
- **Effective balance** (with accrued rewards subtracted) as the main number
- Raw on-chain balance in smaller text as "On-chain: X"
- Hourly drain rate
- Estimated time remaining (e.g., "~45 days remaining")

Only show drain rate and effective balance when the farm is active (status 1) and has stakers. For inactive/empty farms, show raw balance as-is.

### 4. `src/components/farm/FarmCard.tsx` - Update browse card reward display

Update `formatRewardPool` to also subtract estimated accrued rewards when displaying the balance on browse cards. This requires passing `last_payout` to the formatting function. Show effective balance with a subtle indicator (e.g., "~" prefix) to signal it's an estimate.

### 5. `src/components/farm/FarmDetail.tsx` - Update `formatRewardPool` function

Modify the existing `formatRewardPool` helper at line 197 to accept additional parameters (`lastPayout`, `isActive`, `stakedCount`) and compute the effective balance.

## Technical Notes

- The estimate uses `total_hourly_reward` from the contract, which represents the combined hourly payout rate for ALL currently staked NFTs
- The `last_state_change` on the farm row updates whenever any staker stakes, unstakes, or claims -- so it's a reasonable (though not perfect) reference point
- The effective balance is floored at 0 to avoid showing negative values
- For farms with 0 stakers or inactive farms, the raw balance is shown since no rewards are accruing
- The live reward countdown timer (1-second interval) already exists in NFTStaking.tsx for individual user rewards; the pool-level estimate here only needs to update on data fetch, not in real-time

