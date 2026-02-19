
# Fix: Kick Users Button After Closing Farm

## Root Cause Confirmed

Your hypothesis is correct. The WaxDAO `closefarm` action does NOT set `status = 3`. It resets the farm back to **Under Construction** — `status = 0` with `expiration = 1` (the sentinel value meaning "never opened"). There is no separate status code for "temporarily closed".

The current UI code checks `farm.status === 3` for `isClosed`, which **never triggers** because the contract never writes `3`. After closing, the farm becomes `isUnderConstruction` (status 0, expiration <= 1), but the Kick Users button only renders when `isClosed || isPermClosed` — so it never appears.

The "Expired" badge the user sees is likely from the stale cache returning the old expired expiration timestamp before the 2s/5s delayed refetch brings back the updated `expiration = 1`.

## The Fix

The entire `isClosed` / `status === 3` concept should be removed. The contract uses only these states:

```text
status 0 + expiration <= 1  → Under Construction (also the state after closefarm)
status 0 + expiration > now → Active (opened, not expired)
status 0 + expiration < now → Expired
status 1                    → (not used / legacy?)
status 2                    → Permanently Closed
```

The Kick Users button and the "Now kick all users..." info message need to trigger on `isUnderConstruction && hasStakers`, not `isClosed`.

## Files to Change

### `src/components/farm/FarmDetail.tsx`

**1. Remove the dead `isClosed` variable (status === 3 never happens).**

Current:
```tsx
const isClosed = farm.status === 3;
const isPermClosed = farm.status === 2;
const isExpired = !isUnderConstruction && !isClosed && !isPermClosed && farm.expiration < now;
```

Replace with:
```tsx
const isPermClosed = farm.status === 2;
const isExpired = !isUnderConstruction && !isPermClosed && farm.expiration < now;
```

**2. Update the "Kick Users" button condition** from `isClosed || isPermClosed` to `isUnderConstruction || isPermClosed`.

Current (line ~389):
```tsx
{isCreator && (isClosed || isPermClosed) && hasStakers && (
  <KickUsersDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
{isCreator && (isClosed || isPermClosed) && !hasStakers && (
  <span className="text-xs text-muted-foreground">No stakers to kick</span>
)}
{isCreator && isPermClosed && !hasStakers && (
  <EmptyFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
```

Replace with:
```tsx
{isCreator && (isUnderConstruction || isPermClosed) && hasStakers && (
  <KickUsersDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
{isCreator && (isUnderConstruction || isPermClosed) && !hasStakers && (
  <span className="text-xs text-muted-foreground">No stakers to kick</span>
)}
{isCreator && isPermClosed && !hasStakers && (
  <EmptyFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
)}
```

**3. Update the Creator Info Box** — the `isClosed` branch message should now show under `isUnderConstruction` when stakers exist.

Current:
```tsx
} : isClosed ? (
  <p>Now kick all users, update stakeable assets and values (optional) then open the farm again.</p>
) : isUnderConstruction ? (
  <p>Your farm is under construction. Add stakeable assets...</p>
```

Replace so `isUnderConstruction` shows the right message depending on whether stakers exist:
```tsx
} : isUnderConstruction ? (
  hasStakers ? (
    <p>Now kick all users, update stakeable assets and values (optional) then open the farm again.</p>
  ) : (
    <p>Your farm is under construction. Add stakeable assets, deposit reward tokens, then press <strong>Open Farm</strong> to set an expiration date and go live.</p>
  )
) :
```

**4. Remove all remaining `isClosed` references** (badge rendering, ManageStakableAssets `canEdit` prop, etc.).

Current badge rendering:
```tsx
{isPermClosed ? (
  <Badge variant="destructive">Permanently Closed</Badge>
) : isClosed ? (
  <Badge className="...">Closed</Badge>
) : isUnderConstruction ? (
```

Replace by simply removing the `isClosed` branch:
```tsx
{isPermClosed ? (
  <Badge variant="destructive">Permanently Closed</Badge>
) : isUnderConstruction ? (
```

Current `canEdit` for ManageStakableAssets:
```tsx
canEdit={(isUnderConstruction || (isClosed && !hasStakers)) && !isPermClosed}
```
Replace with:
```tsx
canEdit={isUnderConstruction && !isPermClosed}
```

**5. Fix the "Close/Perm Close" button condition** — currently buttons show only when `isExpired`. This is still correct since `closefarm` is only callable on expired farms.

## Summary of Changes

| File | Change |
|---|---|
| `src/components/farm/FarmDetail.tsx` | Remove dead `isClosed` (status 3) variable; show Kick Users when `isUnderConstruction && hasStakers`; update info box message to branch on `hasStakers` inside the `isUnderConstruction` block; remove `isClosed` badge; fix `canEdit` prop |

No other files need to change — the contract action builders and `CloseFarmDialog` toast are already correct from the previous fix.
