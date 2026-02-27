

## Remove User Edit Button from Banner Ads

### Problem
After renting a banner slot and uploading content, users can currently edit their banner image/URL via an "Edit" button. This creates a moderation risk: a user could get approval for an innocent image, then swap it for offensive content.

### Solution
Remove the "Edit" button visibility for regular (non-admin) users in `SlotCalendar.tsx`. Admins retain full control.

### Change

**File: `src/components/bannerads/SlotCalendar.tsx` (~line 161-169)**

Update the Edit button condition to only show for admins:

```tsx
// Before:
{slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && (

// After:
{isAdmin && slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && (
```

Since `isAdmin` checks `accountName === BANNER_CONTRACT`, and the admin account is never the renter, this effectively hides the Edit button entirely. A simpler approach: just remove the Edit button block for non-admins completely by wrapping it with `isAdmin &&`.

Alternatively, since admins already have Preview + Remove buttons, we can simply remove the Edit button condition for slot owners entirely -- keeping `EditBannerDialog` available only if we want admins to use it in the future.

**Simplest fix**: Change the condition on line 161 from:

```tsx
{slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && (
```

to:

```tsx
{false && slot.isOnChain && !slot.suspended && (slot.user === accountName || slot.sharedUser === accountName) && (
```

Or cleaner: just remove the Edit button block entirely since users set their content during the rental transaction and admins have their own controls.

