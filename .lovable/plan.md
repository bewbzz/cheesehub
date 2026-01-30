
# Fix Vote Rewards "Calculating..." Stuck Issue

## Problem Summary
The vote rewards calculation is stuck showing "Calculating..." because it's fetching from the wrong blockchain table (`global4` instead of `global`). The `global4` table contains standby bucket data, not the `voters_bucket` needed for reward calculations.

## Technical Diagnosis
- Current code fetches `eosio::global4` table first
- `global4` returns standby bucket data (confirmed in network logs)
- The `voters_bucket` and `total_unpaid_voteshare` fields are in the `global` table
- Since `global4` fetch succeeds (status 200), the fallback to `global` never triggers
- Result: `votersBucket: 0` and `currentTotalVoteshare: 0` causing calculation to return 0
- UI displays "Calculating..." when rewards equals 0, which is misleading

## Solution

### File: `src/components/wallet/VoteRewardsManager.tsx`

**Change 1: Fetch from `global` table directly (not `global4`)**

Replace the current global4/fallback logic with a direct fetch to the `global` table which contains the correct fields:

```typescript
// Fetch global state for reward calculation - use 'global' table
const globalResponse = await fetchWithFallback(
  WAX_ENDPOINTS,
  '/v1/chain/get_table_rows',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'eosio',
      scope: 'eosio',
      table: 'global',  // Changed from 'global4'
      limit: 1,
      json: true,
    }),
  }
);
globalData = await globalResponse.json();
```

**Change 2: Update GlobalState interface to match actual fields**

The `global` table has different field names. Update the interface to match:

```typescript
interface GlobalState {
  max_ram_size: string;
  total_ram_bytes_reserved: string;
  total_ram_stake: string;
  last_producer_schedule_update: string;
  // ... other fields
  perblock_bucket: number;
  pervote_bucket: number;
  total_unpaid_blocks: number;
  total_activated_stake: string;
  thresh_activated_stake_time: string;
  last_producer_schedule_size: number;
  total_producer_vote_weight: string;
  last_name_close: string;
  voters_bucket: string;  // This is what we need
  total_unpaid_voteshare: string;  // This too
  total_voteshare_change_rate: string;
}
```

**Change 3: Fix the UI display logic**

Change "Calculating..." to a more accurate message when calculation completes but returns 0:

```typescript
<span className="font-medium text-cheese">
  {estimatedRewards > 0 
    ? `${estimatedRewards.toFixed(8)} WAX` 
    : estimatedRewards === -1 
      ? 'Rewards Available!' 
      : hasVoted && canClaim
        ? 'Claim to check' 
        : '0.00000000 WAX'}
</span>
```

**Change 4: Remove outdated CORS-failing endpoint**

Per project memory, remove `wax.greymass.com` from the endpoints list as it has persistent CORS issues:

```typescript
const WAX_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
  'https://wax.cryptolions.io',
  'https://wax.eu.eosamsterdam.net',
];
```

## Expected Outcome
- Vote rewards will be properly calculated using the `voters_bucket` from the `global` table
- Users will see their actual estimated WAX rewards instead of "Calculating..."
- If calculation still returns 0 for valid reasons (e.g., no rewards accrued yet), it shows "0.00000000 WAX" or "Claim to check" instead of misleading "Calculating..."
- Network requests will be more reliable without the CORS-failing endpoint
