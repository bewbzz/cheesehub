

# Security Analysis: cheesefeefee Contract

## Overview

I analyzed the `cheesefeefee` smart contract for security vulnerabilities. The contract handles CHEESE-to-WAXDAO fee conversion for DAO/Farm creation with a 20% discount.

---

## Security Assessment

### Existing Protections (Good)

| Protection | Implementation |
|------------|----------------|
| Atomic Transaction | All actions bundled - if any fails, entire tx reverts |
| On-Chain Pricing | Uses Alcor pool reserves directly, not user-provided values |
| Action Verification | `has_creation_action()` ensures bundled with actual creation |
| Minimum Value Check | Requires 200 WAX worth of CHEESE minimum |
| Symbol Validation | Only accepts CHEESE from `cheeseburger` contract |

### Identified Vulnerabilities

---

## CRITICAL: Price Manipulation Attack

### The Attack Vector

An attacker could:
1. Flash-manipulate the CHEESE/WAXDAO pool (Pool 8017) by doing a large swap
2. In the SAME transaction, call the cheesefeefee flow
3. Get significantly MORE WAXDAO than they should for their CHEESE
4. Profit = WAXDAO received - fair market value of CHEESE sent

### Technical Details

```text
Normal state:
  Pool 8017: 1,000,000 CHEESE / 50,000 WAXDAO
  Rate: 0.05 WAXDAO per CHEESE

Manipulated state (attacker adds 500k CHEESE to pool):
  Pool 8017: 1,500,000 CHEESE / 33,333 WAXDAO (after swap)
  Rate: 0.022 WAXDAO per CHEESE (attacker gets cheap WAXDAO)

Then attacker sends CHEESE to cheesefeefee:
  Contract reads manipulated rate
  Sends WAXDAO at inflated CHEESE price
```

**Why this works**: The contract uses `get_price_from_pool()` which reads current reserves. An attacker can manipulate reserves in the same transaction before the contract reads them.

### Impact

- **Severity**: HIGH
- **Contract WAXDAO could be drained** if attacker repeatedly exploits
- **Estimated max loss**: Entire WAXDAO balance of contract per attack

---

## MEDIUM: Dust Attack Vector

### The Attack

Attacker sends tiny amounts of CHEESE that:
1. Pass the minimum check (200 WAX worth after tolerance)
2. Result in WAXDAO amounts that round down to near-zero
3. But still execute inline actions, burning CPU/NET resources

### Current Check (Insufficient)

```cpp
// Line 158-162 in .cpp
double min_required = MIN_WAX_VALUE * (1.0 - WAX_VALUE_TOLERANCE);  // 195 WAX
check(wax_value >= min_required, "Need at least 200 WAX worth...");
```

This only validates CHEESE value, not the resulting WAXDAO amount.

### Impact

- **Severity**: MEDIUM
- Could waste contract's RAM/CPU for processing
- Low financial impact per transaction but cumulative

---

## LOW: No WAXDAO Balance Check

### The Issue

Contract doesn't verify it has enough WAXDAO before sending inline transfer.

```cpp
// Line 47-53 - sends WAXDAO without checking balance
action(
    permission_level{get_self(), "active"_n},
    WAXDAO_CONTRACT,
    "transfer"_n,
    make_tuple(get_self(), from, waxdao_amount, ...)
).send();
```

If contract runs out of WAXDAO, the inline action will fail, but:
- User loses CHEESE to burn (happens after WAXDAO transfer)
- Wait... actually the WAXDAO transfer happens FIRST, so it would revert

**Re-analysis**: Actually safe due to atomic nature - if WAXDAO transfer fails, nothing happens.

---

## Proposed Solutions

### Fix 1: Add TWAP or Price Bounds (Prevents Flash Manipulation)

Add a sanity check that the pool price hasn't deviated significantly from expected:

```cpp
// Add to .hpp
static constexpr double MAX_PRICE_DEVIATION = 0.20;  // 20% max deviation
static constexpr double EXPECTED_WAXDAO_PER_CHEESE = 0.05;  // ~baseline rate

// Add to calculate_waxdao_amount()
double waxdao_per_cheese = get_price_from_pool(CHEESE_WAXDAO_POOL_ID);

// Sanity check - prevent manipulation
double deviation = abs(waxdao_per_cheese - EXPECTED_WAXDAO_PER_CHEESE) / EXPECTED_WAXDAO_PER_CHEESE;
check(deviation <= MAX_PRICE_DEVIATION,
    "Pool price deviation too high. Possible manipulation detected.");
```

**Pros**: Simple, effective against flash manipulation
**Cons**: Requires periodic admin updates to baseline, could block legitimate trades during high volatility

### Fix 2: Fixed WAX-Value Exchange (Recommended)

Instead of using Pool 8017 for conversion, use a fixed exchange principle:

```cpp
// The user is paying 200 WAX worth of CHEESE
// They should receive 200 WAX worth of WAXDAO
// Use ONLY Pool 1252 (CHEESE/WAX) and the WAXDAO/WAX price

asset calculate_waxdao_amount(asset cheese_amount) {
    // Get WAX per CHEESE from Pool 1252
    double wax_per_cheese = get_price_from_pool(CHEESE_WAX_POOL_ID);
    double cheese_units = static_cast<double>(cheese_amount.amount) / 10000.0;
    double wax_value = cheese_units * wax_per_cheese;
    
    // Validate minimum
    check(wax_value >= MIN_WAX_VALUE * (1.0 - WAX_VALUE_TOLERANCE), "...");
    
    // Get WAXDAO price in WAX (query WAXDAO/WAX pool instead)
    double waxdao_per_wax = get_waxdao_price_in_wax();  // New function
    
    // Calculate: (WAX value of CHEESE) * (WAXDAO per WAX) = WAXDAO to send
    double waxdao_amount = wax_value * waxdao_per_wax;
    
    return asset(static_cast<int64_t>(waxdao_amount * 100000000.0), WAXDAO_SYMBOL);
}
```

**Why this is better**:
- Attacker would need to manipulate TWO pools simultaneously
- WAXDAO/WAX pool is likely higher liquidity than CHEESE/WAXDAO
- Exchange is truly "value-neutral" - 200 WAX in, 200 WAX out (in WAXDAO)

### Fix 3: Add Minimum WAXDAO Output Check

Prevent dust and rounding attacks:

```cpp
// Add to .hpp
static constexpr int64_t MIN_WAXDAO_OUTPUT = 500000000;  // 5 WAXDAO minimum (8 decimals)

// Add after waxdao_units calculation
check(waxdao_units >= MIN_WAXDAO_OUTPUT,
    "Calculated WAXDAO amount below minimum. Send more CHEESE.");
```

### Fix 4: Rate Limiting (Optional Defense in Depth)

Add a table to track recent usage and limit frequency:

```cpp
// Simple rate limit: max 10 uses per hour per account
TABLE usage_log {
    name user;
    uint64_t last_use_time;
    uint32_t uses_this_hour;
    
    uint64_t primary_key() const { return user.value; }
};

// Check in on_cheese_transfer before processing
auto user_usage = usage_table.find(from.value);
if (user_usage != usage_table.end()) {
    uint64_t current_time = current_time_point().sec_since_epoch();
    if (current_time - user_usage->last_use_time < 3600) {
        check(user_usage->uses_this_hour < 10, "Rate limit exceeded. Try again later.");
    }
}
```

---

## Recommended Implementation Priority

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| 1 | Fix 2: Fixed WAX-Value Exchange | Medium | Eliminates flash manipulation |
| 2 | Fix 3: Min WAXDAO Output | Low | Prevents dust attacks |
| 3 | Fix 1: Price Bounds | Low | Backup protection |
| 4 | Fix 4: Rate Limiting | Medium | Defense in depth |

---

## Summary of Changes Needed

### Header File (cheesefeefee.hpp)

```cpp
// Add new constants
static constexpr uint64_t WAXDAO_WAX_POOL_ID = XXXX;  // Need to find this pool ID
static constexpr int64_t MIN_WAXDAO_OUTPUT = 500000000;  // 5 WAXDAO minimum
static constexpr double MAX_PRICE_DEVIATION = 0.25;  // 25% max deviation allowed

// Add new private function
double get_waxdao_wax_price();
```

### Implementation File (cheesefeefee.cpp)

1. Replace Pool 8017 usage with WAX-value calculation
2. Add minimum WAXDAO output check
3. Add optional price deviation check

---

## Frontend Changes

The frontend in `src/lib/cheeseFees.ts` and the hooks already handle the calculation correctly for display purposes. After contract updates:

1. Update `useWaxdaoFeePricing.ts` to match new contract logic if needed
2. Consider adding a "price protection" indicator in the UI

