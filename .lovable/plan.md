

## Remove Redundant Shuffle Toggle and Label the Player Shuffle Button

### What changes

1. **Remove** the shuffle toggle (icon + "Shuffle" text + Switch) next to the Global menu tab (lines 549-561 in `CheeseAmpPlayer.tsx`). This includes the spacer div above it.

2. **Update** the shuffle button in the transport controls (lines 432-442) to include a yellow "Shuffle" label below the icon:
   - Wrap the button in a flex-column container
   - Add a `<span>` with text "Shuffle" below the button, styled `text-[10px] text-cheese` (always yellow)
   - Keep the existing icon highlight behavior (yellow when active)

### Technical details

**File: `src/components/music/CheeseAmpPlayer.tsx`**

- **Lines 549-561**: Delete the spacer div and the entire Shuffle Toggle block (the `div.flex.items-center.gap-2` containing the `Switch` component)
- **Lines 432-442**: Wrap the shuffle `Button` in a `<div className="flex flex-col items-center">` and add `<span className="text-[10px] text-cheese -mt-1">Shuffle</span>` beneath it

