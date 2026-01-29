

# Fix: DialogOverlay Not Being Hidden

## Problem

The CSS selector `[&_[data-radix-dialog-overlay]]:hidden` doesn't work because the overlay is rendered inside a **Portal** that attaches directly to `document.body`, not as a child of our wrapper div.

## Solution

The simplest fix is to add an `overlayClassName` prop to `DialogContent` so we can pass styles directly to the overlay.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/dialog.tsx` | Add `overlayClassName` prop to DialogContent |
| `src/components/music/CheeseAmpDialog.tsx` | Pass `overlayClassName="hidden"` when minimized |

---

## Technical Details

### 1. Modify dialog.tsx

Update `DialogContent` to accept an optional `overlayClassName` prop and pass it to `DialogOverlay`:

```typescript
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, children, overlayClassName, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content ...>
```

### 2. Update CheeseAmpDialog.tsx

Remove the wrapper div and just pass the overlayClassName:

```tsx
<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogContent 
    className={cn(
      "sm:max-w-[700px] max-h-[90vh] overflow-hidden [&>button]:hidden",
      minimized && "opacity-0 pointer-events-none scale-95"
    )}
    overlayClassName={minimized ? "hidden" : ""}
    onInteractOutside={(e) => e.preventDefault()}
    onEscapeKeyDown={(e) => e.preventDefault()}
  >
```

---

## Why This Works

By passing a className directly to the DialogOverlay component, we can control its visibility regardless of where it's portaled. When `minimized=true`, the overlay gets `hidden` class which uses `display: none`, completely removing it from view and pointer events.

