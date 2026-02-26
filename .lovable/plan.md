

## Update WAX Distribution Split in `cheesebannad`

### What Changes
The WAX revenue distribution from banner ad rentals is being updated from **20/10/70** to **25/25/50**:

| Recipient | Old | New |
|-----------|-----|-----|
| cheeseburner (ecosystem financing) | 20% | 25% |
| cheesepowerz (resource powerups) | 10% | 25% |
| Alcor swap to CHEESE | 70% | 50% |

CHEESE distribution stays the same (66% burned, 34% to liquidity staking).

### Files to Edit

**1. `contracts/cheesebannad/cheesebannad.hpp`** (lines 47-48)
- Change `WAX_BURNER_PERCENT` from `0.20` to `0.25`
- Change `WAX_POWERZ_PERCENT` from `0.10` to `0.25`
- Update the inline comments to reflect 25%

**2. `contracts/cheesebannad/cheesebannad.cpp`** (lines ~415-430)
- Update the string comments in `distribute_wax_funds` that reference the old percentages (e.g., "20% WAX to cheeseburner" becomes "25% WAX to cheeseburner")

No frontend changes needed -- the distribution logic is entirely on-chain. The `distribute_wax_funds` function already calculates the swap amount as the remainder (`quantity - burner - powerz`), so it will automatically become 50%.

