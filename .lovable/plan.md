

## Fix: CHEESESwap Widget Not Showing CHEESE Token

### Root Cause
The `<waxonedge-swap>` widget does **not** support a `default` attribute. The documented attributes are: `theme`, `chart`, `wallet`, `lock`, `signing`, and `config`. The `default` prop being passed is silently ignored, so the widget falls back to its own defaults (WAXUSDC -> WAX).

### Solution
Replace the `default` attribute with the `lock` attribute, which is the correct way to preset tokens in the WaxOnEdge widget. The `lock` attribute format is:

```text
{ in: "contract_symbol", out: "contract_symbol" }
```

For example: `{ in: "eosio.token_WAX", out: "cheeseburger_CHEESE" }`

### Changes

**File: `src/components/swap/CheeseSwapDialog.tsx`**

1. Rename the `defaultTokens` variable to `lockTokens`
2. Change the JSX attribute from `default={defaultTokens}` to `lock={lockTokens}`
3. Fix the WAXUSDC contract name from `alclorstable` to `eth.token` (the correct contract on WAX mainnet, as confirmed by the network requests showing `eth.token` for WAXUSDC)
4. Update the `IntrinsicElements` type declaration to remove `default` and ensure `lock` is included

### Result
- When clicking CHEESE/WAX price: widget opens with WAX (input) locked to CHEESE (output)
- When clicking CHEESE/USD price: widget opens with WAXUSDC (input) locked to CHEESE (output)
- CHEESE token from `cheeseburger` contract will always appear as the output token
- Users can still enter amounts and execute swaps normally
