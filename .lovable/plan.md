

# Persist Accounts After Disconnect for Easy Switching

## What You Want

Currently when you click "Disconnect", the account is removed from storage and can't be switched back to. You want accounts to **persist** so you can switch between all accounts you've ever logged into:

```text
Login A → disconnect → Login B → can switch to A
→ disconnect → Login C → can switch to A, B, C
```

## The Problem

The current `logout()` function calls `sessionKit.logout(session)` which **removes** the session from WharfKit's localStorage. That's why your previous account disappears.

## The Solution

Change "Disconnect" behavior:
- **Currently**: Calls `sessionKit.logout()` → removes session from storage
- **New behavior**: Only clears the active session state → keeps session in storage

The "Remove Account" button (X icon) will be the only way to permanently delete an account from the list.

## Technical Changes

### 1. Update `logout()` in WaxContext.tsx

Instead of calling `sessionKit.logout(session)`, simply clear the local state:

```typescript
const logout = async () => {
  if (session) {
    // DON'T call sessionKit.logout() - that removes from storage
    // Just clear the active session state
    setSession(null);
    setCheeseBalance(0);
    toast({
      title: 'Wallet Disconnected',
      description: 'You have been logged out. Your account is saved for quick switching.',
    });
    // Sessions remain in storage for future switching
  }
};
```

### 2. Keep `removeAccount()` As-Is

This function already calls `sessionKit.logout()` to permanently delete from storage - that's the intended behavior for the X button.

### 3. Update Connect Flow

When not connected but sessions exist, show "Connect" which offers:
- Quick-switch to a stored account, OR
- Add a new account via wallet login

## User Experience After This Change

| Action | Before | After |
|--------|--------|-------|
| Click Disconnect | Account deleted from list | Account stays in list |
| Click X on account | Account deleted | Account deleted (same) |
| Login new account | Only new account in list | All previous + new account in list |
| Refresh page | Need to re-login | Can quick-switch to any saved account |

## Files to Modify

| File | Change |
|------|--------|
| `src/context/WaxContext.tsx` | Update `logout()` to not call `sessionKit.logout()` |

## Session Limit

WharfKit doesn't have a built-in limit on stored sessions. It stores all sessions in localStorage. You could add dozens of accounts if needed. The practical limit is localStorage space (typically 5-10MB, which is plenty for session data).

