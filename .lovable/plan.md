
# Fix: "Failed to Fetch" — Greymass SSL Certificate Expired

## Root Cause (100% Confirmed by Console Logs)

The console error is definitive:
```
POST https://wax.greymass.com/v1/resource_provider/request_transaction
net::ERR_CERT_DATE_INVALID
```

The `getTransactPlugins` function in `src/lib/wharfKit.ts` returns a `TransactPluginResourceProvider` pointing to `https://wax.greymass.com` when an Anchor wallet is detected. Before WharfKit submits any transaction, this plugin makes a POST request to Greymass asking for free CPU/NET sponsorship ("Fuel"). Greymass's SSL certificate is currently expired — the browser refuses the connection entirely with `ERR_CERT_DATE_INVALID`, which throws `TypeError: Failed to fetch`.

## Why Claiming Rewards Seems to Work

The `TransactPluginResourceProvider` only requests Fuel sponsorship for transactions that appear to **need** resources (based on CPU/NET estimates). Small/simple claim transactions may succeed because either:
- The Fuel plugin decides no sponsorship is needed and skips the Greymass call
- Or the user has enough staked CPU that the plugin silently bypasses Fuel

The `addliquid` action is a **3-action transaction** (2x token transfers + 1x addliquid) — this is larger and always triggers the Fuel request to Greymass, which is why it specifically fails while smaller transactions may not.

## The Fix — Disable Greymass Fuel Endpoint

Only one file needs to change: `src/lib/wharfKit.ts`

Update `getTransactPlugins` to return an empty array, bypassing the broken Greymass endpoint. Users will use their own WAX CPU/NET resources. With `allowFees: false` already set, we were never getting paid sponsorship anyway — only free sponsorship when Greymass decided to offer it.

```ts
export function getTransactPlugins(session: Session) {
  // NOTE: Greymass Fuel (wax.greymass.com) SSL certificate is currently expired
  // (ERR_CERT_DATE_INVALID). All requests to the Fuel endpoint fail at browser level.
  // Disabling Fuel until Greymass renews their certificate.
  // To re-enable: restore the TransactPluginResourceProvider block below.
  console.log('[WharfKit] getTransactPlugins - Fuel disabled (Greymass cert expired)');
  return [];

  /* Re-enable when wax.greymass.com cert is renewed:
  const useAnchorPlugins = isAnchorSession(session);
  if (useAnchorPlugins) {
    return [
      new TransactPluginResourceProvider({
        endpoints: { [WAX_CHAIN_ID]: 'https://wax.greymass.com' },
        allowFees: false,
      }),
    ];
  }
  return [];
  */
}
```

## What This Changes

- All transactions (claim rewards, add liquidity, stake, etc.) will skip the Greymass Fuel co-signing step
- Users will sign transactions using their own CPU/NET resources (staked WAX or REX)
- No functional difference since `allowFees: false` meant Greymass was only ever providing free resource sponsorship, which it may or may not have granted
- When Greymass renews their cert, simply restore the original function body

## Files to Change

| File | Change |
|---|---|
| `src/lib/wharfKit.ts` | Lines 54-72: Replace `getTransactPlugins` body to return `[]` immediately, with the original code commented out for easy re-enabling |

This is a single-function, single-file change that will immediately fix the "Failed to fetch" error on all transactions.
