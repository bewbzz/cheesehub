
# Fix: Show Both Sample and Full Track from Single NFT

## Root Cause Found

The issue is NOT stacking - it's that when an NFT contains **both** a full track and a sample, only ONE entry is created. The current code picks `audio || clip || video` and uses only the first available field.

When an NFT has:
- `audio` field = full track (e.g., 4 minutes)
- `clip` field = sample (e.g., 1 minute)

We currently create only ONE `MusicNFT` object using `audio`, ignoring the `clip` entirely as a playable item.

If the user is seeing *only* the sample, it means:
- Either `audio` field is empty/missing and we're falling back to `clip`
- OR the full track is in a non-standard field we're not checking

## Solution

Create **separate library entries** when an NFT has both `audio` AND `clip` fields with different content. This allows users to play either version.

## Technical Changes

### File: `src/hooks/useMusicNFTs.ts`

### 1. Update `fetchApiPage` and `fetchAssetMetadata` functions

Instead of creating one `MusicNFT` per asset, create multiple entries when the NFT has both full audio and clip:

```typescript
// Helper to create MusicNFT entries from asset data
function createMusicNFTsFromAsset(asset: any, allData: Record<string, unknown>): MusicNFT[] {
  const results: MusicNFT[] = [];
  const videoUrl = allData.video ? getMediaUrl(allData.video as string) : undefined;
  const clipUrl = allData.clip ? getMediaUrl(allData.clip as string) : undefined;
  const fullAudioUrl = allData.audio ? getMediaUrl(allData.audio as string) : undefined;
  
  const baseNFT = {
    name: asset.name || allData.name || 'Untitled Track',
    title: allData.title as string | undefined,
    artist: allData.artist as string | undefined,
    album: allData.album as string | undefined,
    genre: allData.genre as string | undefined,
    coverArt: getMediaUrl((allData.img || allData.image) as string | undefined),
    backCover: allData.backimg ? getMediaUrl(allData.backimg as string) : undefined,
    duration: allData.duration ? parseInt(String(allData.duration)) : undefined,
    collection: asset.collection?.collection_name || '',
    schema: asset.schema?.schema_name || '',
    template_id: asset.template?.template_id || '',
    mint: asset.template_mint || '',
  };

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

  // Add separate clip entry if clip exists AND is different from audio
  if (clipUrl && clipUrl !== fullAudioUrl) {
    results.push({
      ...baseNFT,
      asset_id: `${asset.asset_id}-clip`, // Unique ID for the clip version
      audioUrl: clipUrl,
      clipUrl: undefined, // This IS the clip
      videoUrl: undefined,
      hasVideo: false,
      name: `${baseNFT.name} (Sample)`, // Mark as sample
    });
  }

  // Fallback: if no audio and no clip, try video with music metadata
  if (results.length === 0 && videoUrl && (allData.artist || allData.title)) {
    results.push({
      ...baseNFT,
      asset_id: asset.asset_id,
      audioUrl: videoUrl,
      clipUrl,
      videoUrl,
      hasVideo: true,
    });
  }

  return results;
}
```

### 2. Update the stacking function

The stacking key already uses `audioUrl` (from my previous fix), which will correctly keep the sample and full track separate since they have different audio URLs.

### 3. Update ownership validation

When validating against on-chain ownership, strip the `-clip` suffix to match the real asset ID:

```typescript
const realAssetId = nft.asset_id.replace(/-clip$/, '');
if (ownedAssetIds.has(realAssetId)) { ... }
```

## Expected Outcome

| NFT Metadata | Before | After |
|-------------|--------|-------|
| Has `audio` only | 1 entry (full) | 1 entry (full) |
| Has `clip` only | 1 entry (sample) | 1 entry (sample) |
| Has both `audio` + `clip` (different) | 1 entry (full only) | 2 entries: full + sample |
| Has both but same URL | 1 entry | 1 entry (no duplicate) |

After this fix:
- CHARLY RELEASE will show both the full track AND the sample as separate entries
- "Fly High My Polow" will also show both versions
- Users can choose which version to play
- Samples are clearly labeled with "(Sample)" suffix

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMusicNFTs.ts` | Add helper function, update both fetch functions, update ownership check |
