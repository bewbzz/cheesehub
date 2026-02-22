

# Fix CHEESENull Stats Error

## The Root Cause

The `migrate` action in `cheeseburner.cpp` uses `stats_tbl.find(0)` and `stats_tbl.erase(itr)`, which both attempt to **deserialize** the row. Since the on-chain row was written with the old schema (missing `total_wax_cheesepowerz`), deserialization crashes with "datastream attempted to read past the end." Every previous fix attempt used the same `multi_index` API, which is why they all produce the same error.

## Two-Part Fix

### Part 1: Smart Contract Fix (cheeseburner.cpp)

Replace the `migrate` action to use **raw DB intrinsics** that bypass deserialization entirely:

```cpp
ACTION cheeseburner::migrate(name caller) {
    require_auth(get_self());

    // Use raw DB intrinsics to delete without deserializing
    auto raw_itr = db_find_i64(
        get_self().value,   // code
        get_self().value,   // scope
        "stats"_n.value,    // table
        0                   // primary key
    );
    if (raw_itr >= 0) {
        db_remove_i64(raw_itr);
    }

    // Now emplace a fresh row with the correct schema
    stats_table stats_tbl(get_self(), get_self().value);
    stats_tbl.emplace(get_self(), [&](auto& row) {
        row.total_burns            = 0;
        row.total_wax_claimed      = asset(0, WAX_SYMBOL);
        row.total_wax_staked       = asset(0, WAX_SYMBOL);
        row.total_cheese_burned    = asset(0, CHEESE_SYMBOL);
        row.total_cheese_rewards   = asset(0, CHEESE_SYMBOL);
        row.total_cheese_liquidity = asset(0, CHEESE_SYMBOL);
        row.total_wax_cheesepowerz = asset(0, WAX_SYMBOL);
    });
}
```

You will need to recompile the contract, deploy it, and then call the `migrate` action.

### Part 2: Frontend Graceful Fallback

While the contract is being fixed, update the frontend so the CHEESENull page doesn't show errors:

**File: `src/components/cheesenull/NullTotalStats.tsx`** -- Add error handling so NullTotalStats shows "Unavailable" or zeros instead of an error state when the stats table read fails.

**File: `src/hooks/useCheeseNullStats.ts`** -- The hook already returns defaults (`0`) when data is null, and `fetchContractStats` already catches errors and returns `null`. No changes needed here -- the hook handles it gracefully. But the component may be showing an error state. Will verify and add a friendly fallback message if needed.

### Summary

| Step | What | Why |
|------|------|-----|
| 1 | Replace `migrate` action with raw DB intrinsics | `multi_index::find/erase` deserializes, which crashes on mismatched schema |
| 2 | Recompile + deploy + call `migrate` | Fixes the on-chain data |
| 3 | Add frontend fallback for stats errors | Users see "Stats unavailable" instead of errors until migration completes |

### Technical Detail

- `db_find_i64(code, scope, table, id)` returns a raw iterator (int) without deserializing
- `db_remove_i64(itr)` deletes the row using that raw iterator, also without deserializing
- These are the low-level C intrinsics that `multi_index` wraps -- using them directly sidesteps the deserialization layer entirely

