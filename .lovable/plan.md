

# Bundle Claim with Unstake to Prevent Lost Rewards

## Problem
When unstaking NFTs, the contract resets/removes the user's staking record. Any unclaimed pending rewards are lost because the frontend only sends the `unstake` action without first claiming. The WaxDAO contract does not auto-claim on unstake.

## Solution
Bundle a `claim` action before the `unstake` action in the same transaction. This ensures rewards are collected atomically -- if either action fails, the whole transaction rolls back safely.

## Technical Changes

### `src/components/farm/NFTStaking.tsx` -- `handleUnstake` function (~line 917-958)

1. **Add a `claim` action before the `unstake` action** in the transaction:
   - Build claim action via `buildClaimRewardsAction(user, farmName)`
   - Build unstake action via `buildUnstakeNftsAction(user, farmName, assetIds)`
   - Send both as `actions: [claimAction, unstakeAction]`

2. **Add `transactPlugins: getTransactPlugins(session)`** to the transact call (currently missing -- needed for Greymass Fuel sponsorship)

3. **Update the success toast** to mention rewards were also claimed

Updated logic:
```typescript
const handleUnstake = async () => {
  if (!session || selectedToUnstake.size === 0) return;
  setIsUnstaking(true);
  try {
    const assetIds = Array.from(selectedToUnstake);
    const claimAction = buildClaimRewardsAction(
      session.actor.toString(),
      farm.farm_name
    );
    const unstakeAction = buildUnstakeNftsAction(
      session.actor.toString(),
      farm.farm_name,
      assetIds
    );
    
    await session.transact(
      { actions: [claimAction, unstakeAction] },
      { transactPlugins: getTransactPlugins(session) }
    );
    
    toast({
      title: "NFTs Unstaked!",
      description: `Claimed rewards and unstaked ${assetIds.length} NFT(s) from ${farm.farm_name}`,
    });
    // ... rest stays the same
  }
};
```

## Impact
- Users will never lose pending rewards when unstaking -- claim happens atomically in the same transaction
- If the claim fails (e.g., empty reward pool), the entire transaction rolls back and the user keeps their staked NFTs
- Greymass Fuel sponsorship is also added to the unstake flow (was missing)

