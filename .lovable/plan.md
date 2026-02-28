

## Fix: CHEESEDrip Claimable Count Always Shows 0

### Root Cause

The `DripEscrow` TypeScript interface in `src/lib/drip.ts` uses field names that don't match the actual on-chain table columns from the `waxdaoescrow` contract:

| Interface field (wrong) | Actual contract field |
|---|---|
| `amount_deposited` | `total_amount` |
| `amount_claimed` | `total_amount_claimed` |

Because of this mismatch, `parseAsset()` receives `undefined` for both fields, returns `{ amount: 0 }`, and `maxRemainingClaims` is calculated as `Math.floor((0 - 0) / payout) = 0`, which caps the claimable count to 0.

The contract also returns a `total_payments` and `start_time` field that the interface already has correctly.

### Changes

**File: `src/lib/drip.ts`**

1. Update the `DripEscrow` interface to match actual contract field names:
   - Rename `amount_deposited` to `total_amount`
   - Rename `amount_claimed` to `total_amount_claimed`

2. Update all functions that reference these fields:
   - `getClaimableCount()` - change `drip.amount_deposited` to `drip.total_amount` and `drip.amount_claimed` to `drip.total_amount_claimed`
   - `getDripProgress()` - same field name updates

**File: `src/components/drip/MyDrips.tsx`**

3. Update the `DripCard` component which reads these fields:
   - Change `parseAsset(drip.amount_deposited)` to `parseAsset(drip.total_amount)`
   - Change `parseAsset(drip.amount_claimed)` to `parseAsset(drip.total_amount_claimed)`

These are straightforward find-and-replace changes across 2 files, fixing the data binding so claimable counts calculate correctly.

