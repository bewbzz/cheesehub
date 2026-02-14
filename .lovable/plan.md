

# Fix Alcor Farm Manager Flickering

## Problem
The Alcor Farm Manager alternates between showing "staked in all positions" and "unstaked from all positions" on every refetch cycle. The data source indicator also incorrectly shows "Connected to API" even when blockchain fallback was used.

## Root Cause

Two bugs in `src/lib/alcorFarms.ts`:

1. **Empty API response treated as failure** (line 391): When the Alcor API returns an empty array `[]`, the code falls through to the blockchain fallback. The Alcor API is intermittently returning empty results, causing data to flip between "no farms" (API) and "14 farms" (blockchain) on alternating refetch cycles.

2. **Global data source race condition**: `lastDataSource` is a single global variable set by whichever of `fetchUserStakedFarms`, `fetchUserPositions`, or `fetchPoolDetails` finishes last. Since these run in parallel, the indicator is unreliable.

## Solution

### 1. Fix `fetchUserStakedFarms` in `src/lib/alcorFarms.ts`
- Accept empty API arrays as valid responses (the user might genuinely have no farms)
- BUT: cross-validate with blockchain -- if API says empty, do a quick blockchain check to confirm
- If blockchain finds stakes but API returned empty, use blockchain data (API was stale)

### 2. Fix data source tracking
- Change `lastDataSource` from a single global to a per-function tracker, or return it alongside data so each caller knows its own source
- In `fetchUserStakedFarmsWithDetails`, track which source was used for the staked farms specifically (since that's the critical data)

### 3. Increase staleTime to reduce flickering
- In `useAlcorFarms.ts`, increase `staleTime` from 10s to 30s to match refetchInterval, preventing redundant refetches that amplify the flickering

## Technical Details

**File: `src/lib/alcorFarms.ts`**
- `fetchUserStakedFarms`: When API returns empty `[]`, verify against blockchain stakes table before accepting it as truth. If blockchain has stakes, use blockchain data and log a warning about stale API.
- Replace global `lastDataSource` with a result object pattern: functions return `{ data, source }` internally.

**File: `src/hooks/useAlcorFarms.ts`**  
- Update `staleTime` from 10s to 30s
- Consume the new source tracking from the library functions

