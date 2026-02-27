

## Fix: Wrong Contract Action Name for Shared Banner Edits

### Problem
The contract defines the action as `editsharedad`, but the frontend uses `editsharedbanner` in two places, causing an ABI error when trying to edit or rent a shared banner slot.

### Changes

**File 1: `src/components/bannerads/RentSlotDialog.tsx` (line 84)**
- Change `"editsharedbanner"` to `"editsharedad"`

**File 2: `src/components/bannerads/EditBannerDialog.tsx` (line 43)**
- Change `"editsharedbanner"` to `"editsharedad"`

Both are single-line string replacements.

