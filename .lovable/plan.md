

## Fix: CHEESEBoard Returns No Data

### Root Cause
The network logs show the query `act.account=cheesepowerz&act.name=transfer` returns **0 actions**. This is because `cheesepowerz` is not the token contract -- it only receives transfer notifications. The `transfer` action is emitted by `cheeseburger` (the CHEESE token contract).

### Fix in `src/lib/fetchPowerupLeaderboard.ts`

Change the Hyperion query from:
```
act.account=cheesepowerz&act.name=transfer
```
to:
```
act.account=cheeseburger&act.name=transfer&act.data.to=cheesepowerz
```

This queries the actual token contract for all transfers where the recipient is `cheesepowerz`, which captures every powerup transaction historically.

Single line change on line 44.

