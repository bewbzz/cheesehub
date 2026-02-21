

## Random Fart Sounds on All Dapp Orbs

All floating cheese orbs across dapp pages will play a random fart sound when clicked. The homepage orb is excluded.

### Changes

**1. Save 7 new sound files** to `src/assets/farts/`
- fart-01.mp3 through fart-07.mp3 (from the 7 uploaded files)

**2. Create `src/lib/fartSounds.ts`** -- shared utility
- Imports all 11 sound files (4 existing + 7 new)
- Exports `playRandomFart()` which picks a random sound and plays it
- Uses Audio object pooling so rapid clicks work smoothly

**3. Update 4 existing orb pages** (already have audio -- simplify them)
- `src/pages/BannerAds.tsx` -- remove useRef/useCallback/sound import, use `playRandomFart`
- `src/pages/Dao.tsx` -- same cleanup
- `src/pages/CheeseNull.tsx` -- same cleanup
- `src/pages/PowerUp.tsx` -- same cleanup

**4. Add click sound to 3 pages that don't have it yet**
- `src/pages/Farm.tsx` -- add `cursor-pointer`, `onClick={playRandomFart}` to orb div
- `src/pages/Locker.tsx` -- same
- `src/components/drops/DropsHero.tsx` -- same

### Technical Details

```text
src/lib/fartSounds.ts
---------------------
- Import 11 mp3 files (4 from assets root, 7 from assets/farts/)
- const FART_SOUNDS = [all 11 sources]
- export function playRandomFart():
    pick random index -> new Audio(src) -> play()

Each page change:
- Add: import { playRandomFart } from '@/lib/fartSounds'
- Add: onClick={playRandomFart} + cursor-pointer on orb div
- Remove (where applicable): useRef, useCallback, audioRef, 
  individual sound imports
```

### Files Touched
- 7 new audio files created in `src/assets/farts/`
- 1 new file: `src/lib/fartSounds.ts`
- 7 files modified: BannerAds, Dao, CheeseNull, PowerUp, Farm, Locker, DropsHero
