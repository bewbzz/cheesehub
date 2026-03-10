

## Bug: Shared Banner Rotation — Both Ads Link to Same Site

### Root Cause
In `SharedBannerRotator`, both banners are always rendered in the DOM. The second banner is positioned `absolute inset-0` on top of the first. Even when it has `opacity-0`, it still captures click events — so clicking either banner always navigates to the second banner's URL.

### Fix
Add `pointer-events-none` to the inactive banner so clicks pass through to the visible one.

### Changes — `src/components/home/BannerAd.tsx`

Update the two overlay `div`s in `SharedBannerRotator`:

```tsx
<div
  className={`transition-opacity duration-[6000ms] ${activeIdx === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
>
  <BannerImage banner={banners[0]} isShared={true} />
</div>
<div
  className={`absolute inset-0 transition-opacity duration-[6000ms] ${activeIdx === 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
>
  <BannerImage banner={banners[1]} isShared={true} />
</div>
```

When a banner is faded out (`opacity-0`), it also gets `pointer-events-none`, allowing clicks to reach the visible banner underneath.

