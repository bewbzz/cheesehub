
# Fix: Null Timer Using Wrong voters Table Field

## The Bug

In `src/hooks/useCheeseNullData.ts`, line 58:

```ts
// WRONG — resets whenever WAX is staked or vote weight changes
const lastClaimTime = voterQuery.data?.unpaid_voteshare_last_updated ?? null;
```

`unpaid_voteshare_last_updated` is updated by the EOSIO system any time the account's stake weight changes — including when WAX is staked to `cheeseburner`. This is why staking WAX was resetting the visible cooldown timer.

The correct field is `last_claim_time`, which the EOSIO system only updates when an actual `claimgbmvote` action is executed — i.e., when the NULL button is pressed and vote rewards are claimed.

The `VoterData` interface in `src/lib/cheeseNullApi.ts` already has `last_claim_time: string` defined (line 18) — it just isn't being used.

## The Fix

### `src/hooks/useCheeseNullData.ts` — line 58

```ts
// BEFORE
const lastClaimTime = voterQuery.data?.unpaid_voteshare_last_updated ?? null;

// AFTER
const lastClaimTime = voterQuery.data?.last_claim_time ?? null;
```

That single character-level change is the entire fix. Everything else — `getTimeUntilNextClaim`, `canClaim`, the countdown display in `NullStats` — already works correctly, it was just being fed the wrong timestamp.

## Why This Works

| Field | Updated by |
|---|---|
| `unpaid_voteshare_last_updated` | EOSIO system — on ANY stake change, vote weight update, or WAX staking |
| `last_claim_time` | EOSIO `claimgbmvote` action only — triggered by the NULL button |

Using `last_claim_time` means the 24-hour cooldown only resets when the NULL action is actually executed. Staking WAX, changing vote weight, or any other action has zero effect on the timer.

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useCheeseNullData.ts` | Line 58: change `unpaid_voteshare_last_updated` to `last_claim_time` |

One line change. No other files need to be touched.
