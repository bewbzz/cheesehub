

## Open Help Guide to Anchor Warning Section on Click

### Problem
Clicking "help guide" in the amber warning opens the help dialog, but doesn't scroll/open to the relevant "Dangerous Transaction" accordion item.

### Approach
Add a state variable to track which accordion item should be pre-opened. When clicking the "help guide" link, set this value to the anchor warning item before opening the dialog.

### Changes

**`src/components/farm/CreateFarm.tsx`**
- Add `defaultAccordionValue` state (string or undefined)
- On "help guide" click: set it to `"item-5"` (the anchor FAQ is index 5, the last item) and open dialog
- On normal dialog open (info button): clear it
- Pass `value`/`onValueChange` to the Accordion so it opens to the right item

**`src/components/dao/CreateDao.tsx`**
- Add `defaultAccordionValues` state (string array)
- On "help guide" click: set it to include `"anchor-warning"` and open dialog
- On normal dialog open: use existing defaults
- Pass controlled `value`/`onValueChange` to the Accordion

Both files: ~5 lines changed each.

