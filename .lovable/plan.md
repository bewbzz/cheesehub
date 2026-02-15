

## Update Total WAX Fee to 265 (215 WAXDAO / 50 Burner)

### Summary
Increase the total WAX payment from 250 to 265, keeping 215 for the WAXDAO swap and raising the cheeseburner portion from 35 to 50.

### Changes

**1. Smart Contract: `contracts/cheesefeefee/cheesefeefee.hpp`**
- `WAX_FEE_REQUIRED`: 25000000000 (250 WAX) -> 26500000000 (265 WAX)
- `WAX_TO_BURNER`: 35.0 -> 50.0
- Update comment from "205 WAX" to "215 WAX" (already correct) and total references

**2. Frontend: `src/lib/cheeseFees.ts`**
- `WAX_EQUIVALENT_FEE`: 250 -> 265
- `WAX_TO_BURNER`: 35 -> 50

**3. Frontend: `src/components/shared/FeePaymentSelector.tsx`** (and any other UI displaying "250 WAX")
- Update display text from "250 WAX" to "265 WAX" wherever it appears

### Technical Details
- `WAX_FEE_REQUIRED` uses 8 decimal places: 265 * 10^8 = 26500000000
- The `buildWaxPaymentAction` function references `WAX_EQUIVALENT_FEE` for the transfer quantity, so updating the constant handles the action builder automatically
- The CHEESE discount calculation also references `WAX_EQUIVALENT_FEE`, so CHEESE pricing will auto-adjust to the new 265 WAX base

### Deployment
1. Update all files
2. Recompile contract: `make` in `contracts/cheesefeefee/`
3. Redeploy `cheesefeefee` on WAX mainnet
4. Frontend deploys automatically

