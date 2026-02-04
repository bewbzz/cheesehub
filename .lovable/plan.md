
# Fix RUGG Token Precision

## Problem

RUGG token is configured with precision 4 in the token registry, but the actual on-chain token at `rareruggapes` has **precision 8**. This causes a "symbol precision mismatch" error when trying to increase liquidity on CHEESE/RUGG positions in the Alcor Farm Manager.

## Solution

Update the RUGG entry in the token registry from precision 4 to precision 8.

## File Change

### `src/lib/tokenRegistry.ts`

**Line 37** - Change RUGG precision:

```text
Before:
{ symbol: 'RUGG', contract: 'rareruggapes', precision: 4, displayName: 'RUGG' },

After:
{ symbol: 'RUGG', contract: 'rareruggapes', precision: 8, displayName: 'RUGG' },
```

## Summary

| File | Change |
|------|--------|
| `src/lib/tokenRegistry.ts` | Update RUGG precision from 4 to 8 |

## Impact

After this fix, the Increase Liquidity dialog will correctly format RUGG amounts with 8 decimal places, matching the on-chain token precision and resolving the mismatch error.
