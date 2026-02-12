

# Fix: Kick Users Encoding Error

## Problem
The `buildKickManyAction` function in `src/lib/farm.ts` sends the parameter as `amount`, but the `kickmany` contract action expects `quantity_of_users`. This causes the encoding error since the contract can't find the required field.

## Fix

### File: `src/lib/farm.ts` (line 635)

Change the data field name from `amount` to `quantity_of_users`:

```ts
data: {
  user,
  farmname: farmName,
  quantity_of_users: amount,
},
```

One-line fix. No other changes needed.

