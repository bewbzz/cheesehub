

## CHEESEAmp Royalty System -- Full Hybrid Implementation

Smart contract for play tracking and royalty payouts, with a hybrid frontend approach: Anchor users get frictionless per-play logging via session keys, Cloud Wallet users accumulate plays locally and submit them in a single batch transaction.

---

### Part 1: Smart Contract (`contracts/cheeseamphub/`)

**New files:**
- `contracts/cheeseamphub/cheeseamphub.hpp`
- `contracts/cheeseamphub/cheeseamphub.cpp`
- `contracts/cheeseamphub/Makefile`
- `contracts/cheeseamphub/README.md`

**Tables:**

| Table | Scope | Primary Key | Fields |
|-------|-------|-------------|--------|
| `deposits` | self | `asset_id` | `uint64_t asset_id`, `name depositor`, `name collection_name`, `uint32_t template_id` |
| `playcounts` | self | `collection_name` | `name collection_name`, `uint64_t total_plays`, `uint64_t unclaimed_plays` |
| `config` | self | singleton (id=1) | `uint64_t id`, `asset royalty_per_play`, `name token_contract` |
| `playlogs` | self | `id` (auto-inc) | `uint64_t id`, `name caller`, `uint32_t template_id`, `uint32_t timestamp` |

**Actions:**

1. **`on_notify("atomicassets::transfer")`** -- Catches NFTs sent to the contract, reads `collection_name` and `template_id` from the AtomicAssets assets table, inserts into `deposits`.

2. **`logplay(name caller, uint32_t template_id)`** -- Single play log.
   - `require_auth(caller)`
   - Look up deposit by template_id to get collection_name
   - 5-minute cooldown check per caller+template in `playlogs`
   - Increment `total_plays` and `unclaimed_plays` in `playcounts`

3. **`logplays(name caller, vector<uint32_t> template_ids)`** -- Batch play log (for Cloud Wallet users).
   - `require_auth(caller)`
   - Loops through template_ids applying the same logic as `logplay` for each
   - Single signature covers all accumulated plays

4. **`claimroyalty(name collection_account)`** -- Collection creators claim earned CHEESE.
   - `require_auth(collection_account)`
   - Payout = `unclaimed_plays * config.royalty_per_play`
   - Inline transfer CHEESE from contract to creator
   - Reset `unclaimed_plays` to 0

5. **`setconfig(asset royalty_per_play, name token_contract)`** -- Admin config via block explorer.
   - `require_auth(get_self())`

6. **`withdraw(name token_contract, name to, asset quantity)`** -- Admin withdrawal.
   - `require_auth(get_self())`

7. **`removedepo(uint64_t asset_id)`** -- Admin cleanup for removed NFTs.
   - `require_auth(get_self())`

**Constants:** Same pattern as `cheesefeefee` -- `CHEESE_CONTRACT = "cheeseburger"_n`, `CHEESE_SYMBOL = symbol("CHEESE", 4)`, `ATOMICASSETS = "atomicassets"_n`, `PLAY_COOLDOWN = 300`.

---

### Part 2: Frontend -- Play Logging Utility

**New file: `src/lib/cheeseAmpRoyalties.ts`**

Core helper with two modes:

- **`logPlayImmediate(session, templateId)`** -- Fire-and-forget single `logplay` transaction. Used by Anchor sessions where session keys allow auto-signing.
- **`bufferPlay(accountName, templateId)`** -- Stores play in localStorage buffer (`cheesehub_playbuffer_{account}`). Used by Cloud Wallet sessions.
- **`flushPlayBuffer(session, accountName)`** -- Reads the localStorage buffer and sends a single `logplays` batch transaction, then clears the buffer. Called when user triggers a natural signing moment (e.g., opening wallet, performing another transaction).
- **`getBufferedPlayCount(accountName)`** -- Returns count of unsent plays for UI display.

All transactions include `getTransactPlugins(session)` for Greymass Fuel sponsorship (Anchor only).

---

### Part 3: Frontend -- Player Integration

**Edit: `src/components/music/CheeseAmpPlayer.tsx`**

- In `handlePlayTrack`, after `audioPlayer.play(track)` succeeds and `viewMode === 'global'`:
  - Check `isAnchorSession(session)` (imported from `wharfKit.ts`)
  - If Anchor: call `logPlayImmediate(session, track.template_id)` (fire-and-forget, no await, wrapped in try/catch)
  - If Cloud Wallet: call `bufferPlay(accountName, track.template_id)`
- No UI changes needed -- logging is completely invisible to the user

**Edit: `src/hooks/useCheeseAmpAutoAdvance.ts`**

- When auto-advancing to the next track in a global library playlist, also trigger the appropriate log method
- Need to pass a `logPlayFn` callback or accept session info
- Add optional `onTrackPlayed?: (templateId: string) => void` callback parameter
- The callback is wired up in `WalletConnect.tsx` where session context is available

**Edit: `src/components/WalletConnect.tsx`**

- When CHEESEWallet opens or any other natural signing action occurs, call `flushPlayBuffer(session, accountName)` if buffer has entries
- This ensures Cloud Wallet users periodically submit their accumulated plays without an extra popup

---

### Part 4: Cloud Wallet Buffer UI (Minimal)

**Edit: `src/components/music/CheeseAmpPlayer.tsx`**

- Add a small, unobtrusive indicator when plays are buffered (Cloud Wallet only)
- Example: a tiny badge or tooltip near the track count showing "X plays pending sync"
- Optional "Sync Now" button that triggers `flushPlayBuffer` (will prompt one Cloud Wallet signature)

---

### Technical Details

- `isAnchorSession()` already exists in `src/lib/wharfKit.ts` and correctly detects wallet type
- Anchor Session Keys (Link Sessions) enable auto-signing of whitelisted contract actions -- the first `logplay` call prompts approval, subsequent calls within the session auto-sign silently
- The `logplays` batch action accepts a vector of template IDs so Cloud Wallet users sign once for many plays
- The 5-minute cooldown in the contract prevents spam regardless of which frontend path is used
- localStorage buffer format: `{ plays: [{ templateId, timestamp }] }`
- Buffer is flushed opportunistically -- no forced popups for Cloud Wallet users

