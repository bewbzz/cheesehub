
# Why kickmany is Failing / Not Removing liquidcheese

## Investigation Summary

From the on-chain history, real `kickmany` transactions have this structure:
```json
{
  "user": "fragglerockk",
  "quantity_of_users": "1",
  "farmname": "testfarm3"
}
```

Our `buildKickManyAction` sends exactly these parameters — `user`, `quantity_of_users`, `farmname` — so the action structure is correct.

## What is Actually Happening

The session replay showed the "Farm data refreshed!" toast (from the manual Refresh button), NOT the "Users Kicked" success toast. This means one of two things happened when the Kick Users button was pressed:

1. **The transaction was rejected by the contract** (farm not in a kickable state) — the error toast appeared but was missed, OR
2. **The transaction succeeded but the UI shows stale data** and liquidcheese remains because the staked_count hasn't decremented yet.

## Most Likely Root Cause — Wrong Farm Status for kickmany

The WaxDAO `farms.waxdao` contract's `kickmany` action is designed to work after `closefarm` is called. But looking at the contract mechanics more carefully:

- `closefarm` requires the farm to have `status = 1` (Active) and be expired
- After `closefarm`, the farm becomes `status = 0` again

The contract likely allows `kickmany` when:
- Farm status is 0 BUT was previously active (i.e., `expiration > 1`)
- OR farm status is 2 (permanently closed)

**The real issue:** The farm `testtestfarm` may currently be in `status = 1` (still Active), not `status = 0`. The "Under Construction" display we just fixed might mean the UI now shows the WRONG state because:
- If the farm is expired but still `status = 1`, `isExpired` is true
- If the farm is `status = 0`, `isUnderConstruction` is true and kick button shows

Wait — but from the previous investigation we know the farm IS showing "Under Construction" now (status = 0). So the Kick button IS visible. The transaction is likely FAILING with a contract error because the contract's own conditions for `kickmany` aren't met.

## The Real Fix — What kickmany Actually Requires

Looking at WaxDAO's own frontend behavior and the fact that real `kickmany` calls succeed for farms in `status = 0` (confirmed by the on-chain data showing `testfarm3` with `fragglerockk`), the action structure IS correct.

**The actual problem is the `user` parameter.** In our `buildKickManyAction`:

```ts
data: {
  user,        // This is the FARM CREATOR calling the action
  farmname: farmName,
  quantity_of_users: amount,
}
```

Looking at the on-chain transactions, `user` is correctly the farm creator/caller. So this is fine.

## Most Likely Actual Issue — Contract Assertion on Farm State

The `kickmany` contract action may assert that the farm must be in a **closed** state where stakers still exist AND the expiration has passed or the farm was explicitly closed. Since `testtestfarm` now shows as `status = 0` (Under Construction), but the contract may still be in a different internal state...

Actually, the most actionable thing to check is: **Did the kickmany transaction actually broadcast and succeed on-chain, or did it fail?**

Looking at the `useWaxTransaction` hook: on failure it shows a destructive toast with the contract error message. On success it shows "Users Kicked". The user reported neither — they saw "Farm data refreshed!" which is the REFRESH button toast.

This means the user likely pressed Refresh after using Kick Users. The Kick Users transaction may have silently shown an error toast that was dismissed.

## The Fix

There are two issues to address:

### Issue 1 — Make the error more visible

The `KickUsersDialog` closes on success but on failure the dialog also closes (because `setIsSubmitting(false)` in the finally block doesn't check result). The user may have seen an error flash and dismissed it. We should keep the dialog open on failure.

Looking at `KickUsersDialog.tsx`:
```tsx
const handleKick = async () => {
  // ...
  try {
    const action = buildKickManyAction(accountName, farm.farm_name, kickAmount);
    const result = await executeTransaction([action], { ... });

    if (result.success) {
      setOpen(false);   // Only close on success - CORRECT
      onSuccess?.();
    }
    // On failure: result.success is false, dialog stays open - CORRECT
  } finally {
    setIsSubmitting(false);
  }
};
```

This is actually already correct — the dialog only closes on success. So the user saw the error toast.

### Issue 2 — The contract is likely asserting the farm is not in a kickable state

Looking at what WaxDAO.io's frontend does: it calls `kickmany` after `closefarm` is confirmed. But `closefarm` sets `status = 0`. The WaxDAO contract may require the farm to have been in **status 1 at some point** (i.e., it was opened) AND now be either expired with status still 1 OR explicitly closed to status 0.

The `testtestfarm` was previously opened (status 1, expired), then `closefarm` was called (back to status 0). So it SHOULD be kickable.

### The Real Problem — staked_count vs total_staked

Looking at `fetchFarmDetails`:
```ts
const stakedCount = (row.total_staked || 0) as number;
```

The on-chain field is `total_staked`. This is the count of **staked NFTs**, not stakers. If `liquidcheese` has staked NFTs, `total_staked > 0`, so `hasStakers` is true and the Kick button shows.

But `kickmany` kicks **users** (the staker accounts), not NFTs. The `quantity_of_users` is the number of USER ACCOUNTS to kick, not NFT count. If liquidcheese is a single user with multiple NFTs, kicking `quantity_of_users: 10` should remove them.

### The Actual Root Cause — Wrong Field Name

Looking at the WaxDAO farms contract on-chain data structure, the stakers table has field `user` and `farmname`. But the `farms` table itself likely has a field called `total_staked_nfts` or just stores the count differently.

The key problem may be simpler: **The `kickmany` action `quantity_of_users` field type in the ABI is `uint64`, but we send a JavaScript number**. WharfKit should handle this automatically through ABI encoding.

## What to Actually Fix

Given all the evidence, the most likely issue is that the **Kick Users button transaction IS failing with a contract error** because `testtestfarm` may currently still have `status = 1` in the contract (active/expired state) and `kickmany` requires the farm to be in status 0 (explicitly closed via `closefarm`). 

But wait — the UI now shows "Under Construction" which means `status = 0`. If the farm is `status = 0`, then `closefarm` was already called successfully.

**The most actionable fix:** Add console logging and show the raw contract error in the dialog so we can see exactly what the contract is rejecting. Additionally, the `KickUsersDialog` should display the transaction error inline rather than just via toast so it's not missed.

Here's the plan:

## Changes to Make

### 1. `src/components/farm/KickUsersDialog.tsx`

Add an `error` state to display the contract error inline in the dialog, so the user can see exactly why the kick is failing.

```tsx
const [kickError, setKickError] = useState<string | null>(null);

const handleKick = async () => {
  setKickError(null);
  // ...
  const result = await executeTransaction([action], {
    successTitle: "Users Kicked",
    successDescription: `Successfully kicked up to ${kickAmount} stakers from ${farm.farm_name}`,
    showErrorToast: false,  // We'll show it inline instead
  });

  if (result.success) {
    setOpen(false);
    onSuccess?.();
  } else if (result.error) {
    setKickError(result.error.message);
  }
};
```

Then in the JSX, render the error inside the dialog.

### 2. `src/lib/farm.ts` — Add a `fetchFarmStakers` function

To confirm whether `liquidcheese` is truly still staked after the kick, add a function to fetch the stakers table for a specific farm. This will let us show an accurate count AND give the user verification of whether the kick worked.

Actually, the staked_count comes from `total_staked` in the farms table row. After a successful kick, this should decrement. The issue may be that the number is cached.

## Simplified Plan

The key fix is showing the contract error inline in `KickUsersDialog` so we know what the contract is rejecting. Once we know the exact error message, we can fix the underlying cause.

Changes:
1. **`src/components/farm/KickUsersDialog.tsx`**: Show contract error inline, pass `showErrorToast: false` to avoid duplicate error messaging, add an `Alert` showing the raw error.
2. **`src/lib/farm.ts`**: Verify `buildKickManyAction` parameter types — ensure `quantity_of_users` is a number (not a string) for proper ABI encoding. WharfKit handles serialization automatically, but it's worth confirming.
