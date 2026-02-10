
# Fix: Replace Close Farm with Working Actions for Expired Farms

## What's Actually Happening

The farm testfarm3 **is genuinely expired** (status 0, past expiration). It was never closed -- the `closefarm` contract action only works on **active** farms that haven't expired yet. The "farm is not open" error is the contract rejecting the action because the farm already expired naturally.

For expired farms with no stakers, you don't need to "close" them first. You can directly:
- **Open Farm** again (set a new expiration and reactivate)
- **Perm Close** (permanently shut down and retrieve leftover rewards)

## Changes

### File: `src/components/farm/FarmDetail.tsx`

**Button visibility for expired farms (lines 379-385)**

Replace the Close Farm + Perm Close button pair for expired farms with:
- **Open Farm** button (to reopen with new expiration) -- only when no stakers
- **Perm Close** button (to permanently shut down) -- always available for expired
- **Kick Users** button -- only when there are stakers
- Remove the **Close Farm** button from the expired state entirely since the contract does not support closing an already-expired farm

**Updated guidance text for expired farms (lines 311-318)**

Update the creator info box to reflect the actual available options:
- If stakers remain: kick all users first, then choose to reopen or permanently close
- If no stakers: directly reopen or permanently close

### Updated Button Logic

| Farm State | Stakers? | Buttons Shown |
|---|---|---|
| Active (status 0, future expiry) | Any | Close Farm, Extend |
| Expired (status 0, past expiry) | Yes | Kick Users, Perm Close |
| Expired (status 0, past expiry) | No | Open Farm, Perm Close |
| Closed (status 2) | Yes | Kick Users |
| Closed (status 2) | No | Open Farm |
| Perm Closed (status 3) | Yes | Kick Users |
| Perm Closed (status 3) | No | Empty Farm |
| Under Construction | No | Open Farm |

### Technical Detail

The expired-farm button section (lines 379-385) changes from:

```typescript
{isCreator && isExpired && !isClosed && !isPermClosed && (
  <>
    <CloseFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
    <PermCloseFarmDialog farm={farm} onSuccess={() => navigate('/farm')} />
  </>
)}
```

To:

```typescript
{isCreator && isExpired && !isClosed && !isPermClosed && (
  <>
    {hasStakers ? (
      <KickUsersDialog farm={farm} onSuccess={handleFarmUpdated} />
    ) : (
      <OpenFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
    )}
    <PermCloseFarmDialog farm={farm} onSuccess={() => navigate('/farm')} />
  </>
)}
```

The guidance text in the info box will also update to match these options.
