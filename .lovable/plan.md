

## Fix: Adjust WAX Split in cheesefeefee (215 WAXDAO / 35 Burner)

### Problem
The 250 WAX payment routes 205 WAX through Alcor Pool 1236 to buy WAXDAO. With current pool depth, 205 WAX yields ~5037 WAXDAO. After the contract applies a 2% slippage buffer on `minTokenOut`, the swap can fail because the margin above the ~4952 WAXDAO creation fee is razor-thin. This is a margin problem, not a slippage tolerance problem.

### Solution
Change the WAX split from 205/45 to 215/35:
- 215 WAX swapped for WAXDAO (more headroom above fee)
- 35 WAX sent to cheeseburner (still meaningful burn contribution)
- Total remains 250 WAX

### Changes Required

**1. Smart Contract: `contracts/cheesefeefee/cheesefeefee.hpp`**
- `WAX_TO_WAXDAO`: 205.0 -> 215.0
- `WAX_TO_BURNER`: 45.0 -> 35.0

**2. Frontend: `src/lib/cheeseFees.ts`**
- `WAX_TO_WAXDAO`: 205 -> 215
- `WAX_TO_BURNER`: 45 -> 35

### Deployment
1. Update both files
2. Recompile contract: `make` in `contracts/cheesefeefee/`
3. Redeploy `cheesefeefee` on WAX mainnet
4. Frontend deploys automatically

### Impact
- 215 WAX should yield ~5280+ WAXDAO, providing comfortable margin above the ~4952 required
- Burner still receives 35 WAX (14% of total) for CHEESE ecosystem support
- No other logic changes needed — total fee stays 250 WAX

