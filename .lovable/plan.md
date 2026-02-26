

## Combine Rent + Edit into a Single Transaction

### Problem
Currently, renting a banner slot requires **two separate wallet signatures**: one for the WAX transfer (rent) and another for the edit action (set IPFS hash and website URL). This is bad UX -- the user already provides the IPFS hash and website URL during rental, so they shouldn't need to sign twice.

### Solution
Modify `RentSlotDialog.tsx` to send **both actions in a single `session.transact()` call** instead of using `transferToken()` (which only sends the transfer) followed by a second `transact()` call.

### Changes

**File: `src/components/bannerads/RentSlotDialog.tsx`**

1. Replace the two-step flow (`transferToken` + separate `transact`) with a single `session.transact()` containing both actions in one array:
   - Action 1: `eosio.token::transfer` (the WAX payment)
   - Action 2: `cheesebannad::editadbanner` or `cheesebannad::editsharedbanner` (set the banner content)

2. Only include the edit action if the user actually provided an IPFS hash (keep it optional).

3. Remove the `transferToken` import/usage since we'll call `session.transact` directly with the combined actions array.

4. Call `refreshBalance()` after success (imported from `useWax`).

### Technical Detail

The key change in `handleRent`:

```typescript
const actions = [];

// Action 1: WAX transfer for rental payment
actions.push({
  account: "eosio.token",
  name: "transfer",
  authorization: [session.permissionLevel],
  data: {
    from: session.actor.toString(),
    to: "cheesebannad",
    quantity: `${totalWax.toFixed(8)} WAX`,
    memo,
  },
});

// Action 2: Set banner content (only if IPFS hash provided)
if (ipfsHash) {
  actions.push({
    account: "cheesebannad",
    name: isJoining ? "editsharedbanner" : "editadbanner",
    authorization: [session.permissionLevel],
    data: {
      user: session.actor.toString(),
      start_time: startTime,
      position,
      ipfs_hash: ipfsHash,
      website_url: websiteUrl,
    },
  });
}

const result = await session.transact(
  { actions },
  { transactPlugins: getTransactPlugins(session) }
);
```

This way the user signs once and both the payment and banner setup happen atomically. If either fails, neither goes through.

