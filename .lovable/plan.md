

# Fix Image Timeout Issues When Changing Pages

## Problem Analysis

When changing pages, images timeout too quickly and show "Retry" buttons even though they're available. The core issues are:

| Issue | Cause | Impact |
|-------|-------|--------|
| **3-second timeout per card** | `IMAGE_LOAD_TIMEOUT = 3000` starts independently for each card | Cards time out before images can load |
| **No coordination with preload** | Images preloaded in `enrichDropTemplates` aren't tracked | Card doesn't know an image is already loading |
| **Page changes reset all states** | Each card mounts fresh with new timeout | Previous loading progress is lost |
| **IPFS gateway congestion** | Multiple cards racing to different gateways at once | Network saturation slows everything |

**Why Retry/Refresh works:** When you click retry, the browser already has the image cached from the failed timeout, so it loads instantly.

---

## Solution: 3-Part Fix

### 1. Increase Timeout and Add Progressive Backoff

The 3-second timeout is too aggressive for IPFS, especially when loading 50 images at once. Increase it and use progressive backoff:

```typescript
// DropCard.tsx
const BASE_TIMEOUT = 6000; // 6 seconds base (was 3)
const MAX_TIMEOUT = 15000; // 15 seconds max for retries

// Calculate timeout based on retry count - give more time for subsequent attempts
const currentTimeout = Math.min(BASE_TIMEOUT + (gatewayIndex * 3000), MAX_TIMEOUT);
```

### 2. Track Preloaded Images Globally

Create a shared preload tracker so cards know when an image is already being loaded elsewhere:

```typescript
// New: Global preload tracking
const preloadingImages = new Map<string, Promise<boolean>>();
const loadedImages = new Set<string>();

export function preloadImage(url: string): Promise<boolean> {
  if (loadedImages.has(url)) return Promise.resolve(true);
  if (preloadingImages.has(url)) return preloadingImages.get(url)!;
  
  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      loadedImages.add(url);
      preloadingImages.delete(url);
      resolve(true);
    };
    img.onerror = () => {
      preloadingImages.delete(url);
      resolve(false);
    };
    img.src = url;
  });
  
  preloadingImages.set(url, promise);
  return promise;
}

export function isImageLoaded(url: string): boolean {
  return loadedImages.has(url);
}
```

### 3. Cards Check Preload Status Before Starting Timeout

If an image is already being preloaded or has been loaded, skip the timeout:

```typescript
// DropCard.tsx - in the timeout effect
useEffect(() => {
  // Skip timeout if image is already loaded globally
  if (isImageLoaded(currentImageUrl)) {
    setImageLoaded(true);
    return;
  }
  
  // Skip timeout if image is currently being preloaded
  if (isImagePreloading(currentImageUrl)) {
    // Wait for the preload instead of starting our own timeout
    waitForPreload(currentImageUrl).then(success => {
      if (success) setImageLoaded(true);
      else handleImageError();
    });
    return;
  }
  
  // Only start timeout if we're loading this image fresh
  timeoutRef.current = setTimeout(...);
}, [...]);
```

---

## File Changes

| File | Changes |
|------|---------|
| `src/services/atomicApi.ts` | Add global preload tracker (`preloadImage`, `isImageLoaded`, `isImagePreloading`) |
| `src/components/drops/DropCard.tsx` | Increase timeout, check preload status, use progressive backoff |

---

## Technical Implementation

### atomicApi.ts - Add Preload Tracking

```typescript
// Global preload tracking to coordinate between enrichment and card components
const preloadingImages = new Map<string, Promise<boolean>>();
const loadedImages = new Set<string>();

/**
 * Preload an image and track its status globally.
 * Returns a promise that resolves to true if loaded successfully.
 */
export function preloadImage(url: string): Promise<boolean> {
  if (!url || url.includes('placeholder')) return Promise.resolve(false);
  if (loadedImages.has(url)) return Promise.resolve(true);
  if (preloadingImages.has(url)) return preloadingImages.get(url)!;
  
  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        loadedImages.add(url);
        preloadingImages.delete(url);
        resolve(true);
      } else {
        preloadingImages.delete(url);
        resolve(false);
      }
    };
    img.onerror = () => {
      preloadingImages.delete(url);
      resolve(false);
    };
    img.src = url;
  });
  
  preloadingImages.set(url, promise);
  return promise;
}

/**
 * Check if an image has already been loaded successfully.
 */
export function isImageLoaded(url: string): boolean {
  return loadedImages.has(url);
}

/**
 * Check if an image is currently being preloaded.
 */
export function isImagePreloading(url: string): boolean {
  return preloadingImages.has(url);
}

/**
 * Wait for an in-progress preload to complete.
 */
export function waitForPreload(url: string): Promise<boolean> {
  if (loadedImages.has(url)) return Promise.resolve(true);
  if (preloadingImages.has(url)) return preloadingImages.get(url)!;
  return Promise.resolve(false);
}

// Update enrichDropTemplates to use the new preloadImage function
// In the enrichedDrops.map section:
if (cached.image && !cached.image.includes('placeholder')) {
  preloadImage(cached.image); // Use tracked preloading
}
```

### DropCard.tsx - Smarter Timeout Logic

```typescript
import { isImageLoaded, isImagePreloading, waitForPreload } from '@/services/atomicApi';

// More generous timeouts
const BASE_TIMEOUT = 6000; // 6 seconds base
const RETRY_TIMEOUT_INCREMENT = 3000; // Add 3s per gateway retry
const MAX_TIMEOUT = 15000; // 15 seconds max

// In the timeout useEffect:
useEffect(() => {
  if (imageError || imageLoaded || isImageCached) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    return;
  }

  // Check if image is already fully loaded globally
  if (isImageLoaded(currentImageUrl)) {
    setImageLoaded(true);
    return;
  }
  
  // Check if image is currently being preloaded by enrichment
  if (isImagePreloading(currentImageUrl)) {
    // Wait for the existing preload instead of timing out
    waitForPreload(currentImageUrl).then(success => {
      if (success) {
        setImageLoaded(true);
      }
      // If preload failed, the img onError will handle it
    });
    return; // Don't start our own timeout
  }

  // Calculate timeout with progressive backoff for retries
  const timeout = Math.min(BASE_TIMEOUT + (gatewayIndex * RETRY_TIMEOUT_INCREMENT), MAX_TIMEOUT);

  timeoutRef.current = setTimeout(() => {
    if (!imageLoaded && !imageError) {
      handleImageError();
    }
  }, timeout);

  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, [currentImageUrl, imageLoaded, imageError, isImageCached, gatewayIndex]);
```

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Timeout duration | 3 seconds (fixed) | 6-15 seconds (progressive) |
| Cards timing out unnecessarily | Many | Near zero |
| Preload coordination | None | Full tracking |
| Need to click Retry | Frequent | Rare |

---

## Summary

The fix coordinates image loading between the batch enrichment and individual cards:

1. **Longer base timeout** - 6 seconds instead of 3 gives IPFS time to respond
2. **Progressive backoff** - Each retry attempt gets more time
3. **Global preload tracking** - Cards know when an image is already loading
4. **Wait for preload** - Instead of timing out, cards wait for in-progress preloads

This eliminates the race condition where cards timeout while the enrichment system is still preloading their images.

