

# Fix Alcor Farm Manager - Positions Still Showing Unstaked

## Problem
Even after the previous fix, all positions still appear as "unstaked" when the Alcor API is down. The data source correctly shows "onchain" now, but the position data is wrong because:

1. **`fetchUserPositions` lacks cross-validation**: When the API is down, this function may return empty or stale data independently of the staked farms fix
2. **On-chain positions have no token amounts**: `transformOnChainPositions` hardcodes `amountA: '0 TOKEN'` and `amountB: '0 TOKEN'` because raw on-chain position data doesn't include amounts -- they must be calculated from pool data
3. **Double-fetching causes mismatches**: The hook calls `fetchUserStakedFarmsWithDetails` (which internally fetches positions) AND `fetchUserPositions` separately in parallel. When the API is intermittent, one call may succeed and the other fail, causing the staked/unstaked comparison to break

## Solution

### 1. Enrich on-chain positions with token amounts from pool data
**File: `src/lib/alcorFarms.ts`** -- `transformOnChainPositions`

- After fetching raw on-chain positions, also fetch the corresponding pool details for each position
- Use pool token quantities and the position's liquidity/tick data to populate `amountA` and `amountB` with real values instead of `'0 TOKEN'`
- This ensures positions fetched via blockchain look identical to API-fetched positions

### 2. Add cross-validation to `fetchUserPositions`
**File: `src/lib/alcorFarms.ts`** -- `fetchUserPositions`

- Apply the same pattern used for `fetchUserStakedFarms`: when the API returns empty, cross-validate against the blockchain before trusting it
- If blockchain has positions but API returned empty, use blockchain data

### 3. Prevent double-fetching of positions in the hook
**File: `src/hooks/useAlcorFarms.ts`**

- Currently line 64-67 calls `fetchUserStakedFarmsWithDetails(accountName)` (which internally fetches positions) AND `fetchUserPositions(accountName)` in parallel
- `fetchUserStakedFarmsWithDetails` already fetches positions internally, so the second call is redundant and can return different results
- Refactor to either:
  - Have `fetchUserStakedFarmsWithDetails` return positions alongside staked farms so they can be reused, OR
  - Use a shared positions fetch that both paths consume

### 4. Make `fetchUserPositionsOnChain` populate token amounts
**File: `src/lib/alcorFarms.ts`** -- `fetchUserPositionsOnChain`

- After fetching raw positions, batch-fetch pool details for all unique pool IDs
- Calculate approximate token amounts from pool liquidity data and position tick range
- Update `transformOnChainPositions` to accept pool data and produce proper `amountA`/`amountB` strings

## Technical Details

### Changes to `src/lib/alcorFarms.ts`:

**`fetchUserPositionsOnChain` enhancement:**
- Collect unique pool IDs from positions
- Batch-fetch pool details via `fetchPoolDetailsOnChain`
- Use pool token data to set position `amountA`/`amountB` with correct symbols and contracts

**`fetchUserPositions` cross-validation:**
- Same pattern as `fetchUserStakedFarms`: if API returns empty array, check blockchain
- If blockchain has positions, use blockchain data

**New export from `fetchUserStakedFarmsWithDetails`:**
- Return both `{ farms, positions }` so the hook can reuse positions without double-fetching

### Changes to `src/hooks/useAlcorFarms.ts`:

- Consume positions from `fetchUserStakedFarmsWithDetails` result instead of making a separate `fetchUserPositions` call
- Only call `fetchUserPositions` as a fallback if the combined function doesn't return positions
- This eliminates the race condition where one parallel call gets API data and the other gets blockchain data

