
# CHEESEAmp Performance and Video Resolution Improvements

## Problems Identified

### 1. Slow Collection Loading
The current implementation fetches NFT metadata in batches but:
- Fetches up to 50 pages (5000 assets) sequentially after initial parallel burst
- No timeout per API request causes hanging when endpoints are slow
- IPFS gateway fallback in metadata URLs uses first gateway only (no race)

### 2. Slow Track Playback
The `tryGateways()` method in musicPlayer.ts:
- Tries gateways sequentially, waiting for each to fully fail before trying next
- No timeout per gateway attempt - slow gateways block for seconds
- First gateway (ipfs.io) is often slow, causing unnecessary delays

### 3. Low Video Resolution
- Video container is only 256x256px (the "now playing" art area)
- No way to view video at larger size
- Source videos may be higher quality but are being scaled down

---

## Solution Overview

### Phase 1: Faster IPFS Media Loading (Race Strategy)

**File: `src/lib/musicPlayer.ts`**

Replace sequential gateway fallback with a **racing strategy** that tries multiple gateways in parallel:

```text
Current (slow):
Gateway 1 → wait → fail → Gateway 2 → wait → fail → Gateway 3 → success

New (fast):
Gateway 1 ─┐
Gateway 2 ─┼─→ First success wins, cancel others
Gateway 3 ─┘
```

Implementation:
- Try first 2-3 gateways in parallel with `Promise.race`
- Add 5-second timeout per gateway attempt
- First successful response wins and starts playback

### Phase 2: Faster Collection Loading

**File: `src/hooks/useMusicNFTs.ts`**

Optimizations:
- Add request timeouts (reduce from 8s default to 5s for faster failover)
- Increase parallel batch fetching from 3 to 5 concurrent requests
- Use faster IPFS gateways first (Pinata > ipfs.io for reliability)
- Skip slow unchecked-assets phase for large collections (> 500)

### Phase 3: Video Theater Mode

**File: `src/components/music/MediaDisplay.tsx`**

Add fullscreen/theater mode for video playback:
- Expand button in corner of video
- Theater mode: Video fills the dialog (larger viewing area)
- Fullscreen mode: Native browser fullscreen API
- Keep controls accessible during expanded view

---

## Technical Details

### IPFS Gateway Racing

```typescript
// New approach in musicPlayer.ts
private async tryGatewaysRace(
  hash: string, 
  element: HTMLAudioElement | HTMLVideoElement
): Promise<void> {
  const TIMEOUT = 5000; // 5 second timeout per gateway
  
  // Try multiple gateways in parallel
  const attempts = IPFS_GATEWAYS.slice(0, 3).map((gateway, index) => 
    new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('timeout')), TIMEOUT);
      
      // Small stagger to prefer faster gateways
      setTimeout(async () => {
        try {
          const url = `${gateway}${hash}`;
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            clearTimeout(timeoutId);
            resolve(url);
          } else {
            reject(new Error('not ok'));
          }
        } catch (e) {
          reject(e);
        }
      }, index * 100); // 100ms stagger between gateways
    })
  );

  try {
    const winningUrl = await Promise.any(attempts);
    element.src = winningUrl;
    await element.play();
  } catch {
    throw new Error('All gateways failed');
  }
}
```

### Video Theater Mode UI

Add to MediaDisplay.tsx:
- "Expand" button (corners icon) when video is playing
- Theater mode expands video to fill the dialog
- Fullscreen button uses native `requestFullscreen()` API
- ESC key or click outside to exit theater mode

```text
Normal View:         Theater View:
┌────────────────┐   ┌────────────────────────────┐
│ ┌────┐ Track   │   │                            │
│ │Vid │ Info    │   │      VIDEO FILLS AREA      │
│ └────┘         │   │                            │
│ [Controls]     │   │ [Controls Overlay]         │
│ [Playlist...] │   └────────────────────────────┘
└────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/musicPlayer.ts` | Add racing gateway strategy with timeouts |
| `src/hooks/useMusicNFTs.ts` | Add request timeouts, increase parallelism |
| `src/components/music/MediaDisplay.tsx` | Add theater/fullscreen mode |
| `src/components/music/CheeseAmpPlayer.tsx` | Support theater mode state |

---

## Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| Track start time | 3-10s | 1-3s |
| Collection load (500 NFTs) | 15-30s | 8-15s |
| Video display size | 256x256 | Fullscreen capable |
| IPFS gateway failures | Blocks playback | Graceful failover |

---

## Summary

This update brings the same robust fallback patterns used elsewhere in CHEESEHub to the CHEESEAmp player. The racing strategy dramatically improves load times by not waiting for slow gateways, and theater mode lets users enjoy music videos at full quality.
