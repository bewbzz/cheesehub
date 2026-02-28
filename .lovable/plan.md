

## Add Crossfade Transition to Shared Banner Rotation

### Current Behavior
When shared banners rotate every 30 seconds, the switch is instant -- one banner disappears and the next appears abruptly.

### Solution
Render **both** banners stacked on top of each other using absolute positioning, and crossfade between them using CSS opacity transitions with a 3-second duration.

### Changes

**`src/components/home/BannerAd.tsx`** -- Rewrite the `SharedBannerRotator` render section:

- Render both `BannerImage` components simultaneously, stacked via `absolute`/`relative` positioning
- Apply `opacity-0` / `opacity-100` based on `activeIdx`, with `transition-opacity duration-[3000ms]`
- The outgoing banner fades out over 3 seconds while the incoming one fades in, creating a smooth crossfade

```text
Before:
  <BannerImage banner={displayBanner} />    (single, swaps instantly)

After:
  <div className="relative">
    <div className={activeIdx === 0 ? "opacity-100" : "opacity-0"} style="transition: opacity 3s">
      <BannerImage banner={banners[0]} />
    </div>
    <div className={activeIdx === 1 ? "opacity-100" : "opacity-0"} style="transition: opacity 3s; position: absolute; inset: 0">
      <BannerImage banner={banners[1]} />
    </div>
  </div>
```

The dot indicators remain unchanged at the bottom-left, and their opacity transition stays instant so users immediately see which ad is active.

