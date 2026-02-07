

# Fix: Display Shows Wrong Pool Balance (0.56 vs Actual 0.18)

## What's Actually Happening

The pre-claim check is **working correctly**. The console logs confirm:

```
[RPC] CHEESE@cheeseburger response: ["0.1800 CHEESE"]
```

The `farms.waxdao` contract only holds **0.18 CHEESE** on-chain. Your claimable is ~0.27, which exceeds 0.18, so the claim would indeed fail with "overdrawn balance." The pre-claim check is catching this and showing the toast instead of letting the transaction fail.

The real problem is the **misleading display**: the "On-chain: 0.56 CHEESE" shown at the top comes from `pool.balance` in the contract's reward pool table, which represents **total funds ever deposited**, not the actual tokens currently held. Some rewards have already been paid out, leaving only 0.18 CHEESE.

## What Needs to Change

### 1. `src/components/farm/NFTStaking.tsx` -- Cap claimable at real on-chain balance

The `calculateLiveRewards` cap currently uses `pool.balance` (0.56), which is wrong. We need to periodically fetch the real contract balances and use those for capping.

- Add a state variable `contractBalances` (a map of symbol to real balance)
- Fetch real balances via `fetchFarmContractBalance` when farm data loads and on an interval
- Use those balances in `calculateLiveRewards` instead of `pool.balance`

### 2. `src/components/farm/FarmDetail.tsx` -- Show accurate pool balance

Update the "On-chain" display in the reward pools section to fetch and show the **actual** token balance held by the farm contract, not just `pool.balance` (total deposited).

- Add a query to fetch real contract balances for each reward pool token
- Display both: "Deposited: 0.56" and "Available: 0.18" (or just the available amount)

### 3. Toast message improvement

The toast currently says "The farm only has 0.1800 CHEESE on-chain but you need 0.2700" -- this is accurate! But the user was confused because the UI showed 0.56. Once the display is fixed to show 0.18, it will be consistent and make sense.

## Summary

The pre-claim check is doing its job -- the pool genuinely doesn't have enough CHEESE. The fix is to make the **display** show the real on-chain balance (0.18) instead of total deposited (0.56), so users understand the pool needs more deposits before they can claim.

