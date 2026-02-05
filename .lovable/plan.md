
# Fix: DropDetail Page Missing `isVideo` Flag

## Problem Identified

The **detail page** (`DropDetail.tsx`) fetches drops using `fetchDropById()`, which internally calls `fetchTemplateById()`. However, `fetchTemplateById()` does **NOT** use the same `getMediaUrl()` helper as the batch enrichment.

**Current `fetchTemplateById` code (line 1030):**
```typescript
image: getImageUrl(data.img || data.image), // ❌ No video fallback!
```

**What it should do (like `fetchTemplatesBatch`):**
```typescript
const media = getMediaUrl(data);
return {
  image: media.url,
  isVideo: media.isVideo,  // ✅ Include video flag
};
```

This means:
- **Grid view** (uses `enrichDropTemplates` → `fetchTemplatesBatch`): Gets `isVideo` flag ✅
- **Detail page** (uses `fetchDropById` → `fetchTemplateById`): Missing `isVideo` flag ❌

---

## Solution

### 1. Update `fetchTemplateById` Return Type

Add `isVideo` to the return type:

```typescript
export async function fetchTemplateById(
  templateId: string,
  collectionName?: string
): Promise<{ name: string; image: string; maxSupply: number; issuedSupply: number; isVideo?: boolean } | null>
```

### 2. Use `getMediaUrl` Helper in `fetchTemplateById`

Replace the hardcoded image extraction with the helper that checks video fields:

```typescript
// Before (line 1030):
image: getImageUrl(data.img || data.image),

// After:
const media = getMediaUrl(data);
return {
  name: data.name || template.name || `Template #${templateId}`,
  image: media.url,
  isVideo: media.isVideo,
  maxSupply: parseInt(template.max_supply) || 0,
  issuedSupply: parseInt(template.issued_supply) || 0,
};
```

### 3. Pass `isVideo` Through in `fetchDropById`

Update the return statement to include the flag:

```typescript
// In fetchDropById (around line 761-766):
if (templateData) {
  return {
    ...baseDrop,
    image: templateData.image || baseDrop.image,
    name: templateData.name || baseDrop.name,
    isVideo: templateData.isVideo,  // ✅ Add this
  };
}
```

---

## File Changes

| File | Lines | Changes |
|------|-------|---------|
| `src/services/atomicApi.ts` | 1012 | Update return type to include `isVideo?: boolean` |
| `src/services/atomicApi.ts` | 1028-1033 | Use `getMediaUrl(data)` instead of `getImageUrl(data.img \|\| data.image)` |
| `src/services/atomicApi.ts` | 761-766 | Pass `isVideo` from templateData to returned drop |

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| AlienSkullMa in grid | Shows "Video NFT" placeholder or image | Shows image (via img tag) |
| AlienSkullMa detail page | White square (no isVideo flag) | Shows image correctly |
| Actual video NFT in grid | Shows placeholder | Shows placeholder, clicking shows video |
| Actual video NFT detail | White square | Tries image, falls back to video player |

---

## Technical Summary

The fix ensures both code paths (batch enrichment AND individual fetch) use the same `getMediaUrl()` helper to:
1. Check for `img`/`image` fields first
2. Fall back to `video` field if no image
3. Return `isVideo: true` when content comes from video field

This allows the UI to try loading as an image first, then fall back to video player if the image fails.
