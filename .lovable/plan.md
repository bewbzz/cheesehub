

# Fix CHEESEAmp Music Stopping on Minimize

## Problem

When clicking the minimize button (−), music stops playing even though only the close button (X) should stop music.

## Root Cause

The current flow when clicking minimize:

1. `handleMinimize()` in CheeseAmpDialog calls `onMinimize?.()`
2. This calls `setCheeseAmpOpen(false)` in WalletConnect.tsx (line 106)
3. Dialog `open` prop becomes `false`
4. Radix unmounts `DialogContent` and `CheeseAmpPlayer`
5. Something in the unmount chain interferes with the audio singleton

**Key insight**: Even though `getAudioPlayer()` returns a singleton that should persist, when the Dialog unmounts entirely, the React component tree cleanup can cause issues. The `handleOpenChange` guard in CheeseAmpDialog only blocks Radix-initiated closes (like clicking backdrop or ESC), not direct state changes from the parent.

## Solution

Keep the dialog mounted but visually hidden when minimized. This prevents React unmount side effects while keeping audio playing.

---

## Technical Approach

### 1. Add minimized state (WalletConnect.tsx)

Add a separate `minimized` state alongside `open`. The dialog stays `open={true}` while music is playing - we only hide it visually.

```
State Flow:
- Open CHEESEAmp: open=true, minimized=false
- Click Minimize: open=true, minimized=true (dialog hidden but mounted)  
- Click menu to reopen: open=true, minimized=false
- Click Close (X): open=false, minimized=false (audio stopped)
```

### 2. Pass minimized prop to CheeseAmpDialog

The dialog receives a `minimized` prop and applies CSS to hide itself without unmounting.

### 3. Apply visual hiding (CheeseAmpDialog.tsx)

When `minimized=true`, apply CSS to make the dialog invisible and non-interactive:
- `opacity-0` - invisible
- `pointer-events-none` - can't interact
- `scale-95` - slight shrink effect

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/WalletConnect.tsx` | Add `cheeseAmpMinimized` state, update handlers |
| `src/components/music/CheeseAmpDialog.tsx` | Add `minimized` prop, apply hide CSS |

---

## Implementation Details

### WalletConnect.tsx Changes

**Add new state (after line 29):**
```typescript
const [cheeseAmpMinimized, setCheeseAmpMinimized] = useState(false);
```

**Update the event handler for opening (lines 48-58):**
```typescript
useEffect(() => {
  const handleOpenCheeseAmp = () => {
    if (isConnected) {
      setCheeseAmpOpen(true);
      setCheeseAmpMinimized(false); // Un-minimize when opening
    } else {
      setOpen(true);
    }
  };
  window.addEventListener('open-cheese-amp', handleOpenCheeseAmp);
  return () => window.removeEventListener('open-cheese-amp', handleOpenCheeseAmp);
}, [isConnected]);
```

**Update the dropdown menu item (line 91):**
```typescript
<DropdownMenuItem 
  onClick={() => {
    setCheeseAmpOpen(true);
    setCheeseAmpMinimized(false);
  }} 
  className="cursor-pointer"
>
```

**Update CheeseAmpDialog props (lines 103-107):**
```typescript
<CheeseAmpDialog 
  open={cheeseAmpOpen} 
  onOpenChange={(open) => {
    setCheeseAmpOpen(open);
    if (!open) setCheeseAmpMinimized(false);
  }}
  onMinimize={() => setCheeseAmpMinimized(true)}  // Only set minimized, don't close
  minimized={cheeseAmpMinimized}
/>
```

### CheeseAmpDialog.tsx Changes

**Update interface (lines 13-17):**
```typescript
interface CheeseAmpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMinimize?: () => void;
  minimized?: boolean;  // New prop
}
```

**Update function signature (line 19):**
```typescript
export function CheeseAmpDialog({ 
  open, 
  onOpenChange, 
  onMinimize,
  minimized = false 
}: CheeseAmpDialogProps) {
```

**Add cn import if not present, then update DialogContent (lines 43-46):**
```typescript
import { cn } from '@/lib/utils';

// In the return...
<DialogContent 
  className={cn(
    "sm:max-w-[700px] max-h-[90vh] overflow-hidden [&>button]:hidden",
    minimized && "opacity-0 pointer-events-none scale-95"
  )}
  onInteractOutside={(e) => e.preventDefault()}
  onEscapeKeyDown={(e) => e.preventDefault()}
>
```

---

## Expected Behavior After Fix

| Action | Music | Dialog State |
|--------|-------|--------------|
| Click Minimize (−) | Keeps playing | Hidden but mounted (open=true, minimized=true) |
| Click CHEESEAmp menu | Resumes UI | Visible (open=true, minimized=false) |
| Click Close (X) | Stops | Unmounted (open=false) |

The key difference is that minimize no longer unmounts the component tree - it just hides the UI visually. The audio singleton continues playing undisturbed.

