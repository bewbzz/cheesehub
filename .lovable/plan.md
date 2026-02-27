

## Fix Single Banner Fitting Snugly

### Problem
When only one banner slot is rented, the wrapper uses `max-w-[50%] mx-auto` which creates a container wider than the 580px image, leaving visible empty space inside the bordered box.

### Solution
Change the single-banner wrapper from `max-w-[50%]` to `w-fit` so the container shrinks to exactly match the 580px image width, keeping it centered with `mx-auto`.

### Change

**File: `src/components/home/BannerAd.tsx` (line 151)**

Replace:
```tsx
<div className="max-w-[50%] mx-auto max-md:max-w-full">
```
With:
```tsx
<div className="w-fit mx-auto max-md:max-w-full">
```

This makes the wrapper shrink-wrap to the image's intrinsic 580px width so the border fits snugly around the banner.

