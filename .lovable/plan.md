

# Fix: Banner Content Not Carrying Over Between Consecutive Rental Days

## Problem
When a user rents multiple consecutive days, each day is a separate on-chain row. The banner content (IPFS hash, website URL) only gets set on the first day's row. Subsequent days show the user as the renter but have empty content fields, causing the banner to disappear.

On-chain data confirms this:
- Day 1 (1772114400): `user=cheesepromoz`, `ipfs_hash=bafkrei...` (content present)
- Day 2 (1772200800): `user=cheesepromoz`, `ipfs_hash=""` (empty -- banner disappears)

## Root Cause
The display filter in `useBannerAds.ts` line 58 requires `row.ipfs_hash.length > 0`. This is correct behavior for unrented slots, but breaks for multi-day rentals where content wasn't duplicated to each row.

## Solution
In `useBannerAds.ts`, after fetching all rows, if a current-window slot is rented (user !== contract) but has empty `ipfs_hash`, look backwards through the fetched rows for the most recent slot with the **same user and position** that has content, and inherit that content.

## Technical Changes

### File: `src/hooks/useBannerAds.ts`

1. After fetching rows and before filtering for active slots, build a lookup of content by user+position from all rows (sorted by time descending)
2. For any active-window row where `user !== BANNER_CONTRACT` but `ipfs_hash` is empty, find the nearest previous row with the same user+position that has content
3. Inherit `ipfs_hash`, `website_url`, `rental_type`, `shared_user`, `shared_ipfs_hash`, and `shared_website_url` from that previous row
4. Then apply the existing active filter (which will now pass since ipfs_hash is populated)

The logic is approximately:
```text
For each row in the current 24h window where user is set but ipfs_hash is empty:
  - Search all fetched rows (earlier times, same position, same user) for one with content
  - Copy ipfs_hash and website_url from that row
  - Then proceed with normal filtering
```

This is a frontend-only fix that works around the contract behavior without requiring any on-chain changes. The contract could also be updated later to copy content during multi-day rentals, but this fix provides immediate relief.

