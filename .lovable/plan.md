
# Fix: Properly Handle NFTs with Only Clip Field (No Audio)

## Problem Identified

The current logic labels ALL tracks from the `clip` field as "(Sample)" - even when `clip` is the ONLY audio source. This means:

- If NFT has `audio` + `clip` (different) → works correctly: 2 entries
- If NFT has ONLY `audio` → works correctly: 1 entry (full track)
- If NFT has ONLY `clip` → **BUG**: 1 entry labeled "(Sample)" when it should be the main track

For the CHARLY RELEASE and "Fly High My Polow" NFTs, the likely scenario is that these NFTs:
- Have no `audio` field OR an empty `audio` field
- Only have a `clip` field
- The code creates an entry with "(Sample)" suffix incorrectly

## Root Cause

```text
Line 165-176: Creates sample entry when clip !== audio
```

When `audio` is undefined/empty and only `clip` exists:
- `fullAudioUrl` = undefined
- `clipUrl !== fullAudioUrl` = true (since clip !== undefined)
- Creates entry with "(Sample)" suffix

## Solution

Change the logic to only label tracks as "(Sample)" when BOTH `audio` AND `clip` exist with different content. If only `clip` exists (no `audio`), treat it as the main track without the sample label.

## Technical Changes

### File: `src/hooks/useMusicNFTs.ts`

Update `createMusicNFTsFromAsset` function:

```typescript
// Add full track entry if audio field exists
if (fullAudioUrl) {
  results.push({
    ...baseNFT,
    asset_id: asset.asset_id,
    audioUrl: fullAudioUrl,
    clipUrl,
    videoUrl,
    hasVideo: !!videoUrl,
  });
}

// Add clip entry - only label as "Sample" if BOTH audio and clip exist
if (clipUrl && clipUrl !== fullAudioUrl) {
  // Only mark as sample if there's ALSO a full audio track
  const isSample = !!fullAudioUrl;
  results.push({
    ...baseNFT,
    asset_id: isSample ? `${asset.asset_id}-clip` : asset.asset_id,
    audioUrl: clipUrl,
    clipUrl: undefined,
    videoUrl: isSample ? undefined : videoUrl,
    hasVideo: isSample ? false : !!videoUrl,
    name: isSample ? `${baseNFT.name} (Sample)` : baseNFT.name,
  });
}
```

## Additional Fix: Clear Stale Cache

Since the user already has cached data from before the fix, we should also invalidate the cache. Two options:

1. **Change cache key version** - Add a version number to force re-fetch
2. **User action** - Have user clear browser storage

I recommend option 1 to ensure all users get fresh data.

Update cache key:
```typescript
const CACHE_KEY_PREFIX = 'cheesehub_music_nfts_v2_'; // Changed from v1
```

## Expected Outcome

| NFT Metadata | Before Fix | After Fix |
|-------------|------------|-----------|
| Has `audio` only | 1 entry (full) | 1 entry (full) ✓ |
| Has `clip` only | 1 entry labeled "(Sample)" ❌ | 1 entry (main track) ✓ |
| Has both `audio` + `clip` | 2 entries (full + sample) | 2 entries (full + sample) ✓ |

After this fix:
- CHARLY RELEASE will show full track (not labeled as sample)
- "Fly High My Polow" will show correctly
- NFTs with both versions will show both entries correctly
- Cache will be invalidated so fresh data loads immediately

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMusicNFTs.ts` | Fix sample labeling logic, bump cache version |
