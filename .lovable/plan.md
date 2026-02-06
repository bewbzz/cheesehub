
# Fix: Video NFT Detection and Display in CHEESEDrops

## Problem Summary

Multiple NFTs are incorrectly marked as "Video NFTs" and display:
- **Grid view**: Shows "Video NFT" placeholder with Film icon (no image)
- **Detail view**: Shows empty white box (nothing renders)

## Root Cause

The `getMediaUrl` function in `atomicApi.ts` marks NFTs as `isVideo: true` when they have no `img`/`image` field but have a `video` field. However, many NFT creators store **actual images** (PNGs, JPGs) in the `video` metadata field.

Current flawed logic:
```text
1. Check for img/image field → use it, isVideo: false
2. No image? Check video field → use it, isVideo: true  ← ASSUMES video content
3. No media found → placeholder
```

The problem: When `isVideo: true`, the DropCard shows a placeholder instead of trying to load the image, and DropDetail tries a `<video>` player which fails silently for image files.

## Solution: Image-First Fallback Strategy

Instead of assuming the `video` field contains video content, we should:
1. Always try loading the URL as an image first (regardless of source field)
2. If image loading fails AND the content is actually a video (detected by extension or browser), then render as video
3. This matches how browsers naturally handle media

## Implementation

### Change 1: Update DropCard to always try image first

The DropCard should NOT show the "Video NFT" placeholder immediately. Instead:
1. Try loading as `<img>` (current behavior, but don't skip for isVideo)
2. If image fails AND isVideo is true AND URL has video extension → show video placeholder
3. Otherwise show retry button

**File: `src/components/drops/DropCard.tsx`**

| Lines | Change |
|-------|--------|
| 239-244 | Only show "Video NFT" placeholder if URL has video extension (`.mp4`, `.webm`, `.mov`) |

```typescript
// Helper to check if URL is likely a video file
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// In render:
{imageError && drop.isVideo && isVideoUrl(currentImageUrl) ? (
  // Only show video placeholder if URL actually looks like a video
  <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30">
    <Film className="h-12 w-12 text-muted-foreground/50" />
    <span className="mt-2 text-xs text-muted-foreground">Video NFT</span>
  </div>
) : imageError ? (
  // Image error (could be video field with image content) - show retry
  <div className="flex ...">
    <ImageOff ... />
    <Button onClick={handleRetry}>Retry</Button>
  </div>
) : (
  // Normal image loading
  <img ... />
)}
```

### Change 2: Update DropDetail to detect actual video content

The detail page should only switch to video mode if the image load failed AND we can confirm it's actually a video file.

**File: `src/pages/DropDetail.tsx`**

| Lines | Change |
|-------|--------|
| 156-173 | Only set mediaType to 'video' if URL has video extension |
| 315-326 | Keep video player logic, but it will only trigger for actual videos now |

```typescript
// Helper function (add near top of file)
const isVideoUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// In handleImageError:
const handleImageError = useCallback(() => {
  if (!imageUrl) return;
  const hash = extractIpfsHash(imageUrl);
  if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
    // Try next gateway
    const nextIndex = gatewayIndex + 1;
    setGatewayIndex(nextIndex);
    setCurrentImageUrl(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    setImageLoaded(false);
  } else {
    // All gateways exhausted
    // Only switch to video mode if URL actually looks like a video file
    if (drop?.isVideo && isVideoUrl(imageUrl)) {
      setMediaType('video');
    } else {
      setImageError(true);
      setMediaType('error');
    }
  }
}, [imageUrl, gatewayIndex, drop?.isVideo]);
```

### Change 3: Optional - Add content-type detection for better accuracy

For NFTs where the file extension doesn't indicate the type, we could add a HEAD request to check the Content-Type. This is optional but improves accuracy.

**File: `src/services/atomicApi.ts`**

Add a helper that can be used to detect actual media type:

```typescript
// Optional: Detect actual content type via HEAD request
export async function detectMediaType(url: string): Promise<'image' | 'video' | 'unknown'> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/drops/DropCard.tsx` | Add `isVideoUrl` helper, only show video placeholder for actual video URLs |
| `src/pages/DropDetail.tsx` | Add `isVideoUrl` helper, only switch to video player for actual video URLs |
| `src/services/atomicApi.ts` | (Optional) Add `detectMediaType` helper for content-type detection |

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| NFT with image in `video` field | Shows "Video NFT" placeholder | Shows the actual image |
| NFT with image in `video` field (detail) | Empty white box | Shows the actual image |
| Actual video NFT (.mp4 URL) | Shows "Video NFT" placeholder | Shows "Video NFT" placeholder (unchanged) |
| Actual video NFT (detail) | Shows video player | Shows video player (unchanged) |

## Technical Notes

- The fix is conservative: we only trust `isVideo: true` if the URL actually looks like a video file
- IPFS URLs without extensions will be treated as images (most common case)
- If an actual video doesn't have an extension, users can still click "Retry" and the image will eventually fail, showing the error state
- Future enhancement: Use HEAD request to detect Content-Type for ambiguous URLs
