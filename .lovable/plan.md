

# Fix Admin Dashboard Blank Page

## Problem
The `cheeseburner` contract was redeployed without a `config` table in its ABI. Every RPC endpoint returns HTTP 500 for that table query. Since `fetchAllConfigs` uses `Promise.all`, this single failure crashes the entire dashboard -- no data loads at all.

## Solution
Wrap each individual fetcher in `fetchAllConfigs` with error handling so failures return `null` instead of throwing. This way the dashboard still shows data for the contracts that ARE working (cheesefeefee, cheesebannad, cheesepowerz, Alcor pools).

## Changes

### 1. `src/hooks/useContractConfigs.ts` -- wrap fetchers in try/catch

Replace the `Promise.all` with `Promise.allSettled` or wrap each call so individual failures return null gracefully:

```typescript
const [burnerConfig, burnerStats, ...rest] = await Promise.all([
  fetchBurnerConfig().catch(() => null),
  fetchBurnerStats().catch(() => null),
  fetchFeeFeeConfig().catch(() => null),
  fetchBannadConfig().catch(() => null),
  fetchBannadAdmins().catch(() => []),
  fetchPowerzStats().catch(() => null),
  fetchPoolReserves(1252).catch(() => null),
  fetchPoolReserves(1236).catch(() => null),
]);
```

This is a one-line-per-call change. Each fetcher gets a `.catch()` fallback so the rest of the data still loads.

### 2. `src/pages/Admin.tsx` -- show partial data when available

Currently line 213 shows `null` (nothing) when data is undefined. Change the `data ? (...)  : null` fallback to show a "failed to load" message instead of a blank page. Also handle the burnerConfig being null more gracefully in the card.

### No other files need changes
The `fetchTable` function in `wax.ts` already has proper fallback logic -- the issue is purely that the contract's ABI genuinely no longer has this table, so all endpoints correctly return 500.

## Result
- Dashboard loads with all working contract data (feefee, bannad, powerz, pool prices)
- Burner card shows "unavailable" values instead of crashing everything
- If more contracts lose tables in the future, the dashboard degrades gracefully

