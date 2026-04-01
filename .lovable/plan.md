

## Add "Open Pack" Functionality to GPK Pack Cards

Pack opening works by transferring the pack token from the user's account to `gpk.topps` via the `packs.topps::transfer` action. The contract then mints cards back to the user.

### Transaction Details

```text
Contract:  packs.topps
Action:    transfer
Data:      { from: user, to: "gpk.topps", quantity: "1 GPKTWOA", memo: "" }
```

### Changes

**`src/components/simpleassets/GpkPackCard.tsx`**
- Accept `session` (from useWax) and `onSuccess` callback as props
- Enable the "Open Pack" button (remove `disabled` + tooltip wrapper)
- On click, sign a `packs.topps::transfer` action sending `1 {SYMBOL}` to `gpk.topps` with empty memo
- Use `useWaxTransaction` for signing with automatic modal cleanup and toast feedback
- Add loading state while transaction is in-flight
- On success, call `onSuccess()` so the parent can refetch pack balances and card lists

**`src/pages/SimpleAssets.tsx`**
- Pass `session` and a `refetch` callback down to each `GpkPackCard`
- After a successful open, refetch both pack balances and SimpleAssets so newly minted cards appear immediately

### Files modified: 2
- `src/components/simpleassets/GpkPackCard.tsx`
- `src/pages/SimpleAssets.tsx`

