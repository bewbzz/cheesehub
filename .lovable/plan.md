

## Admin Monitoring Dashboard for CHEESE Contracts

### Overview

Build a hidden `/admin` page that is only visible to whitelisted WAX accounts. It reads on-chain config tables and live Alcor pool prices for all four contracts, displays them side-by-side, and highlights warnings when parameters are approaching or exceeding thresholds that would cause transaction failures.

### Access Control

- The page route `/admin` is added but not linked in navigation
- On load, it checks the connected wallet against the `cheeseburner` contract's `whitelist` table (already exists on-chain with `addwhitelist`/`rmwhitelist` actions)
- If the wallet is not whitelisted (or not connected), show a generic "Not authorized" message
- No sensitive data is exposed -- all data is already public on-chain; the gate just hides the monitoring UI from regular users

### Data Sources (All On-Chain / Public APIs)

**1. cheeseburner**
- Config singleton: `enabled`, `min_wax_to_burn`, `alcor_pool_id`, `admin`
- Whitelist table (used for access control)
- Pool 1252 live reserves (WAX/CHEESE rate)

**2. cheesefeefee**
- Config table: `wax_per_cheese_baseline`, `waxdao_per_wax_baseline`
- Live Pool 1252 price vs baseline (CHEESE/WAX) -- warn if deviation > 8%
- Live Pool 1236 price vs baseline (WAXDAO/WAX) -- warn if deviation > 8%
- Hardcoded threshold: `MAX_PRICE_DEVIATION = 10%` (contract rejects at this point)

**3. cheesebannad**
- Config table: `wax_price_per_day`, `wax_per_cheese_baseline`
- Admins table (list current admins)

**4. cheesepowerz**
- Stats table: `total_powerups`, `total_wax_spent`, `total_cheese_received`
- Config/pricing data (if available on-chain)

**5. Live Market Data**
- Alcor Pool 1252 reserves (CHEESE/WAX)
- Alcor Pool 1236 reserves (WAX/WAXDAO)
- Current spot prices calculated from reserves
- Deviation percentages from set baselines

### Warning System

Each parameter card shows a status indicator:
- **Green**: Within safe range (deviation < 5%)
- **Yellow**: Approaching threshold (deviation 5-8%) -- "Consider updating baseline"
- **Red**: At or exceeding threshold (deviation > 8%) -- "Transactions will fail soon!"

Specific warnings:
- `cheeseburner.enabled == false` -- Red: "Burns disabled"
- `cheesefeefee` CHEESE/WAX deviation > 8% -- Yellow/Red with exact % shown
- `cheesefeefee` WAXDAO/WAX deviation > 8% -- Yellow/Red with exact % shown
- `cheesebannad` baseline drift -- informational (no hard reject in this contract, but UI display will be wrong)

### Failed Transaction Detection

- Query Hyperion for recent failed actions on each contract (last 24h)
- Display a log of failed transactions with error messages
- Filter for common failure patterns: "deviation too high", "Burns are currently disabled", "below minimum"

### File Plan

**New files:**
1. `src/pages/Admin.tsx` -- Main admin dashboard page with access gate
2. `src/hooks/useAdminAccess.ts` -- Hook to check if connected wallet is in cheeseburner whitelist
3. `src/hooks/useContractConfigs.ts` -- Hook to fetch all four contract configs + live pool data
4. `src/hooks/useFailedTransactions.ts` -- Hook to query Hyperion for recent failed actions
5. `src/components/admin/ContractStatusCard.tsx` -- Reusable card showing a contract's config + warnings
6. `src/components/admin/PriceDeviationGauge.tsx` -- Visual gauge showing baseline vs live price with threshold bands
7. `src/components/admin/FailedTransactionLog.tsx` -- Table of recent failed transactions
8. `src/lib/adminData.ts` -- Data fetching functions for contract configs and pool reserves

**Modified files:**
1. `src/App.tsx` -- Add `/admin` route

### UI Layout

```text
+--------------------------------------------------+
|  CHEESE Contract Monitor (Admin Only)            |
+--------------------------------------------------+
|                                                  |
|  [cheeseburner]    [cheesefeefee]               |
|  Status: Enabled   Baselines:                    |
|  Min WAX: 5.00     CHEESE/WAX: 1.50 (set)       |
|  Pool ID: 1252       Live: 1.62 (+8.0%) [!]     |
|  Admin: cheeseadmn  WAXDAO/WAX: 32.0 (set)      |
|                      Live: 30.1 (-5.9%) [~]      |
|                                                  |
|  [cheesebannad]    [cheesepowerz]               |
|  Price/Day: 100WAX  Total Powerups: 1,234        |
|  Baseline: 1.50      WAX Spent: 5,678           |
|  Admins: 2           CHEESE Nulled: 12,345       |
|                                                  |
|  [Recent Failed Transactions - Last 24h]         |
|  Time | Contract | Action | Error Message        |
|  ...  | ...      | ...    | ...                  |
+--------------------------------------------------+
```

### Technical Details

- Access check uses `fetchTableRows` with `code: "cheeseburner"`, `scope: "cheeseburner"`, `table: "whitelist"`, `lower_bound` / `upper_bound` set to the connected account name
- Pool reserves fetched from Alcor API: `https://wax.alcor.exchange/api/v2/swap/pools` or via on-chain table reads from `swap.alcor` contract
- Price deviation calculated as `|actual - baseline| / baseline * 100`
- Failed transactions fetched from Hyperion: `/v2/history/get_actions?account={contract}&filter=*:*&sort=desc&limit=50` then filtered for `"error"` in response
- All queries use React Query with 60-second refresh intervals for live monitoring
- Auto-refresh toggle to enable/disable polling
- The page uses existing UI components (Card, Badge, Table) for consistency

