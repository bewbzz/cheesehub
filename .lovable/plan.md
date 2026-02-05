

# Fix Video-Only NFT Display (White Squares Issue)

## Problem Identified

After investigation, I found the root cause of the consistent white squares:

### The Issue

Some NFT templates don't have an `img` field at all - they only have `video` fields. For example, the "Spectral Sessions" NFTs from `cbreakgaming`:

```json
{
  "immutable_data": {
    "name": "ABSTRACT CHAOTIC UNPREDICTABLE...",
    "video": "QmX3yvZupaup7JKUL5gdCpRcLUqfu6PmQfJTsmi4fqBUDU",
    "video2": "QmRnQygGWX1J3aSN7SsuuANL9YgJzexRrWjEirUG8BoZ8K"
    // NO img or image field!
  }
}
```

### Current Code Limitation

The `getImageUrl()` function only checks for `img` and `image` fields:

```typescript
image: getImageUrl(data.img || data.image),  // Returns placeholder if both are undefined
```

### NFTHive's Approach

Looking at NFTHive, they display video-only drops with a dark placeholder in grid view (visible in the screenshot where "Spectral Sessions" cards have no image).

---

## Solution: Video Fallback with Proper Placeholder Handling

### Strategy

1. **Update `getImageUrl()` to accept video fallback** - Try `video` field as IPFS content when no image exists
2. **Detect video-only NFTs and mark them** - Pass a flag indicating this is a video NFT
3. **Show appropriate placeholder for video NFTs** - Display a video icon overlay or dark background instead of "Retry" button
4. **Track known video-only template patterns** - Avoid repeatedly trying to load videos as images

---

## Implementation Details

### 1. Update `fetchTemplatesBatch` to Check Video Fields

In `src/services/atomicApi.ts`, expand the image extraction logic:

```typescript
// New helper function to get media URL (image or video fallback)
function getMediaUrl(data: Record<string, string>): { url: string; isVideo: boolean } {
  // Try standard image fields first
  const imageField = data.img || data.image;
  if (imageField) {
    return { url: getImageUrl(imageField), isVideo: false };
  }
  
  // Fallback to video field (common in video NFTs)
  const videoField = data.video;
  if (videoField) {
    // Return video URL - we'll handle it specially in the card
    return { url: getImageUrl(videoField), isVideo: true };
  }
  
  return { url: '/placeholder.svg', isVideo: false };
}
```

Update `fetchTemplatesBatch`:

```typescript
results.set(key, {
  name: data.name || template.name || `Template #${template.template_id}`,
  image: getMediaUrl(data).url,
  isVideo: getMediaUrl(data).isVideo,  // New flag
});
```

### 2. Update NFTDrop Type

In `src/types/drop.ts`, add the `isVideo` field:

```typescript
export interface NFTDrop {
  // ... existing fields
  isVideo?: boolean;  // True if this NFT only has video content (no image)
}
```

### 3. Update DropCard to Handle Video NFTs

In `src/components/drops/DropCard.tsx`, detect video NFTs and show appropriate UI:

```typescript
// In the image section of the card
{drop.isVideo ? (
  // Show video placeholder with play icon instead of Retry button
  <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30">
    <Film className="h-12 w-12 text-muted-foreground/50" />
    <span className="mt-2 text-xs text-muted-foreground">Video NFT</span>
  </div>
) : imageError ? (
  // Existing retry UI
  <div className="flex h-full w-full flex-col items-center justify-center gap-2">
    <ImageOff className="h-12 w-12 text-muted-foreground/50" />
    <Button variant="ghost" size="sm" onClick={handleRetry}>
      <RotateCw className="mr-1 h-3 w-3" />
      Retry
    </Button>
  </div>
) : (
  // Normal image loading
  <img src={displayImageUrl} ... />
)}
```

### 4. Update Enrichment Functions

Update all places that call `getImageUrl(data.img || data.image)` to use the new `getMediaUrl` helper:

| File | Lines to Update |
|------|-----------------|
| `src/services/atomicApi.ts` | Lines 167, 253, 302, 628, 671, 1008 |
| `src/hooks/useUserNFTs.ts` | Lines 153, 202, 265 |

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/services/atomicApi.ts` | Add `getMediaUrl()` helper, update batch and individual template fetching to detect video NFTs |
| `src/types/drop.ts` | Add `isVideo?: boolean` to `NFTDrop` interface |
| `src/components/drops/DropCard.tsx` | Add video NFT detection and show Film icon placeholder instead of Retry |
| `src/hooks/useEnrichDrops.ts` | Pass `isVideo` flag through enrichment cache |

---

## Expected Results

| Before | After |
|--------|-------|
| Video NFTs show "Retry" button that never works | Video NFTs show "Video NFT" placeholder with film icon |
| Same drops always fail on every page load | Proper detection - no wasted network requests |
| Confusing UX for users | Clear indication that this is intentional (video content) |

---

## Technical Notes

- **No video playback in grid view** - Like NFTHive, we show a placeholder in grid view. Video can be played in detail view if needed later.
- **Minimal performance impact** - Detection happens during batch fetch, not per-card rendering
- **IPFS video hashes work as images for some videos** - MP4 files won't display, but video thumbnails stored as IPFS might. The code tries to load them and falls back gracefully.

