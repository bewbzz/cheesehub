

## Fix Shared Banner Error and Center Ads

### Problem 1: React Error
The `SharedBannerRotator` crashes because it accesses `banners[1]` which can be `undefined` when only one shared banner exists. When `activeIdx` flips to 1, `displayBanner` becomes `undefined` and `BannerImage` crashes trying to read `banner.ipfsHash`.

### Problem 2: Centering
The 2-column grid needs `justify-items-center` to center the ads so the gap between them aligns above the floating orb.

### Changes

**`src/components/home/BannerAd.tsx`**

1. **SharedBannerRotator** -- Guard against single-banner arrays:
   - If `banners.length < 2`, render a single `BannerImage` (no rotation, no dots)
   - Only run the rotation interval and dot indicators when there are 2 banners

2. **Grid centering** -- Add `justify-items-center` to the 2-column grid (line 128) so both ads center within their cells and the gap sits in the middle of the page above the orb.

### Technical Details

```typescript
// SharedBannerRotator fix
function SharedBannerRotator({ banners }: { banners: ActiveBanner[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    }, 30000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length < 2) {
    return <BannerImage banner={banners[0]} isShared={true} />;
  }

  const displayBanner = activeIdx === 0 ? banners[0] : banners[1];
  // ... rest with dots
}
```

Grid centering change on line 128:
```
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
```
