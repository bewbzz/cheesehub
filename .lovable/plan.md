

## Add Frontend-Only Drip Naming

### Approach
Store drip names in `localStorage` keyed by `account:dripID`. Add a name field to the Create Drip form, and inline edit/display on each drip card in My Drips.

### Changes

**1. `src/lib/dripNames.ts` (new)**
- Helper functions: `getDripName(account, dripId)`, `setDripName(account, dripId, name)`, `getAllDripNames(account)`
- Uses localStorage key `cheese_drip_names_{account}` storing a `Record<number, string>`

**2. `src/components/drip/CreateDrip.tsx`**
- Add a "Drip Name (optional)" text input at the top of the form
- After successful creation (when `newDrip.ID` is known), save the name to localStorage via `setDripName`

**3. `src/components/drip/MyDrips.tsx`**
- Pass `accountName` to `DripCard`
- In `DripCard`: display the saved name above the drip ID, with inline click-to-edit (small pencil icon). Editing saves to localStorage immediately
- If no name is set, show a subtle "Add name" link instead

### UI Details
- Create form: simple `Input` field labeled "Drip Name (optional)" with placeholder "e.g. Mike's salary, Vesting Q2"
- Drip card header: name displayed as bold text above "Drip #123". Pencil icon opens inline edit (input + checkmark to save). Empty state shows muted "Add name" text with pencil icon.

### Files
- `src/lib/dripNames.ts` — new, ~20 lines
- `src/components/drip/CreateDrip.tsx` — add name input + save on create
- `src/components/drip/MyDrips.tsx` — display/edit name on each card

