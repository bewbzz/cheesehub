

# Add `migrate` Action to the Cheeseburner Contract

## The Problem

The `cheeseburner` contract's `stats` table has an ABI that expects a `total_wax_cheesepowerz` field, but the existing row was written before that field existed. Every action that tries to **read** the stats row (including `setconfig`, `burn`, etc.) crashes with "datastream attempted to read past the end" because the on-chain data is shorter than what the ABI says it should be.

## The Solution

Add a `migrate` action that **erases** the old row and **writes** a fresh one with all fields present (including a default `0.00000000 WAX` for `total_wax_cheesepowerz`). This action must NOT read/deserialize the old row -- it uses the raw iterator to erase it.

## What to Add to the Contract

### 1. In the `.hpp` file -- add the action declaration

Inside the contract's `public:` section, add:

```text
ACTION migrate(name caller);
```

### 2. In the `.cpp` file -- add the action implementation

```text
ACTION cheeseburner::migrate(name caller) {
    // Only the contract account can call this
    require_auth(get_self());

    // Open the stats table
    stats_table stats_tbl(get_self(), get_self().value);

    // Try to find the existing row by primary key
    auto itr = stats_tbl.find(1);  // assuming primary key is 1

    // If it exists, erase it (this does NOT deserialize the row data)
    if (itr != stats_tbl.end()) {
        stats_tbl.erase(itr);
    }

    // Now emplace a fresh row with all fields, preserving known values
    // You will need to fill in the actual values from before the break
    stats_tbl.emplace(get_self(), [&](auto& row) {
        row.id                    = 1;
        row.total_burns           = 0;  // or the real value if you know it
        row.total_wax_claimed     = asset(0, symbol("WAX", 8));
        row.total_wax_staked      = asset(0, symbol("WAX", 8));
        row.total_cheese_burned   = asset(0, symbol("CHEESE", 4));
        row.total_cheese_rewards  = asset(0, symbol("CHEESE", 4));
        row.total_cheese_liquidity = asset(0, symbol("CHEESE", 4));
        row.total_wax_cheesepowerz = asset(0, symbol("WAX", 8));
    });
}
```

**IMPORTANT**: The `erase()` call on the iterator does NOT attempt to deserialize the row body -- it just deletes it by key. This is why the migrate pattern works when `get()` and `modify()` crash.

### 3. Adjust field values

The code above uses zeroes for everything. If you want to preserve the historical totals:
- Check a block explorer (e.g. waxblock.io) for the last known good values
- Hard-code them into the `emplace` lambda instead of zeroes

### 4. Compile, deploy, and call

1. Compile the contract with the new `migrate` action
2. Deploy the updated WASM + ABI to the `cheeseburner` account
3. Call `migrate` once (authorize as `cheeseburner`)
4. After that, all existing actions (`burn`, `setconfig`, etc.) will work again because the row now has every field the ABI expects

### 5. (Optional) Remove migrate afterwards

Once the migration is done, you can remove the `migrate` action and redeploy to keep the contract clean. It is only needed once.

## Important Notes

- The `erase(itr)` pattern is the key trick -- it works at the raw DB level and does not try to decode the row
- If your stats table uses a singleton (`eosio::singleton`) instead of `multi_index`, the same approach applies but the syntax is slightly different -- you would use `stats_singleton.remove()` then `stats_singleton.set(...)` 
- The primary key value (shown as `1` above) must match whatever your `stats_row` struct uses -- check your `.hpp` for the actual primary key

