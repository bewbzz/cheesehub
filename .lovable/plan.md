

# Fix: Create Drip Button Stays Disabled With No Feedback

## Problem
The "Create Drip" button has a `disabled` condition checking 7 fields, but there's no visual indication of which field is missing or invalid. The user fills out all fields but the button remains disabled with no explanation.

Additionally, there's a duplicate `useEffect` block (the token auto-fill effect appears twice at lines 47-68), which is harmless but should be cleaned up.

## Root Cause
The disabled condition is:
```
disabled={creating || !receiver || !payoutAmount || !tokenName || !tokenContract || !hoursBetween || !endDate}
```

One of these values is likely empty despite the form appearing complete. Common scenarios:
- User selected a token from the dropdown but `tokenContract` or `tokenName` didn't populate (race condition or key mismatch)
- User entered values in some fields but missed one (no visual feedback to identify which)

## Solution

### 1. Remove duplicate useEffect in `CreateDrip.tsx`
Delete the second identical `useEffect` block (lines 58-68) that duplicates the token auto-fill logic.

### 2. Add validation feedback below the button
Add a small helper that shows which field(s) are still missing when the button is disabled. Display it as a subtle text list below the button, e.g.:
- "Missing: Receiving Account"
- "Missing: Token Contract"

This way the user immediately knows what's preventing submission.

### 3. Add console.log for debugging
Temporarily log the form state values when the button render occurs so we can verify in the console which field is empty.

## Technical Changes

**File: `src/components/drip/CreateDrip.tsx`**

1. Remove duplicate `useEffect` (lines 58-68)
2. Add a `missingFields` computed array that checks each required field and returns human-readable names for any that are empty
3. Render `missingFields` as a small warning list below the Create Drip button when the button is disabled
4. Add a `console.log` of form state for debugging

