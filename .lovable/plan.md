
# CHEESEAmp Global Library

## Summary
Add a "Global Library" tab to CHEESEAmp that fetches music NFTs from a dedicated WAX account (e.g., `cheeseamphub`). This allows anyone — even users with zero music NFTs — to browse and play tracks curated by the CHEESEAmp team. No smart contract required; it reuses the existing AtomicAssets fetching logic.

## How It Works
1. A dedicated WAX account (you create and fund it, e.g., `cheeseamphub`) holds curated music NFTs
2. CHEESEAmp fetches that account's music NFTs using the same `useMusicNFTs` logic
3. Users see a new "Global" tab alongside "Library" and "Playlists"
4. When "Global" is selected, the tracklist shows the shared collection instead of the user's own NFTs
5. All playback features (play, shuffle, repeat, playlists) work identically with global tracks

## Changes

### 1. Make `useMusicNFTs` accept an optional account parameter
**File: `src/hooks/useMusicNFTs.ts`**
- Add a new exported hook `useGlobalMusicNFTs(accountName: string)` or refactor `useMusicNFTs` to accept an optional `owner` parameter override
- Simplest approach: extract the core fetching logic into a reusable internal function, then expose two hooks:
  - `useMusicNFTs()` -- existing behavior, uses logged-in user
  - `useMusicNFTs(overrideAccount)` -- fetches for a specific account
- The global account name will be a constant: `const CHEESEAMP_GLOBAL_ACCOUNT = 'cheeseamphub';`

### 2. Add Global Library tab to CheeseAmpPlayer
**File: `src/components/music/CheeseAmpPlayer.tsx`**
- Add a third tab button "Global" next to "Library" and "Playlists" in the tab bar (around line 479)
- Add a new view mode: `'library' | 'playlists' | 'global'`
- When `viewMode === 'global'`, call the global music NFTs hook and display those tracks in the same tracklist component
- The "no music NFTs" empty state (line 275-294) should change: instead of showing nothing, offer a button to switch to the Global Library

### 3. Integrate global tracks with playlist system
**File: `src/components/music/CheeseAmpPlayer.tsx`**
- When viewing global tracks, pass them to `useCheeseAmpPlaylist` as the active track list so shuffle/repeat/next/previous all work
- Users can add global tracks to their personal playlists (the playlist stores asset IDs which remain valid regardless of source)

### 4. Visual distinction
- Global tracks get a small globe or "G" badge in the tracklist to distinguish them from owned tracks
- The tab shows track count: "Global (24)"

## What You Need To Do (Outside Lovable)
- Create a WAX account (e.g., `cheeseamphub`)
- Transfer curated music NFTs to that account
- That is it -- the frontend handles the rest automatically

## No Smart Contract Needed
The music NFTs are standard AtomicAssets. The frontend just reads them from a different account. No on-chain logic, no permissions, no fees. The dedicated account simply holds the NFTs as a curated collection.
