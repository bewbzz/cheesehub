

# Fix: Increase Image Timeouts and Improve Page-Change Resilience

## Problem

When changing pages, up to 50 new drop cards mount simultaneously. Each card has a **6-second timeout** before showing "Retry." With 50 images loading at once over IPFS gateways, many don't finish in time, causing a wave of "Retry" buttons. Refreshing works because it retries with less contention.

## Solution

Three targeted changes to reduce timeout failures on page change:

### 1. Increase Base Timeouts (ipfsGateways.ts)

| Setting | Current | New |
|---------|---------|-----|
| Card timeout | 6s | 12s |
| Detail timeout | 10s | 15s |
| Per-retry increment | 3s | 3s (unchanged) |
| Max timeout | 15s | 25s |

12 seconds gives IPFS gateways enough time even when 50 images are loading concurrently.

### 2. Extend Preload Wait in DropCard (DropCard.tsx)

Currently, the card sets its own timeout even while waiting for an enrichment preload. If the preload is in progress, the card should **skip its own timeout entirely** and let the preload finish (the preload has no timeout limit since it's a simple Image() load).

### 3. Stagger Card Timeouts (DropCard.tsx)

Add a small random jitter (0-3 seconds) to card timeouts so they don't all fire at exactly the same moment, reducing gateway contention.

## Technical Details

### File 1: `src/lib/ipfsGateways.ts`

Update timeout constants:
```typescript
export const IMAGE_LOAD_TIMEOUT = {
  card: 12000,       // 12 seconds (was 6s) - 50 cards load concurrently
  detail: 15000,     // 15 seconds for detail page
  increment: 3000,   // Add 3s per retry
  max: 25000,        // Max 25 seconds
};
```

### File 2: `src/components/drops/DropCard.tsx`

**Change A** - When a preload is in progress, don't start the card's own timeout. Currently both run in parallel, causing premature "Retry." Instead, when `isImagePreloading` returns true, skip the timeout setup entirely and just wait for the preload promise.

**Change B** - Add random jitter to the timeout calculation:
```typescript
const jitter = Math.random() * 3000; // 0-3s random offset
const timeout = Math.min(
  IMAGE_LOAD_TIMEOUT.card + jitter + (gatewayIndex * IMAGE_LOAD_TIMEOUT.increment),
  IMAGE_LOAD_TIMEOUT.max
);
```

This spreads out timeout deadlines across cards, preventing a thundering herd of gateway switches.

## Expected Impact

- Cards that were timing out at 6s now have 12-15s to load
- Cards waiting for enrichment preloads won't have a competing timeout
- Staggered timeouts reduce simultaneous gateway fallback storms
- The "Retry" button will only appear for genuinely unreachable images

