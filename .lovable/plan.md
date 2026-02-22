

# Fix Compilation Error in cheeseburner migrate action

The compiler error is straightforward: the raw DB intrinsic functions live inside the `eosio::internal_use_do_not_use` namespace in CDT 3.x. They need to be fully qualified.

## Change

**File: `contracts/cheeseburner/cheeseburner.cpp`** -- In the `migrate` action, prefix both function calls with their full namespace:

```cpp
auto raw_itr = eosio::internal_use_do_not_use::db_find_i64(
    get_self().value,
    get_self().value,
    "stats"_n.value,
    0
);
if (raw_itr >= 0) {
    eosio::internal_use_do_not_use::db_remove_i64(raw_itr);
}
```

That is the only change needed. Everything else in the contract stays the same.

