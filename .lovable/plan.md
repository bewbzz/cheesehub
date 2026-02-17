

# Fix Claim Cooldown Timer in Both CheeseNull and Wallet Vote Rewards

## Problem

Both the CheeseNull page and the Wallet's Vote Rewards section use `unpaid_voteshare_last_updated` to track the 24-hour claim cooldown. This field updates when WAX is staked or votes change, incorrectly resetting the timer. The correct field is `last_claim_time`, which only updates on actual reward claims.

## Changes

### 1. `src/hooks/useCheeseNullData.ts` (already done)

Switch `lastClaimTime` from `unpaid_voteshare_last_updated` to `last_claim_time`.

### 2. `src/components/wallet/VoteRewardsManager.tsx`

This component has the same bug but fetches voter data independently (not using the shared hook). Two changes needed:

- **Add `last_claim_time` to the `VoterInfo` interface** -- it's currently missing from the local type definition.
- **Use `last_claim_time` instead of `unpaid_voteshare_last_updated`** for calculating `lastClaimTime`, `nextClaimTime`, and `canClaim` state. The relevant section is around lines 109-133 where `lastUpdatedTime` is derived from `voter.unpaid_voteshare_last_updated`.

The reward estimation logic (`calculateRewards`) still correctly uses `unpaid_voteshare_last_updated` for voteshare accounting -- that stays unchanged.

