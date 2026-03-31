

## Show Card Back (Multiple Images) in Detail Dialog

### Discovery
GPK Topps cards typically store a front image as `img`/`image` and a back image as `backimg` in their `idata`/`mdata`. The current detail dialog only shows the front image.

### Changes

**`src/hooks/useSimpleAssets.ts`**
- Add a helper `resolveAllImages` that scans the combined metadata for all image-like keys (`img`, `image`, `icon`, `backimg`, `back`, `img2`, etc.) and returns an array of resolved URLs
- Add an `images: string[]` field to the `SimpleAsset` interface (front first, back second, any others after)

**`src/components/simpleassets/SimpleAssetDetailDialog.tsx`**
- Replace the single image display with a gallery that shows front and back
- Add a "Flip" button or left/right arrows to navigate between images
- Show a label like "Front" / "Back" and a dot indicator for which image is active
- Each image gets the same IPFS gateway fallback logic

### Files modified: 2
- `src/hooks/useSimpleAssets.ts`
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx`

