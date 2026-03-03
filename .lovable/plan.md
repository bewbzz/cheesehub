

## Fix: Swap Widget Not Loading Tokens

### Root Cause
The `<waxonedge-swap>` widget internally calls `wax-public.neftyblocks.com` for blockchain table data, but this domain fails with `ERR_TUNNEL_CONNECTION_FAILED` in the Lovable preview environment. Without this data, the widget cannot load token information or balances.

### Solution
Use the widget's `config` attribute to override the `CHAIN_API` endpoint with a working WAX RPC endpoint (e.g., `https://api.wax.alohaeos.com` which already works in the app).

### Changes

**File: `src/components/swap/CheeseSwapDialog.tsx`**

1. Add a `config` attribute to the `IntrinsicElements` type declaration (line 29)
2. Create a `swapConfig` JSON string with `CHAIN_API` set to `https://api.wax.alohaeos.com`
3. Pass the `config` attribute to the `<waxonedge-swap>` element

The config format (from official docs):
```text
{
  CHAIN_API: string;  // Override the blockchain RPC endpoint
  CHAIN: "wax";       // Chain identifier
}
```

Result: The widget will use a working RPC endpoint instead of the blocked `wax-public.neftyblocks.com`, allowing tokens and balances to load properly.

