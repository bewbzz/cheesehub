

# Add Kick Users and Empty Farm Features

## Overview

After a farm is closed or permanently closed, add the ability for creators to kick stakers and (if permanently closed) empty remaining reward tokens from the farm.

## User Flow

```text
Farm Expired
     │
     ├── [Close Farm] ─────┐
     │                     │
     └── [Perm Close] ─────┤
                           │
                           ▼
                    [Kick Users]
                    Enter count → kickmany action
                           │
     ┌─────────────────────┴────────────────────┐
     │                                          │
     ▼                                          ▼
  If CLOSED                              If PERM CLOSED
     │                                          │
     ▼                                          ▼
  Can modify                            [Empty Farm]
  stakeable assets                      emptyfarm action
  and reopen                            → retrieves tokens
```

## Files to Create

### 1. `src/components/farm/KickUsersDialog.tsx`

A dialog component for kicking stakers from a farm:

| Element | Description |
|---------|-------------|
| Trigger Button | "Kick Users" button (orange/warning style) |
| Input | Number input for how many users to kick |
| Action | Calls `kickmany` on `farms.waxdao` contract |
| Callback | Takes `onKickComplete` prop to trigger next step |

### 2. `src/components/farm/EmptyFarmDialog.tsx`

A dialog component for emptying remaining reward tokens from a permanently closed farm:

| Element | Description |
|---------|-------------|
| Trigger Button | "Empty Farm" button |
| Warning | Explains this removes all remaining tokens |
| Action | Calls `emptyfarm` on `farms.waxdao` contract |

## Files to Modify

### 3. `src/lib/farm.ts`

Add two new action builders after `buildPermCloseFarmAction`:

| Function | Purpose |
|----------|---------|
| `buildKickManyAction(user, farmName, amount)` | Kicks multiple stakers from a farm |
| `buildEmptyFarmAction(user, farmName)` | Empties remaining rewards from permanently closed farm |

```typescript
// Build action for kicking multiple stakers from a farm
export function buildKickManyAction(user: string, farmName: string, amount: number) {
  return {
    account: FARM_CONTRACT,
    name: "kickmany",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      amount,
    },
  };
}

// Build action for emptying reward tokens from a permanently closed farm
export function buildEmptyFarmAction(user: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "emptyfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
    },
  };
}
```

### 4. `src/components/farm/FarmDetail.tsx`

Update the farm detail page to show the new action flow:

| Change | Description |
|--------|-------------|
| Add imports | Import `KickUsersDialog` and `EmptyFarmDialog` |
| Add state | Track farm closure state (closed vs perm closed) |
| Conditional UI | Show Kick Users after close actions, show Empty Farm after kicks if perm closed |

The UI will detect farm status:
- Status 0 = Under Construction
- Status 1 = Active
- Status 2 = Closed (can be reopened after kicking users)
- Status 3 = Permanently Closed (can only empty farm after kicking)

## Component Details

### KickUsersDialog

```text
┌─────────────────────────────────────────┐
│ 👥 Kick Users from Farm                 │
├─────────────────────────────────────────┤
│ How many users do you want to kick?     │
│                                         │
│ Currently staked: 42 NFTs               │
│                                         │
│ ┌───────────────────────────────────┐   │
│ │ Number of users to kick: [____]   │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Note: Each call kicks up to N users.    │
│ You may need to call multiple times.    │
│                                         │
│              [Cancel] [Kick Users]      │
└─────────────────────────────────────────┘
```

### EmptyFarmDialog

```text
┌─────────────────────────────────────────┐
│ 💰 Empty Farm Rewards                   │
├─────────────────────────────────────────┤
│ Retrieve remaining reward tokens?       │
│                                         │
│ Remaining balances:                     │
│ • 1,000.00 CHEESE                       │
│ • 50.00 WAX                             │
│                                         │
│ These tokens will be sent to your       │
│ account.                                │
│                                         │
│              [Cancel] [Empty Farm]      │
└─────────────────────────────────────────┘
```

## Visibility Logic

The buttons appear based on farm status and staked count:

| Farm Status | Staked Count | Shows |
|-------------|--------------|-------|
| Expired, not closed | N/A | Close + Perm Close buttons |
| Closed (status 2) | > 0 | Kick Users button |
| Closed (status 2) | 0 | Modify assets + Open Farm (existing) |
| Perm Closed (status 3) | > 0 | Kick Users button |
| Perm Closed (status 3) | 0 | Empty Farm button |

## Summary

| File | Action |
|------|--------|
| `src/lib/farm.ts` | Add `buildKickManyAction` and `buildEmptyFarmAction` |
| `src/components/farm/KickUsersDialog.tsx` | Create kick users dialog |
| `src/components/farm/EmptyFarmDialog.tsx` | Create empty farm dialog |
| `src/components/farm/FarmDetail.tsx` | Add conditional rendering for new dialogs |

