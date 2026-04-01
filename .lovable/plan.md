

## Fix GPK Pack Opening — Critical Bugs Found

### Problem

The current pack opening code has **two critical bugs** that would cause transactions to fail and potentially lose packs:

1. **Missing transfer action**: Real pack-open transactions require TWO actions in one transaction — first a `packs.topps::transfer` to send the pack token to `gpk.topps`, then a `gpk.topps::unbox`. Our code only sends the `unbox` action.

2. **Wrong type values**: The `unbox` action's `type` field uses lowercase eosio names (`gpktwoeight`, `gpktwo25`, etc.), NOT the token symbols (`GPKTWOA`, `GPKTWOB`, etc.). Our code passes `pack.symbol` directly.

### Evidence (verified from on-chain transactions)

```text
Transaction 9bd120c4... (GPKTWOA):
  Action 1: packs.topps::transfer { from: "rvfr2.wam", to: "gpk.topps", quantity: "1 GPKTWOA", memo: "" }
  Action 2: gpk.topps::unbox      { from: "rvfr2.wam", type: "gpktwoeight" }

Transaction 1fbe46f4... (GPKTWOB):
  Action 1: packs.topps::transfer { from: "i3fqu.wam", to: "gpk.topps", quantity: "1 GPKTWOB", memo: "" }
  Action 2: gpk.topps::unbox      { from: "i3fqu.wam", type: "gpktwo25" }

Transaction 18c4ca26... (GPKTWOC):
  Action 1: packs.topps::transfer { from: "i3fqu.wam", to: "gpk.topps", quantity: "1 GPKTWOC", memo: "" }
  Action 2: gpk.topps::unbox      { from: "i3fqu.wam", type: "gpktwo55" }

Transaction cc9ef15c... (GPKFIVE):
  Action 1: packs.topps::transfer { from: "i3fqu.wam", to: "gpk.topps", quantity: "1 GPKFIVE", memo: "" }
  Action 2: gpk.topps::unbox      { from: "i3fqu.wam", type: "five" }
```

### Confirmed mapping

| Token Symbol | Unbox Type     | Description                    |
|-------------|----------------|--------------------------------|
| GPKFIVE     | `five`         | Series 1 Standard (5 cards)    |
| GPKMEGA     | `thirty`       | Series 1 Mega (30 cards) *     |
| GPKTWOA     | `gpktwoeight`  | Series 2 Standard (8 cards)    |
| GPKTWOB     | `gpktwo25`     | Series 2 Mega (25 cards)       |
| GPKTWOC     | `gpktwo55`     | Series 2 Ultimate (55 cards)   |

\* GPKMEGA was not found in recent transactions. The unbox type `thirty` is an educated guess (30 cards, matching the naming pattern). If unknown, the Open button should be disabled for GPKMEGA to prevent pack loss.

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`**
- Add a symbol-to-unbox-type mapping constant
- Send TWO actions in the transaction: `packs.topps::transfer` first, then `gpk.topps::unbox`
- The transfer sends `1 {SYMBOL}` to `gpk.topps` with empty memo
- The unbox uses the mapped lowercase type name
- Disable the Open button if no mapping exists for the symbol (safety for GPKMEGA)
- Format the quantity using the pack's precision (e.g. `"1 GPKTWOA"` for precision 0)

**`src/hooks/useGpkPacks.ts`**
- Fix the `GPKFIVE` label from "GPK Series 5 Pack" to "GPK Series 1 Pack" (it's 5 cards from Series 1, not Series 5)

### Files modified: 2
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/hooks/useGpkPacks.ts`

