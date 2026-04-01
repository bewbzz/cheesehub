

## Fix Pack Opening to Use gpk.topps::unbox

The current implementation uses `packs.topps::transfer` to send the pack token to `gpk.topps`, but the contract actually has a dedicated `unbox` action that triggers WAX RNG-based card generation.

### Confirmed Contract Details

```text
Contract:  gpk.topps
Action:    unbox
Data:      { from: "youraccount", type: "GPKTWOA" }
```

The `unbox` action:
- Takes `from` (the user's account name) and `type` (the pack symbol, e.g. `GPKTWOA`, `GPKTWOB`, `GPKTWOC`)
- Internally requests a random number from WAX RNG
- Burns the pack token and mints cards back to the user

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`**
- Change the transaction from `packs.topps::transfer` to `gpk.topps::unbox`
- Action data changes from `{ from, to, quantity, memo }` to `{ from, type }`
- `type` is the pack symbol (e.g. `"GPKTWOA"`)
- Authorization remains the user's session actor/permission

### Files modified: 1
- `src/components/simpleassets/GpkPackCard.tsx`

