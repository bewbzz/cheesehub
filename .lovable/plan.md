

# Fix "Overdrawn Balance" Error on Reward Claims

## Problem
The live reward calculator in `NFTStaking.tsx` computes claimable rewards purely from math: `baseAmount + (ratePerHour * completedHours)`. It never checks if the farm's reward pool actually has enough tokens to cover that amount. When a pool is running low, the UI shows inflated claimable amounts that the on-chain contract cannot fulfill, resulting in an "overdrawn balance" error when you try to claim.

## Solution
Cap the displayed claimable rewards at the farm's actual available (effective) reward pool balance per token. This way, the UI will never show more than what the contract can actually pay out, and claims will succeed.

## Changes

### 1. `src/components/farm/NFTStaking.tsx` -- Cap claimable rewards at pool balance

In the `calculateLiveRewards` function (around line 404), after computing the raw claimable amount per token, look up the matching reward pool from `farm.reward_pools` and cap the amount at the pool's effective balance (using the existing `calculateEffectiveBalance` utility).

**Before (line ~434):**
```
const claimableAmount = baseAmount + (rateAmount * claimableHours);
```

**After:**
```
let claimableAmount = baseAmount + (rateAmount * claimableHours);

// Cap at the pool's effective balance to prevent overdrawn balance errors
const matchingPool = farm.reward_pools.find(p => p.symbol === symbol);
if (matchingPool) {
  const { effectiveBalance } = calculateEffectiveBalance(matchingPool, farm.last_payout, now);
  claimableAmount = Math.min(claimableAmount, Math.max(0, effectiveBalance));
}
```

### 2. `src/components/farm/NFTStaking.tsx` -- Add import

Add `calculateEffectiveBalance` to the existing imports from `@/lib/farm`.

### 3. `src/components/farm/NFTStaking.tsx` -- Add pool-low warning

When the claimable amount is being capped (i.e., pool balance is less than the calculated reward), show a subtle warning near the "Claimable Now" section indicating the reward pool is running low. This gives users transparency about why their displayed rewards might be lower than expected.

## Technical Notes

- The cap uses `calculateEffectiveBalance` (already in `src/lib/farm.ts`) which accounts for rewards accrued by ALL stakers, not just the current user -- this gives a conservative but safe estimate
- The effective balance is itself an estimate (it can't know exactly what other stakers have accrued), so this is a best-effort cap that should prevent most overdrawn errors
- The cap only affects the UI display -- the actual claim transaction still sends the contract's `claim` action which pays whatever the contract determines is owed

