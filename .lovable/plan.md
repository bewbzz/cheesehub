

# Fix Image-in-Video-Field Detection

## Problem Identified

The "AlienSkullMa SKG1VK4" NFT has its image stored in the `video` field instead of `img`:

```json
{
  "immutable_data": {
    "name": "AlienSkullMa SKG1VK4",
    "video": "QmPxz55p4ZP4o5LAQrdKpwxNWAUxnZQnB6gstdm9P8odVE",  // This is actually a PNG!
    "rarity": "Extra Mystery",
    "back_img": "QmZjy7P8cysjrsKQUsHMT37P65aqYsYumUrzpxhb6aXPp2",
    "generation": "V4"
    // NO img field!
  }
}
```

The IPFS hash in the `video` field is actually an **image file**, not a video. Our current code incorrectly assumes anything in a `video` field is video content and shows a video placeholder/player.

---

## Solution: Try Image First, Fall Back to Video

Since we can't know the content type from the field name alone, we should:

1. **Always try to load the content as an image first** in the UI
2. **If the `<img>` tag loads successfully**, display it as an image
3. **If the `<img>` tag fails** and the content came from a video field, try as video

This is better than trying to detect content type beforehand because:
- No extra network requests needed
- The browser's native handling tells us what works
- Same behavior as NFTHive (they load images from video fields)

---

## Implementation

### 1. Change `isVideo` to `fromVideoField`

Rename the flag to indicate source, not content type:

```typescript
// src/services/atomicApi.ts
function getMediaUrl(data: Record<string, string>): { url: string; fromVideoField: boolean } {
  const imageField = data.img || data.image;
  if (imageField) {
    return { url: getImageUrl(imageField), fromVideoField: false };
  }
  
  const videoField = data.video;
  if (videoField) {
    return { url: getImageUrl(videoField), fromVideoField: true }; // Might be image OR video
  }
  
  return { url: '/placeholder.svg', fromVideoField: false };
}
```

### 2. Update DropCard - Try Image First

In grid view, always try loading as `<img>` first:

```typescript
// src/components/drops/DropCard.tsx
// Remove the video placeholder - always try image first
// Only show Film icon if image load fails AND it's from a video field
{imageError && drop.isVideo ? (
  // Only show video placeholder if image failed and came from video field
  <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30">
    <Film className="h-12 w-12 text-muted-foreground/50" />
    <span className="mt-2 text-xs text-muted-foreground">Video NFT</span>
  </div>
) : imageError ? (
  // Regular image error - show retry
  <div className="...">...</div>
) : (
  // Normal image loading - works for images stored in video field too!
  <img src={displayImageUrl} ... />
)}
```

### 3. Update DropDetail - Image First with Video Fallback

On detail page, try image first. If it fails and source is video field, try video player:

```typescript
// src/pages/DropDetail.tsx
const [mediaType, setMediaType] = useState<'loading' | 'image' | 'video' | 'error'>('loading');

const handleImageLoad = () => setMediaType('image');
const handleImageError = () => {
  if (drop.isVideo) {
    setMediaType('video'); // Try video player as fallback
  } else {
    setMediaType('error');
  }
};
const handleVideoError = () => setMediaType('error');

// Render logic:
{mediaType === 'loading' && <LoadingSpinner />}
{mediaType === 'image' && <img src={url} ... />}
{mediaType === 'video' && (
  <video src={url} controls autoPlay muted playsInline ... />
)}
{mediaType === 'error' && <RetryButton />}
```

---

## File Changes

| File | Changes |
|------|---------|
| `src/types/drop.ts` | Keep `isVideo` field (means "from video field", not "is video content") |
| `src/services/atomicApi.ts` | No changes needed - `getMediaUrl` logic is correct |
| `src/components/drops/DropCard.tsx` | Try image first, only show video placeholder if image fails |
| `src/pages/DropDetail.tsx` | Try image first, fall back to video player if fails |

---

## Expected Results

| NFT Type | Before | After |
|----------|--------|-------|
| Image in `img` field | ✅ Works | ✅ Works |
| Image in `video` field (like AlienSkullMa) | ❌ White square | ✅ Shows image |
| Actual video in `video` field | ⚠️ Video placeholder | ✅ Tries image, falls back to video |
| No media at all | Placeholder | Placeholder |

---

## Technical Details

The key insight is: **browsers know how to handle content types automatically**.

- An `<img>` tag will fail to load a video file
- A `<video>` tag will fail to play an image file
- We can use these failures to detect the actual content type

This is exactly what NFTHive does - they don't pre-detect content type, they just try to load and handle failures gracefully.

