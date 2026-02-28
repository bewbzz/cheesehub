

## Fix: Shared Banner Slot Not Displaying

### Problem
Position 2 for Feb 28 is a shared slot with both primary and secondary renters, but it's not showing on the homepage. The `BannerAd.tsx` component expects shared banners to appear as **two separate entries** in the array (to form a rotation pair), but `useBannerAds.ts` returns shared data embedded in a **single** `ActiveBanner` object. The filter `pair.length === 2` excludes it.

### Root Cause
In `BannerAd.tsx` line ~109:
```
...[...sharedByPosition.values()].filter((pair) => pair.length === 2).map(...)
```
This requires 2 separate `ActiveBanner` objects per position for shared slots, but only 1 is returned.

### Fix: Emit Two Banners for Shared Slots in `useBannerAds.ts`

When a shared slot has both a primary user and a shared user (with content), emit **two** `ActiveBanner` objects:

1. The primary renter's banner (existing)
2. A second banner for the shared renter, constructed from `shared_ipfs_hash` and `shared_website_url`

This makes the data structure match what `BannerAd.tsx` expects for its `SharedBannerRotator` component, which rotates between the two every 30 seconds.

### Changes

**`src/hooks/useBannerAds.ts`** -- In the `.map()` that converts rows to `ActiveBanner[]`, use `.flatMap()` instead. For each row:
- Always emit the primary banner
- If `displayMode === "shared"` and `sharedIpfsHash` has content, emit a second banner with the shared user's data

**`src/components/home/BannerAd.tsx`** -- Remove the `pair.length === 2` filter. A shared position with only 1 renter (no second renter yet) should still display as a normal banner. Change the filter to `pair.length >= 1` so single shared banners show too (they'll render as a regular `BannerImage` since `SharedBannerRotator` is only used when there are 2).

### Technical Details

In `useBannerAds.ts`, the mapping changes from `.map()` to `.flatMap()`:
```typescript
return active.flatMap((row) => {
  const primary = {
    time: row.time,
    position: row.position,
    user: row.user,
    ipfsHash: row.ipfs_hash,
    websiteUrl: row.website_url,
    rentalType: row.rental_type === 1 ? "shared" : "exclusive",
    displayMode: row.rental_type === 1 && row.shared_user && row.shared_user !== BANNER_CONTRACT ? "shared" : "full",
  };
  
  // If shared with a second renter who has content, emit second banner
  if (primary.displayMode === "shared" && row.shared_ipfs_hash?.length > 0) {
    const secondary = {
      ...primary,
      user: row.shared_user,
      ipfsHash: row.shared_ipfs_hash,
      websiteUrl: row.shared_website_url,
    };
    return [primary, secondary];
  }
  
  return [primary];
});
```

In `BannerAd.tsx`, change the shared pair filter:
```typescript
// Before: .filter((pair) => pair.length === 2)
// After:  .filter((pair) => pair.length >= 1)
```

### Result
- Position 1 (exclusive): displays as full banner
- Position 2 (shared, both renters): displays with 30s rotation between the two banners
- Both positions show side-by-side in the 2-column grid instead of a single centered banner

