

# Fix CHEESEAmp Pausing on Minimize

## Problem

The `handleOpenChange` callback in `CheeseAmpDialog.tsx` calls `getAudioPlayer().stop()` whenever the dialog closes and `isMinimizingRef` is `false`. The ref is reset after 100ms via `setTimeout`, but Radix Dialog can fire `onOpenChange(false)` after that window closes -- causing the music to stop even during a minimize.

## Fix

**File: `src/components/music/CheeseAmpDialog.tsx`**

Remove the `stop()` call from `handleOpenChange` entirely. Music should only be stopped when the user explicitly clicks the X (close) button, which already calls `handleClose()` directly. The `handleOpenChange` should just pass through the open state without side effects:

```tsx
const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen && !isMinimizingRef.current) {
    // Dialog closing but not minimizing - just close, don't stop music
    // Music is only stopped via the explicit X button (handleClose)
  }
  onOpenChange(newOpen);
};
```

Even simpler -- since `handleClose` already handles stopping music, we can just remove the stop entirely from `handleOpenChange`:

```tsx
const handleOpenChange = (newOpen: boolean) => {
  onOpenChange(newOpen);
};
```

This also means `isMinimizingRef` is no longer needed and can be removed for cleaner code.

## Why This Is Safe

- The X button calls `handleClose()` which explicitly stops music -- that path is unchanged
- The mini player close button also calls `getAudioPlayer().stop()` in `handleMiniPlayerClose` -- unchanged
- `onInteractOutside` and `onEscapeKeyDown` are both prevented, so there's no accidental close path that should stop music
- The only way to dismiss the dialog is minimize (keep playing) or X (stop), both handled explicitly

