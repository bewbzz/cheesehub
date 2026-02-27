

## Enforce Rent/Join Buffers in the Smart Contract

### Problem
The 48-hour rent buffer and 12-hour join buffer are only enforced in the frontend UI. Anyone can send a WAX transfer directly to `cheesebannad` with the correct memo and bypass these restrictions entirely, defeating the anti-gaming protection.

### Solution
Add time buffer checks inside the `assign_slots` function in `cheesebannad.cpp`. This is where exclusive rentals (mode `e`), shared rentals (mode `s`), and joins (mode `j`) are processed.

### Contract Change

**File: `contracts/cheesebannad/cheesebannad.cpp`**

In the `assign_slots` function, after the existing expiry check on line 371, add buffer enforcement:

```cpp
// After: check(slot_time + SECONDS_PER_DAY > now, "Cannot rent expired slot...");

// Enforce minimum lead-time buffers
if (mode == 'e' || mode == 's') {
    // New rentals require 48 hours before go-live
    check(slot_time >= now + RENT_BUFFER_SECONDS,
        "Must rent at least 48 hours before slot goes live");
} else if (mode == 'j') {
    // Joining a shared slot requires 12 hours before go-live
    check(slot_time >= now + JOIN_BUFFER_SECONDS,
        "Must join at least 12 hours before slot goes live");
}
```

**File: `contracts/cheesebannad/cheesebannad.hpp`**

Add two constants alongside the existing ones:

```cpp
static constexpr uint32_t RENT_BUFFER_SECONDS = 48 * 3600;  // 48 hours
static constexpr uint32_t JOIN_BUFFER_SECONDS = 12 * 3600;  // 12 hours
```

### Notes

- The frontend buffers already match (48h rent, 12h join), so the UX won't change for normal users -- they'll never hit these contract checks.
- Direct contract interactions will now get a clear error message explaining the minimum lead time.
- This is a contract change, so it requires recompiling and redeploying `cheesebannad` on-chain. Lovable can update the source files but cannot deploy the contract.
- The existing frontend checks remain as a UX convenience (hiding buttons rather than showing errors).

