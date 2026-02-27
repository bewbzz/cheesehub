

# Switch Admin Dashboard Gate to cheesebannad Admins Table

## Summary
Replace the current `/admin` access check (which reads from the now-missing `cheeseburner` whitelist table) with a check against the `cheesebannad` admins table instead.

## What Changes

### 1. Update `src/lib/adminData.ts`
- Remove the `fetchWhitelist` function (reads from `cheeseburner` whitelist table)
- Add a new `fetchIsAdmin` function that checks if an account exists in the `cheesebannad` admins table (reusing the existing `fetchBannadAdmins` fetcher)

### 2. Update `src/hooks/useAdminAccess.ts`
- Replace the `fetchWhitelist` call with `fetchIsAdmin`
- Update the query key from `admin-whitelist` to `admin-access`

### 3. No other changes needed
- `Admin.tsx` already consumes `isWhitelisted` from the hook -- this boolean will now reflect cheesebannad admin status instead
- The cheesebannad admins table already exists on-chain and is already being fetched for the dashboard display

## Technical Detail

The new check will query `cheesebannad::admins` and look for a matching account name, identical pattern to the old whitelist check but against a different contract/table:

```typescript
export async function fetchIsAdmin(account: string): Promise<boolean> {
  const rows = await fetchTable<BannadAdmin>(
    CHEESEBANNAD, CHEESEBANNAD, 'admins',
    { lower_bound: account, upper_bound: account, limit: 1 }
  );
  return rows.length > 0 && rows[0].account === account;
}
```

## Files Modified
- `src/lib/adminData.ts` — swap `fetchWhitelist` for `fetchIsAdmin`
- `src/hooks/useAdminAccess.ts` — call `fetchIsAdmin` instead of `fetchWhitelist`

Two small edits, no new dependencies, no contract changes needed.

