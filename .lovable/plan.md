

# Fix: Query Actual On-Chain Contract Balance Before Claiming

## Root Cause

The "overdrawn balance" error comes from the **on-chain contract itself**, not from our frontend code. When you click "Claim," the contract calculates your rewards independently and tries to transfer tokens from its account. If the contract account doesn't have enough tokens, the blockchain rejects the transfer.

The previous fix (capping displayed rewards at `matchingPool.balance`) doesn't help because:
1. `matchingPool.balance` comes from `total_funds` in the contract table -- this is the **total ever deposited**, not the current available balance
2. Even if the display is capped correctly, `handleClaim` sends a generic `claim` action and the contract decides the payout amount -- our UI has no control over what the contract tries to pay

## Solution

Before sending the claim transaction, query the **actual on-chain token balance** of the farm contract account for each reward token. If the balance is too low, block the claim and show a warning.

### Changes

#### 1. `src/components/farm/NFTStaking.tsx` -- Add pre-claim balance check in `handleClaim`

Before calling `session.transact`, fetch the real token balance of the farm contract account (e.g., `waxdaofarmer` or whatever `FARM_CONTRACT` is) for each reward token using the `/v1/chain/get_currency_balance` RPC endpoint. Compare against the user's expected claimable amounts. If any token balance is insufficient, abort the claim and show a descriptive error toast.

#### 2. `src/components/farm/NFTStaking.tsx` -- Fix display cap to use real balance too

Update `calculateLiveRewards` to also use the fetched on-chain contract balance (or at minimum, use `calculateEffectiveBalance` as a better estimate than `total_funds`). Since we can't easily do an async fetch inside the synchronous calculation, we'll store the fetched contract balances in state and use them for capping.

#### 3. `src/lib/farm.ts` -- Add helper to fetch farm contract token balance

Add a utility function `fetchFarmContractBalance(tokenContract, tokenSymbol)` that queries the real on-chain balance of the farm contract account for a specific token. This will be reused in both the pre-claim check and the display cap.

### Implementation Details

**New helper in `src/lib/farm.ts`:**
```typescript
export async function fetchFarmContractBalance(
  tokenContract: string,
  tokenSymbol: string
): Promise<number> {
  // Query /v1/chain/get_currency_balance for FARM_CONTRACT
  // Returns the actual tokens held by the farm contract
}
```

**Pre-claim check in `handleClaim`:**
```typescript
// Before transacting, verify the contract has enough tokens
for (const reward of claimableSnapshot) {
  const contractBalance = await fetchFarmContractBalance(
    reward.contract, reward.symbol
  );
  if (reward.amount > contractBalance) {
    toast({ title: "Pool Insufficient", description: "..." });
    return; // Don't attempt the claim
  }
}
```

**Periodic balance fetch for display capping:**
- Fetch contract balances alongside farm data refresh
- Store in component state
- Use in `calculateLiveRewards` for accurate capping

This approach catches the problem **before** sending the transaction, giving the user a clear message instead of a cryptic contract error.
