

## Drippy Cheese Animation on Null Success

When a successful null/burn transaction completes, gooey drippy yellow cheese will drip from the top edges of the main container, flowing down the sides.

### Approach

**1. New component: `src/components/cheesenull/CheeseDrip.tsx`**
- Renders 10-15 absolutely-positioned "drip" elements along the top edge of the container
- Each drip is a CSS-animated yellow/gold blob that stretches and slides downward with varying delays, speeds, and sizes for organic randomness
- Uses CSS `border-radius` tricks + `@keyframes` to create the gooey dripping effect (elongating blobs that stretch, drip, and fade out)
- Component accepts `active: boolean` prop — when true, drips animate for ~4 seconds then auto-dismiss
- Pure CSS animation, no video file needed (the uploaded video is reference only)

**2. Wire into CheeseNull page (`src/pages/CheeseNull.tsx`)**
- Add `isDripping` state, set to `true` in `handleBurnSuccess`, auto-reset after ~4s
- Wrap the main content `<div>` in a `relative overflow-hidden` container
- Render `<CheeseDrip active={isDripping} />` inside that container

**3. CSS keyframes (in the component or `index.css`)**
- `cheese-drip`: translateY from -100% to 120vh with scaleX oscillation for gooey wobble
- `cheese-drip-blob`: subtle pulsing scale for the drip head
- Colors: `hsl(42, 90%, 50%)` to `hsl(38, 80%, 35%)` gradient (cheese theme tokens)

### Files
- **Create** `src/components/cheesenull/CheeseDrip.tsx`
- **Edit** `src/pages/CheeseNull.tsx` — add drip state + component

