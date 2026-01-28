
# Fix CHEESEAmp Playlist Persistence

## Problem Identified

Playlists are being lost due to a race condition in the `useCheeseAmpPlaylist` hook. The current implementation:

1. Initializes state with `getDefaultState()` when `accountName` is null at first render
2. Sets `isLoaded = true` when account becomes available
3. Saves the (empty) state to localStorage before the load effect can restore the saved playlists
4. Effectively overwrites user playlists with empty state on every app reload

## Root Cause

The save effect on lines 101-105 triggers too early:
```typescript
useEffect(() => {
  if (accountName && isLoaded) {
    saveState(accountName, state);  // This saves empty state before load completes!
  }
}, [accountName, state, isLoaded]);
```

The `isLoaded` flag is set to `true` in the same effect that loads state, but React batches these updates, causing the save to trigger with stale (empty) state.

## Solution

Implement a proper "loaded" tracking mechanism that only enables saving AFTER the initial load has completed and the state has been populated:

1. **Track load completion separately** - Use a ref or separate flag that only becomes true AFTER `setState(loadState(...))` has been called
2. **Debounce saves** - Add a small delay to ensure state is fully loaded before first save
3. **Add version/timestamp guard** - Don't save if the loaded state is newer than what we're trying to save

## Implementation

### File: `src/hooks/useCheeseAmpPlaylist.ts`

**Changes:**

1. Add a `hasInitialLoadCompleted` ref to track when the FIRST load for an account is done
2. Modify the load effect to set this flag AFTER setState completes
3. Modify the save effect to only save when `hasInitialLoadCompleted` is true
4. Reset the flag when account changes to prevent saving stale data during transitions

```
Current flow (buggy):
Mount → state=empty → accountName arrives → isLoaded=true → SAVE(empty) → load(saved)

Fixed flow:
Mount → state=empty → accountName arrives → load(saved) → hasLoadCompleted=true → SAVE(loaded)
```

## Technical Details

The fix uses a ref (`hasInitialLoadCompleted`) instead of state because:
- Refs don't trigger re-renders
- The value updates synchronously, avoiding race conditions
- It can be checked in the same render cycle it's set

Additionally, we'll add the `lastLoadedAccount` ref to detect account switches and prevent cross-account data leaks.

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCheeseAmpPlaylist.ts` | Fix race condition with proper load/save sequencing |

## Summary

This fix ensures playlists are only saved to localStorage AFTER they've been properly loaded from localStorage. Users will no longer lose their playlists when reopening the app or switching accounts.
