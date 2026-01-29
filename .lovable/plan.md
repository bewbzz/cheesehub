
# Fix: Prevent Sample Tracks from Hiding Full Tracks in CHEESEAmp

## Problem

The CHARLY RELEASE shows only the 1-minute sample instead of the full track. This is caused by the stacking logic that groups NFTs by `template_id` alone.

When an artist mints both a sample/clip AND a full track under the same template (or with the same template_id), the current stacking logic:

1. Groups them together
2. Picks the **lowest mint number** as the representative
3. Hides the higher mint - which could be the full track

## Solution

Update the stacking key to differentiate tracks by their actual audio content, not just template_id. NFTs with different audio URLs should NOT be stacked together, even if they share the same template.

## Technical Changes

### File: `src/hooks/useMusicNFTs.ts`

**Update the stacking key** from:

```typescript
const key = nft.template_id || nft.asset_id;
```

**To:**

```typescript
// Use template + audioUrl as key to prevent stacking tracks with different audio content
// This ensures a sample and full track (same template, different audio) are shown separately
const audioIdentifier = nft.audioUrl ? nft.audioUrl.slice(-32) : ''; // Last 32 chars of IPFS hash
const key = (nft.template_id || nft.asset_id) + '_' + audioIdentifier;
```

This means:
- Same template + same audio = stacked (copies of the same track)
- Same template + different audio = shown separately (sample vs full)

## Why This Works

| Scenario | Old Key | New Key | Result |
|----------|---------|---------|--------|
| 2 copies of same track | `template123` | `template123_abc123` | Correctly stacked |
| Sample + Full track (same template) | `template123` | `template123_sample` vs `template123_full` | Shown separately |
| Different templates | `templateA` vs `templateB` | `templateA_xyz` vs `templateB_xyz` | Shown separately |

## Additional Enhancement (Optional)

Add a visual indicator to distinguish sample vs full tracks:

```typescript
// In MusicNFT interface
isSample?: boolean; // True if audioUrl matches clipUrl

// When creating NFT object
isSample: allData.clip && allData.audio && allData.clip === allData.audio,
```

This would allow showing a "Sample" badge in the UI.

## Expected Outcome

After this fix:
- CHARLY RELEASE will show BOTH the sample AND the full track as separate entries
- Users can choose which version to play
- Stacking still works correctly for true duplicates (same template AND same audio)
