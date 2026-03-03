

## Fix: Swap Widget Default Pair and Token List

### Problem
The `lock` attribute restricts which tokens appear in the selection modal. Currently it locks both input and output, which limits the token list to only WAX and CHEESE. The user wants all tokens available, with CHEESE/WAX (or CHEESE/WAXUSDC) simply as the **initial default pair** -- both sides fully changeable.

### Approach
The WaxOnEdge widget docs show no "default pair" attribute -- only `lock` which restricts allowed tokens. To get the desired behavior:

1. **Set `lock` briefly on mount** to establish the initial pair (WAX to CHEESE or WAXUSDC to CHEESE)
2. **Remove `lock` after a short delay** (~300ms) so the full token list becomes available on both sides
3. **Force remount** via a React `key` when the dialog opens or `inputToken` changes, ensuring the widget re-initializes cleanly with the correct initial pair each time

### Changes

**File: `src/components/swap/CheeseSwapDialog.tsx`**

1. Add a `mountKey` state (counter) that increments each time `open` transitions to `true` or `inputToken` changes -- used as `key` on the `<waxonedge-swap>` element to force a fresh mount
2. In the `useEffect`, after setting the initial `lock` attribute, add a second timer (~300ms later) that removes the `lock` attribute entirely, unlocking both token sides
3. Fix token contract mapping: change `WAXUSDC` and `WAXUSDT` from `alclorstable` to `eth.token`
4. Keep all existing event listeners, signing logic, and config unchanged

### Expected Result
- Dialog opens with WAX -> CHEESE (from WAX price card) or WAXUSDC -> CHEESE (from USD price card) as the starting pair
- After a brief moment, both input and output token selectors show the full list of WAX tokens
- Token balances load when wallet is connected and `rates.neftyblocks.com` responds
- Swap signing continues to work with corrected contract mappings

