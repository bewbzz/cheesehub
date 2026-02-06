

# Fix: Enable Stakable Asset Editing for testfarm3

## Root Cause Analysis

After reviewing the code, the current condition at line 268 is:

```typescript
canEdit={isClosed && !hasStakers && !isPermClosed}
```

For testfarm3, if `status === 2` (Closed), the edit buttons should appear **unless** `staked_count > 0`.

However, there's a secondary issue: the UI shows "Under Construction" badge even for closed farms if `expiration === 0` (line 179), which is confusing.

## Two-Part Fix

### Part 1: Expand Edit Eligibility (Main Fix)

Add "Under Construction" farms to the edit eligibility, since these haven't been opened yet and have no stakers by definition:

| Status | Stakers | Current Behavior | New Behavior |
|--------|---------|------------------|--------------|
| Under Construction (status 0) | n/a | No edit | **Edit allowed** |
| Closed (status 2) | 0 | Edit allowed | Edit allowed |
| Closed (status 2) | >0 | No edit | No edit |
| Active/Perm Closed | any | No edit | No edit |

### Part 2: Fix Status Badge Display

The current badge logic doesn't show "Closed" or "Permanently Closed" statuses. Update it to:

```text
Priority order for badge display:
1. Permanently Closed (status 3) → Red "Permanently Closed" badge
2. Closed (status 2) → Amber "Closed" badge  
3. Under Construction (status 0 OR expiration 0) → Amber "Under Construction" badge
4. Expired → Red "Expired" badge
5. Active → Green "Active" badge
```

## Files to Modify

### 1. src/components/farm/FarmDetail.tsx

**Change 1 - Update canEdit condition (line 268):**

From:
```typescript
canEdit={isClosed && !hasStakers && !isPermClosed}
```

To:
```typescript
canEdit={(isUnderConstruction || (isClosed && !hasStakers)) && !isPermClosed}
```

**Change 2 - Update status badge display (lines 240-249):**

From the current priority (Under Construction → Expired → Active) to include Closed states:

```typescript
{isPermClosed ? (
  <Badge variant="destructive">Permanently Closed</Badge>
) : isClosed ? (
  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
    <XCircle className="h-3 w-3 mr-1" />
    Closed
  </Badge>
) : isUnderConstruction ? (
  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
    <Construction className="h-3 w-3 mr-1" />
    Under Construction
  </Badge>
) : isExpired ? (
  <Badge variant="destructive">Expired</Badge>
) : (
  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
)}
```

## Summary

| File | Change |
|------|--------|
| `src/components/farm/FarmDetail.tsx` (line 268) | Expand `canEdit` to include `isUnderConstruction` |
| `src/components/farm/FarmDetail.tsx` (lines 240-249) | Add "Closed" and "Permanently Closed" badges |

