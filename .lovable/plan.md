

# Compact 4x1 Stat Rows in NullStats and NullTotalStats

Change the distribution breakdown in both components from a 2x2 grid to a single horizontal 4x1 row. Each stat becomes a compact inline item showing icon + label + value on one line.

## Changes

### 1. NullStats.tsx (Claim Box)
- Change `grid grid-cols-2 gap-3` to `flex items-center justify-center gap-4` (or `grid grid-cols-4`)
- Condense each stat item: put the icon, label, and value on fewer lines (icon+label on one line, value directly below)
- Remove the separate "CHEESE" / "WAX" unit line -- append the unit inline with the value to save vertical space
- Reduce spacing from `space-y-1` to `space-y-0.5` per item

### 2. NullTotalStats.tsx (Lifetime Stats Box)
- Same layout change: `grid grid-cols-2 gap-3` becomes `grid grid-cols-4 gap-2`
- Same condensing of each stat item -- icon+label on one line, value+unit on the next
- Remove the standalone unit `<p>` tag, merge it inline with the value

### Result
Each breakdown section becomes a single compact row of 4 items instead of a 2x2 block, reducing card height while keeping all information visible.

