

# Fix: CHEESENull Cooldown Timer Using Wrong Field

## Problem

The CHEESENull UI tracks the 24-hour claim cooldown using `unpaid_voteshare_last_updated` from the voters table. This field updates whenever vote weight changes, including when WAX is staked (`delegatebw`). So staking WAX to `cheeseburner` makes the UI think a claim just happened, resetting the countdown and disabling the NULL button -- even though the actual claim cooldown (tracked by `last_claim_time`) has not reset.

## Fix

Switch the cooldown timer to use `last_claim_time` instead of `unpaid_voteshare_last_updated`. This field only updates when `claimgbmvote` is executed, which is the actual claim action.

## Technical Changes

### 1. `src/hooks/useCheeseNullData.ts`

Change line 58 from:
```
const lastClaimTime = voterQuery.data?.unpaid_voteshare_last_updated ?? null;
```
to:
```
const lastClaimTime = voterQuery.data?.last_claim_time ?? null;
```

### 2. No other changes needed

- The `VoterData` interface in `cheeseNullApi.ts` already includes the `last_claim_time` field (line 18)
- The `canClaim()` and `getTimeUntilNextClaim()` functions work with any timestamp string
- The `NullStats` and `NullButton` components receive the correct `canClaim` boolean from the hook

## Why This Works

| Field | Updated by | Purpose |
|-------|-----------|---------|
| `unpaid_voteshare_last_updated` | `delegatebw`, `voteproducer`, `claimgbmvote` | Voteshare accounting |
| `last_claim_time` | `claimgbmvote` only | Claim cooldown tracking |

The `cheeseburner` contract's `burn` action calls `claimgbmvote`, which updates `last_claim_time`. Staking WAX does not touch this field, so the countdown will no longer reset incorrectly.

