

# Fix: Cap Rewards Against Raw Pool Balance, Not Effective Balance

## Problem
The current cap uses `calculateEffectiveBalance`, which estimates the pool balance **after subtracting all stakers' accrued rewards**. For example, with 0.56 WAX on-chain and ~0.27 accrued across all stakers, it reports ~0.29 as "effective". If your personal claimable is 0.27, that passes the check — but the estimate can be overly aggressive and block valid claims.

The real issue: the contract pays from the **raw on-chain balance** (0.56), not from some "effective" number. Your 0.27 claim against a 0.56 balance should always succeed. The cap should only prevent claims that exceed the **actual on-chain token balance** in the pool.

## Fix

### `src/components/farm/NFTStaking.tsx` (~line 439-445)

Change the cap logic to use the **raw pool balance** instead of the effective balance:

**Before:**
```typescript
const { effectiveBalance } = calculateEffectiveBalance(matchingPool, farm.last_payout, now);
if (claimableAmount > effectiveBalance) {
  claimableAmount = Math.max(0, effectiveBalance);
  isCapped = true;
}
```

**After:**
```typescript
const rawBalance = parseFloat(matchingPool.balance) || 0;
if (claimableAmount > rawBalance) {
  claimableAmount = Math.max(0, rawBalance);
  isCapped = true;
}
```

This means:
- A 0.27 claim against a 0.56 pool balance passes (no cap)
- A 0.70 claim against a 0.56 pool balance gets capped to 0.56 (prevents overdrawn error)
- The "Pool running low" warning only appears when the pool genuinely cannot cover your personal rewards

### `src/components/farm/NFTStaking.tsx` -- Remove unused import

Remove `calculateEffectiveBalance` from the import if it's no longer used elsewhere in this file (it may still be used in FarmDetail — only remove from the NFTStaking import line).

