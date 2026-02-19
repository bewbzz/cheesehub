
# Fix: Farm Shows as Expired Instead of Under Construction After Closing

## Root Cause — Wrong State Machine Assumption

The current code determines "Under Construction" as:
```tsx
const isUnderConstruction = farm.status === 0 && farm.expiration <= 1;
```

This is **incorrect**. Looking at the actual on-chain data from the network log:
- After `closefarm` executes: `status = 0`, `expiration = 1771423200` (the old expiration is KEPT — not reset to 1)
- `last_state_change` updates to the close transaction time: `1771487514`

The `farms.waxdao` contract does NOT reset `expiration` to `1` when you call `closefarm`. The expiration stays at whatever value it had. So the check `expiration <= 1` never fires after a close — it only fires for a brand-new farm that was never opened.

The WaxDAO UI determines "Under Construction / Closed" by checking **only `status === 0`**, not the expiration value. Both a new farm (never opened) and a closed farm land on `status = 0`.

## The Correct State Machine

```text
status === 0  → Under Construction (includes: newly created AND post-closefarm)
status === 1  → Active (opened and not expired)
status === 2  → Permanently Closed
```

The `expiration` field is only useful for distinguishing Active vs Expired when `status === 1`. When `status === 0`, the farm is always "Under Construction" regardless of expiration value.

## The Fix — One Line Change

### `src/components/farm/FarmDetail.tsx`

**Line 200 — Change `isUnderConstruction`:**

Current:
```tsx
const isUnderConstruction = farm.status === 0 && farm.expiration <= 1;
```

Replace with:
```tsx
const isUnderConstruction = farm.status === 0;
```

This single change fixes everything:
- `testtestfarm` has `status = 0` → `isUnderConstruction = true` → shows "Under Construction" badge
- `isExpired` (line 204) is `!isUnderConstruction && !isPermClosed && farm.expiration < now` → becomes `false` because `isUnderConstruction` is `true`
- The Kick Users button condition `isUnderConstruction && hasStakers` → shows the button
- A brand new farm that was never opened also has `status = 0` → also shows "Under Construction" correctly
- The Close/Perm Close buttons only show when `isExpired` → will no longer show when status = 0

## Why the `expiration <= 1` sentinel was wrong

The assumption that WaxDAO uses `expiration = 1` as a sentinel for "never opened" was based on observing that newly created farms start with `expiration = 1`. But after `closefarm`, the expiration is NOT reset — so the sentinel approach only worked for new farms. The correct check is purely `status === 0`.

## Files to Change

| File | Change |
|---|---|
| `src/components/farm/FarmDetail.tsx` | Line 200: Change `farm.status === 0 && farm.expiration <= 1` to just `farm.status === 0` |

That is the only change needed. All downstream logic (`isExpired`, `isPermClosed`, the badge rendering, the Kick Users button condition, the Close/PermClose button condition) is already correctly written — it just needs `isUnderConstruction` to be true.
