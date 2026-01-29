

# Add Minimal Floating Mini Player Bar for CHEESEAmp

## Overview

Create a compact floating bar in the lower-right corner that appears when CHEESEAmp is minimized. The mini player will be a simple horizontal bar with essential playback controls only - no album art, no video display.

## Visual Design

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Main Website Content                             │
│                                                                               │
│                                                                               │
│                                                                               │
│           ┌────────────────────────────────────────────────────────┐         │
│           │ 🧀 Track Title - Artist    ◀◀  ▶  ▶▶  0:45/3:21  ↗  ✕ │         │
│           └────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
                                                      ↑ Fixed bottom-right
```

**Desktop**: Compact bar (~320px wide) in lower-right corner
**Mobile**: Full-width bar at bottom of screen

## Mini Player Contents

| Element | Description |
|---------|-------------|
| CHEESE logo | Small branding (cheese emoji or icon) |
| Track info | Title and artist, truncated if needed |
| Previous | Skip to previous track |
| Play/Pause | Toggle playback |
| Next | Skip to next track |
| Time | Current position / duration |
| Expand | Button to reopen full CHEESEAmp dialog |
| Close | Stop music and dismiss mini player |

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/music/CheeseAmpMiniPlayer.tsx` | **Create** | New minimal bar component |
| `src/components/WalletConnect.tsx` | Modify | Add minimized state and render mini player |

## Technical Implementation

### 1. CheeseAmpMiniPlayer.tsx (New File)

A simple horizontal bar that:
- Subscribes to `getAudioPlayer()` for playback state
- Uses `audioPlayer.getCurrentTrack()` to display track info
- Provides prev/play-pause/next controls
- Has expand button to reopen full dialog
- Has close button to stop music entirely
- Uses `useIsMobile()` for responsive layout

**Styling:**
- `fixed bottom-4 right-4 z-50` (desktop)
- `fixed bottom-0 left-0 right-0 z-50` (mobile)
- Semi-transparent background with backdrop blur
- Cheese-themed border accent

### 2. WalletConnect.tsx Modifications

**New State:**
```typescript
const [cheeseAmpMinimized, setCheeseAmpMinimized] = useState(false);
```

**Updated Handlers:**
- `handleMinimize`: Close dialog, show mini player
- `handleExpand`: Hide mini player, open dialog
- `handleMiniPlayerClose`: Stop audio, hide mini player

**Updated Event Listener:**
When CHEESEAmp menu item clicked while minimized, expand instead of opening fresh

**Render Mini Player:**
```typescript
{cheeseAmpMinimized && (
  <CheeseAmpMiniPlayer
    onExpand={handleExpand}
    onClose={handleMiniPlayerClose}
  />
)}
```

### 3. Skip Track Logic

The mini player needs to trigger next/previous. Two approaches:

**Option A - Custom Events (Recommended):**
Dispatch events that `useCheeseAmpAutoAdvance` can listen to:
```typescript
window.dispatchEvent(new CustomEvent('cheeseamp-next'));
window.dispatchEvent(new CustomEvent('cheeseamp-previous'));
```

Update `useCheeseAmpAutoAdvance.ts` to handle these events.

**Option B - Direct Playlist Access:**
Import `useCheeseAmpPlaylist` in the mini player and call `playNext()`/`playPrevious()` directly.

I'll use Option B since the mini player can access the same hooks.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No track playing | Show "Nothing playing" or hide mini player |
| Track ends | Auto-advance continues working via existing hook |
| User logs out | Mini player closes automatically |
| Click CHEESEAmp while minimized | Expands to full dialog (doesn't open second instance) |
| Page navigation | Mini player persists (it's in the header which wraps all routes) |

## Mobile Responsive Layout

Using `useIsMobile()` hook:

**Desktop:**
```css
fixed bottom-4 right-4 w-80
```

**Mobile:**
```css
fixed bottom-0 left-0 right-0 w-full px-2 pb-2
```

Mobile will have larger touch targets (44-48px buttons) and a simpler single-row layout.

