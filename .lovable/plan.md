
# Fix: Admin Controls Not Showing for Whitelisted Admins on Banner Ads Page

## Problem
The SlotCalendar component on `/bannerads` hardcodes admin detection as:
```
const isAdmin = accountName === BANNER_CONTRACT;
```
This only recognizes the `cheesebannad` contract account itself as admin. Your account `fragglerockk` is in the on-chain `admins` table but this check doesn't look there, so you don't see Preview, Remove, Edit, or Reinstate buttons.

## Solution
Use the existing `useAdminAccess` hook (which queries the `admins` table via `fetchIsAdmin`) instead of the hardcoded comparison.

## Changes

### `src/components/bannerads/SlotCalendar.tsx`
1. Import `useAdminAccess` from `@/hooks/useAdminAccess`
2. Replace `const isAdmin = accountName === BANNER_CONTRACT;` with `const { isWhitelisted: isAdmin } = useAdminAccess();`
3. All existing `isAdmin` references throughout the component remain unchanged -- they'll now correctly resolve to `true` for any account in the `admins` table (fragglerockk, infiltration, etc.)

That's the only file that needs changing. One import, one line replaced.
