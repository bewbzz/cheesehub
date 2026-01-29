

# Simple Fix: Hide the Overlay When Minimized

## The Problem
The `DialogOverlay` (dark backdrop at line 35 in dialog.tsx) is always rendered and blocks all clicks. We're only hiding the content, not the overlay.

## The Simple Fix
Add `pointer-events-none` and `opacity-0` to the overlay when minimized. 

### Option 1: Quick CSS fix in CheeseAmpDialog (1 line change)
Just target the overlay with a CSS selector on the wrapper:

```tsx
// CheeseAmpDialog.tsx - wrap the Dialog
<div className={minimized ? "[&_[data-radix-dialog-overlay]]:hidden" : ""}>
  <Dialog ...>
```

### Option 2: Pass overlayClassName prop (cleaner)
Modify dialog.tsx to accept an `overlayClassName` prop and pass it through.

---

## Recommended: Option 1 (Fastest)

Just wrap the Dialog in a div with a CSS selector that hides the overlay when minimized:

| File | Change |
|------|--------|
| `src/components/music/CheeseAmpDialog.tsx` | Wrap Dialog in div with overlay-hiding CSS |

**One line wrap:**
```tsx
return (
  <div className={minimized ? "[&_[data-radix-dialog-overlay]]:hidden" : ""}>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* existing content */}
    </Dialog>
  </div>
);
```

This uses Tailwind's child selector to target the Radix overlay by its data attribute and hide it when minimized.

