

## Align CHEESENull Frontend with Updated Contract

The updated contract from GitHub has significant changes to the distribution splits and removes the caller reward entirely. Here's what needs to change:

### Contract Changes Summary
- **WAX split**: 20% stake (was 15%), 5% CheesePowerz (same), 75% swap (was 80%)
- **CHEESE split**: 85% burn (was 75%), 15% xCHEESE (was 12.5%), **0% caller reward** (was 12.5%)
- No whitelist or priority_window in config
- CheesePowerz stats moved to separate `cpowerstats` table

### Changes Required

**1. `src/hooks/useCheeseNullData.ts`** -- Fix distribution percentages and remove reward
- Change WAX splits: `waxStakeAmount = claimableWax * 0.20`, `waxCheesepowerzAmount = claimableWax * 0.05`, `waxToSwap = claimableWax * 0.75`
- Change CHEESE splits: `cheeseBurnAmount = estimatedCheese * 0.85`, `cheeseLiquidityAmount = estimatedCheese * 0.15`
- Remove `cheeseRewardAmount` from the interface and return value

**2. `src/components/cheesenull/NullStats.tsx`** -- Remove "Reward" display
- Remove the "Reward" card (lines 53-59) showing `cheeseRewardAmount`
- Keep xCHEESE, CheesePowerz, and Compound displays
- Update the xCHEESE percentage label if desired

**3. `src/components/cheesenull/NullTotalStats.tsx`** -- Remove "Rewards" from lifetime stats
- Remove the "Rewards" card (lines 48-54) showing `totalCheeseRewards`
- The `total_cheese_rewards` field still exists in the stats table on-chain but will always be 0 going forward

**4. `src/components/cheesenull/NullButton.tsx`** -- Remove maintenance mode
- Set `isMaintenanceMode = false` (line 22) so the button activates when the cooldown ends
- Remove the maintenance-specific hint text

**5. `contracts/cheeseburner/cheeseburner.cpp`** -- Sync with GitHub version
- Overwrite with the updated contract from GitHub (new WAX 20/5/75 split, CHEESE 85/15 split, no reward, separate cpowerstats table)

**6. `contracts/cheeseburner/cheeseburner.hpp`** -- Sync with GitHub version
- Overwrite with the updated header (no whitelist table, no priority_window in config, new cpowerstats table, updated action signatures)

**7. `src/hooks/useCheeseNullStats.ts`** -- Update CheesePowerz data source
- CheesePowerz is now in a separate `cpowerstats` table, so fetch it separately instead of from the `stats` table
- Remove `totalCheeseRewards` from the interface (or keep as legacy showing 0)

**8. `src/lib/cheeseNullApi.ts`** -- Update ContractStats interface
- Remove `total_wax_cheesepowerz` from `ContractStats` (it's no longer in that table)
- Add a new `CpowerStats` interface and `fetchCpowerStats` function to read from the `cpowerstats` table

