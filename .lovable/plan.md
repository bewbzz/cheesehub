

# 3D Bubble Effect for Floating Cheese Orb

## What Changes

Upgrade the flat circular orb container from a simple `cheese-glow` box-shadow into a glossy 3D bubble effect with depth, highlights, and a subtle inner shine -- making it look like a glass sphere holding the cheese logo.

## Visual Effect

The bubble will have:
- A radial gradient background simulating light hitting a sphere (bright highlight top-left, darker bottom-right)
- An inner box-shadow for depth/concavity
- A pseudo-element overlay for a glossy specular highlight (the "shine" on glass)
- The existing outer cheese-glow kept for the ambient glow

## Technical Details

### 1. Add `.cheese-bubble` utility class in `src/index.css`

A new CSS utility class that layers multiple effects:

```css
.cheese-bubble {
  background: radial-gradient(
    circle at 35% 30%,
    hsl(var(--cheese-light) / 0.4) 0%,
    hsl(var(--cheese) / 0.15) 40%,
    hsl(var(--cheese-dark) / 0.25) 70%,
    transparent 100%
  );
  box-shadow:
    0 0 20px hsl(var(--cheese) / 0.3),
    0 0 40px hsl(var(--cheese) / 0.15),
    inset 0 -4px 12px hsl(var(--cheese-dark) / 0.3),
    inset 0 4px 8px hsl(var(--cheese-light) / 0.4);
  position: relative;
  overflow: hidden;
}

.cheese-bubble::before {
  content: '';
  position: absolute;
  top: 8%;
  left: 18%;
  width: 35%;
  height: 25%;
  background: radial-gradient(
    ellipse,
    rgba(255, 255, 255, 0.5) 0%,
    transparent 70%
  );
  border-radius: 50%;
  pointer-events: none;
}
```

### 2. Update all orb containers across pages

Replace `cheese-glow` with `cheese-bubble` on the orb `div` in these files:
- `src/pages/CheeseNull.tsx`
- `src/pages/Dao.tsx`
- `src/pages/Farm.tsx`
- `src/pages/Locker.tsx`
- `src/pages/PowerUp.tsx`
- `src/pages/BannerAds.tsx`
- `src/components/drops/DropsHero.tsx`

Each change is a single class swap, e.g.:
```
- "h-32 w-32 animate-float cheese-glow rounded-full ..."
+ "h-32 w-32 animate-float cheese-bubble rounded-full ..."
```

No other files or logic are affected.
