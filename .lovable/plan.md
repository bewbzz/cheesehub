

## Fix Series 1 Variant Sort Order

### Problem
The current sort uses alphabetical `localeCompare` on the `quality` field when cards share the same `cardid`. This produces: base, collector, prism, sketch — but the correct order is: **base, prism, sketch, collector**.

### Change

**`src/pages/SimpleAssets.tsx`** (sort logic, ~line 57-67)
- Replace `a.quality.localeCompare(b.quality)` with a lookup against a defined variant order: `['base', 'prism', 'sketch', 'collector']`
- Unknown variants fall to the end, preserving alphabetical as fallback

```text
Card 1a base → Card 1a prism → Card 1a sketch → Card 1a collector → Card 1b base → ...
```

### Files modified: 1
- `src/pages/SimpleAssets.tsx`

