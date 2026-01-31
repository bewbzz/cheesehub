
# Fix Rent Resources "Failed to Fetch" Error

## Problem Summary
When trying to rent resources using CHEESE in the wallet, transactions fail with "Failed to fetch" errors. This is caused by the primary WAX RPC endpoint (`wax.eosusa.io`) being temporarily unavailable, and WharfKit having no fallback mechanism.

## Root Cause Analysis
From the console and network logs:
- `wax.eosusa.io` is returning "Failed to fetch" (CORS or connectivity issues)
- `api.wax.alohaeos.com` is also failing
- `wax.eosphere.io` is responding successfully (status 200)
- WharfKit is configured with only ONE endpoint (`wax.eosusa.io`)
- When that endpoint fails, all transactions fail with no fallback

## Solution

### File: `src/lib/wharfKit.ts`

**Change 1: Update primary RPC endpoint to a more reliable one**

Replace the failing `wax.eosusa.io` with `wax.eosphere.io` which is currently responding:

```typescript
// Define WAX mainnet with a more reliable primary RPC endpoint
const waxChain = ChainDefinition.from({
  id: WAX_CHAIN_ID,
  url: 'https://wax.eosphere.io', // Changed from wax.eosusa.io
});
```

### File: `src/lib/waxRpcFallback.ts`

**Change 2: Reorder endpoints to prioritize working ones**

Move `wax.eosphere.io` to the top of the fallback list since it's currently the most reliable:

```typescript
export const WAX_RPC_ENDPOINTS = [
  "https://wax.eosphere.io",    // Currently most reliable
  "https://api.waxsweden.org",  // Usually stable
  "https://wax.pink.gg",
  "https://wax.eosusa.io",      // Currently having issues
  "https://api.wax.alohaeos.com",
  // Note: wax.greymass.com removed due to persistent CORS issues
];

const HYPERION_ENDPOINTS = [
  "https://wax.eosphere.io",    // Currently most reliable
  "https://wax.pink.gg",
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
];
```

**Change 3: Remove `wax.greymass.com` from RPC endpoints**

Per project memory, this endpoint has persistent CORS issues:

```typescript
// Remove from WAX_RPC_ENDPOINTS array:
"https://wax.greymass.com", // REMOVE - CORS issues
```

## Technical Details

### Why This Works
- WharfKit's SessionKit uses the `url` from ChainDefinition for all blockchain RPC calls
- Changing to `wax.eosphere.io` immediately fixes transactions since that endpoint is responding
- Reordering fallback endpoints ensures data fetching also tries working endpoints first

### Why Not Add Multiple Endpoints to WharfKit?
- WharfKit's ChainDefinition only accepts a single URL for the chain
- Adding fallback logic would require wrapping the session's transact method
- Changing the primary endpoint is the simplest and most reliable fix

## Expected Outcome
- Rent resources transactions will succeed using CHEESE or WAX
- Balance fetching will be faster (prioritizes working endpoints)
- Fewer "Failed to fetch" errors across the app
- If `wax.eosphere.io` later has issues, the fallback system will try other endpoints for data fetching (but transactions may need another endpoint update)
