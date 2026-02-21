

# Re-enable Greymass Fuel (Anchor Resource Sponsorship)

## What Changes

One function in one file: `getTransactPlugins` in `src/lib/wharfKit.ts`.

Uncomment the original Fuel logic and remove the early `return []` bypass. Anchor wallet sessions will once again request free CPU/NET sponsorship from Greymass Fuel before submitting transactions. Cloud Wallet sessions continue to skip Fuel (they don't support the co-signing flow).

## File: `src/lib/wharfKit.ts`

Replace the disabled `getTransactPlugins` function (lines 53-71) with the restored version:

```ts
// Get transact plugins — Greymass Fuel provides free CPU/NET sponsorship for Anchor sessions
export function getTransactPlugins(session: Session) {
  const useAnchorPlugins = isAnchorSession(session);
  if (useAnchorPlugins) {
    console.log('[WharfKit] getTransactPlugins - Fuel enabled for Anchor session');
    return [
      new TransactPluginResourceProvider({
        endpoints: { [WAX_CHAIN_ID]: 'https://wax.greymass.com' },
        allowFees: false,
      }),
    ];
  }
  console.log('[WharfKit] getTransactPlugins - no plugins (non-Anchor session)');
  return [];
}
```

No other files need to change -- every transaction call already uses `getTransactPlugins(session)`.

