
# Fix: "Failed to Fetch" Error When Adding Liquidity in Alcor Farm Manager

## Root Cause

The "TypeError: Failed to fetch" error shown as a toast comes from inside `handleSubmit` in `IncreaseLiquidityDialog.tsx`. The error is thrown during `session.transact(...)` — specifically when WharfKit tries to **fetch the ABI** for the `swap.alcor` contract from the WAX RPC node to serialize the transaction.

WharfKit always fetches the contract ABI before signing a transaction to serialize action data. If the primary RPC endpoint is slow or drops the connection at that moment, the fetch fails with a generic `TypeError: Failed to fetch`. The error bubbles up and the dialog shows it as a toast.

There are two contributing issues:

1. **No retry on the RPC fetch**: The ABI fetch by WharfKit hits whichever RPC is currently active. If it times out or drops, it throws immediately with no retry.
2. **The error is caught and shown as a toast, then the dialog stays open with no inline error** — the user sees a toast flash and disappear, leaving them confused about what happened.

## What the Session Replay Showed

The session replay confirmed:
- The "Add Liquidity" button was disabled (showing "Adding Liquidity...") — so `handleSubmit` was called and `setIsTransacting(true)` ran.
- Then `TypeError: Failed to fetch` appeared as a toast notification.

This confirms the error happens inside `session.transact` when WharfKit internally tries to resolve the `swap.alcor` ABI.

## The Fix

### Two Changes Needed

**Change 1: `src/components/wallet/IncreaseLiquidityDialog.tsx`**

Add inline error display (same pattern as `KickUsersDialog`) so the user sees the error clearly inside the dialog, with a "Try Again" button, rather than a fleeting toast. Also add a retry wrapper around `session.transact` with a small delay on failure.

```tsx
const [submitError, setSubmitError] = useState<string | null>(null);

const handleSubmit = async () => {
  setSubmitError(null);
  // ... existing validation ...
  
  setIsTransacting(true);
  try {
    // Retry up to 2 times on network errors
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
        // ... handle success ...
        return;
      } catch (err: any) {
        lastError = err;
        const isNetworkError = err?.message?.toLowerCase().includes('failed to fetch') ||
                               err?.message?.toLowerCase().includes('network');
        if (!isNetworkError) break; // Don't retry contract errors
      }
    }
    throw lastError;
  } catch (error: any) {
    const msg = error?.message || 'Failed to add liquidity';
    const isNetworkError = msg.toLowerCase().includes('failed to fetch');
    setSubmitError(
      isNetworkError
        ? 'Network error: Could not reach WAX node. Please try again.'
        : msg
    );
  } finally {
    setIsTransacting(false);
    closeWharfkitModals();
    setTimeout(() => closeWharfkitModals(), 300);
  }
};
```

Then add an inline `Alert` in the JSX (just like `KickUsersDialog` now has):
```tsx
{submitError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="break-all text-xs">{submitError}</AlertDescription>
  </Alert>
)}
```

**Change 2: `src/lib/alcorFarms.ts` — Fix the `addliquid` action structure**

Looking at the `buildIncreaseLiquidityAction` function (lines 925-993), there is a potential structural issue: the `addliquid` action's `data` object has **inconsistent indentation** suggesting the fields may not be correctly nested (lines 986-990 have different indentation than lines 982-985). While TypeScript won't care about indentation, it's worth double-checking that `tokenAMin`, `tokenBMin`, and `deadline` are inside the `data` object.

More importantly: the `addliquid` action sends a `positionId` parameter that isn't used. The Alcor `addliquid` action creates a **new position** if one doesn't exist or adds to an existing one. To add to an **existing position**, the correct action name on Alcor V3 is actually `addliquid` with the same tick range — but the `positionId` is NOT passed to this action. The current implementation is correct on this point.

However, the **slippage calculation** uses 10% which is very aggressive and may cause failures if price moves slightly. The Alcor frontend uses 0.5% slippage by default. The 10% slippage should be reduced to 0.5% so min amounts are much closer to desired amounts and the transaction doesn't fail with "amount too small" contract assertions.

Change in `buildIncreaseLiquidityAction`:
```ts
// Before
const slippageMultiplier = 0.90; // 10% slippage

// After  
const slippageMultiplier = 0.995; // 0.5% slippage (matches Alcor default)
```

## Files to Change

| File | Change |
|---|---|
| `src/components/wallet/IncreaseLiquidityDialog.tsx` | Add `submitError` state; wrap `session.transact` in 2-attempt retry loop for network errors; show inline `Alert` with error message; keep toast removed |
| `src/lib/alcorFarms.ts` | Change `slippageMultiplier` from `0.90` (10%) to `0.995` (0.5%) in `buildIncreaseLiquidityAction` |

## Why 0.5% Slippage

Alcor Exchange uses 0.5% slippage by default for concentrated liquidity adds. With 10% slippage, the `tokenAMin` and `tokenBMin` are 10% below the desired amount — this is so loose that it may cause issues on the contract side if the pool validates that the minimum makes sense relative to the desired. Alcor's own frontend uses 0.5% (or up to 2% in volatile markets), not 10%.
