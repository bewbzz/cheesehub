
# Fix CHEESE Fee Payment Action Ordering

## Problem

The error "Must use assertpoint action first" occurs because the WaxDAO contracts (`dao.waxdao` and `farms.waxdao`) require the `assertpoint` action to execute BEFORE receiving any fee payment. Currently, the CHEESE payment flow sends the WAXDAO fee before calling `assertpoint`.

## Root Cause

In both `CreateFarm.tsx` and `CreateDao.tsx`, the action order for CHEESE payments is:

```text
1. cheesePayAction   → Send CHEESE to cheesefeefee
2. waxdaoFeeAction   → Pay WAXDAO fee  ← Contract rejects this
3. assertAction      → assertpoint (comes too late)
4. createAction      → Create entity
```

The WAX payment flow already works correctly because it uses: `assertAction → feeAction → createAction`

## Solution

Reorder the actions so `assertAction` comes before `waxdaoFeeAction`:

```text
1. cheesePayAction   → Send CHEESE (receive WAXDAO back inline)
2. assertAction      → Set up payment context
3. waxdaoFeeAction   → Pay WAXDAO fee (now accepted)
4. createAction      → Create entity
```

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/farm/CreateFarm.tsx` | 248-253 | Swap `waxdaoFeeAction` and `assertAction` positions |
| `src/components/dao/CreateDao.tsx` | 245-251 | Swap `waxdaoFeeAction` and `assertAction` positions |

## Technical Details

### CreateFarm.tsx

**Current (broken):**
```typescript
actions = [
  cheesePayAction,
  waxdaoFeeAction,  // Position 2
  assertAction,     // Position 3
  createAction,
];
```

**Fixed:**
```typescript
actions = [
  cheesePayAction,
  assertAction,     // Position 2 (moved up)
  waxdaoFeeAction,  // Position 3 (moved down)
  createAction,
];
```

### CreateDao.tsx

**Current (broken):**
```typescript
actions = [
  cheesePayAction,
  waxdaoFeeAction,  // Position 2
  assertAction,     // Position 3
  createAction,
  setProfileAction,
];
```

**Fixed:**
```typescript
actions = [
  cheesePayAction,
  assertAction,     // Position 2 (moved up)
  waxdaoFeeAction,  // Position 3 (moved down)
  createAction,
  setProfileAction,
];
```

## Why This Works

The `assertpoint` action tells WaxDAO "a creation fee is about to be paid." By moving it before the fee transfer:

1. **CHEESE payment** executes, and the contract returns WAXDAO to the user (inline action)
2. **assertpoint** signals WaxDAO that a fee payment follows
3. **WAXDAO transfer** is now accepted as a valid creation fee
4. **Creation action** succeeds

No changes are needed to the C++ contracts - this is purely a frontend transaction ordering fix.
