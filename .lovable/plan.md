

## Add Banner Ads to All Pages via Layout

### What changes

Instead of importing `<BannerAd />` into every individual page, add it once to the shared `Layout` component. This way it automatically appears on every page that uses `Layout` (Home, CHEESEUp, CHEESENull, CHEESEFarm, CHEESEDao, CHEESEDrop, CHEESELock, and the BannerAds marketplace itself).

### Changes

**File: `src/components/Layout.tsx`**
- Import `BannerAd` from `@/components/home/BannerAd`
- Render `<BannerAd />` inside `<main>` just before `{children}`

**File: `src/pages/Index.tsx`**
- Remove the `<BannerAd />` import and usage from the home page (since Layout now handles it globally, avoiding duplicate banners)

### Result
- Banner ads appear consistently across all pages
- No duplicate rendering on the home page
- Zero additional API calls -- the `useBannerAds` hook shares its cached query across all mounts via React Query

