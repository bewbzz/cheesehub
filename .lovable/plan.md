

# Fix: Claim Rewards "Overdrawn Balance" Error

## Problem
The claim transaction at line 969 of `NFTStaking.tsx` is:
```
await session.transact({ actions: [action] });
```

This is **missing the `transactPlugins` parameter** that every other transaction in the app includes. Without it, the Greymass Fuel resource provider is not attached to the transaction. This can cause the transaction to fail with misleading contract errors like "overdrawn balance" because the transaction is malformed or resource-starved.

The reward pool balance display (0.56 CHEESE/WAX) is correct -- it shows the raw `total_funds` from the contract. The reward calculation logic is also correct. The issue is purely in how the claim transaction is submitted.

## Fix

### File: `src/components/farm/NFTStaking.tsx`

**1. Add missing import** for `getTransactPlugins` and `closeWharfkitModals` (if not already imported).

**2. Fix the claim transaction call** (~line 969):
Change:
```
const result = await session.transact({ actions: [action] });
```
To:
```
const result = await session.transact(
  { actions: [action] },
  { transactPlugins: getTransactPlugins(session) }
);
```

**3. Add `closeWharfkitModals()` cleanup** in the `finally` block of `handleClaim` (~line 991) for consistency with all other transaction handlers:
```
finally {
  setIsClaiming(false);
  closeWharfkitModals();
}
```

**4. Improve "overdrawn balance" error detection** in the catch block (~line 983-989):
If the error message contains "overdrawn", show a more specific message explaining that the reward pool may not have enough tokens and to contact the farm owner.

## Why This Should Fix It
- The `transactPlugins` includes the `TransactPluginResourceProvider` (Greymass Fuel) which sponsors CPU/NET resources
- Without it, the raw transaction may fail or behave unexpectedly
- Every other transaction in the codebase (staking, unstaking, deposits, withdrawals, DAO actions) includes this parameter -- the claim handler is the only one missing it

