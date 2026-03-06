

## Add CHEESEUp Top 10 Leaderboard

### Approach
Since the `cheesepowerz` contract doesn't have a dedicated logging action like `cheeseburner`'s `logburn`, we track powerup usage via **Hyperion transfer history** — specifically, all `cheeseburger::transfer` actions where `to=cheesepowerz`. Each transfer represents one powerup, and the `quantity` field gives us the CHEESE amount burned.

This mirrors the CHEESENull leaderboard pattern but with a different data source.

### Files to Create/Edit

**1. `src/lib/fetchPowerupLeaderboard.ts`** (new)
- Fetch paginated transfer actions from Hyperion: `act.account=cheeseburger&act.name=transfer&act.data.to=cheesepowerz`
- Aggregate by sender (`from` field): count powerups and sum CHEESE spent
- Sort by CHEESE burned or powerup count, return top 10
- Reuse the same batch/pagination pattern from `fetchLeaderboard.ts`

**2. `src/hooks/usePowerupLeaderboard.ts`** (new)
- `useQuery` wrapper around the fetch function (same pattern as `useNullerLeaderboard`)
- Expose `rawActions`, `data`, `isLoading`, `isError`

**3. `src/components/powerup/PowerupLeaderboard.tsx`** (new)
- Reuse the same card/table layout as `NullerLeaderboard.tsx`
- Title: "CHEESEBoard" with trophy icons
- Sort toggles: "CHEESE Burned" and "Powerups"
- Table columns: rank, account, primary value, secondary text
- Styled consistently with the existing cheese theme

**4. `src/pages/PowerUp.tsx`** (edit)
- Import and render `PowerupLeaderboard` between the `PowerUpCard` and `PowerupStatsBar`

