

## Remove "Packs" Category, Ensure Pack-Only Categories Appear

### Problem
1. "Packs" exists as a category in the dropdown (from AA cards with schema `packs`). It should not be a standalone category.
2. If a user has Crash Gordon packs but no Crash Gordon cards, "Crash Gordon" won't appear in the category dropdown because `categories` is derived only from card assets.
3. Packs are already filtered by category correctly via `PACK_CATEGORY_MAP` and `ATOMIC_PACK_CATEGORY_MAP`, so the mapping is fine — just need to clean up the category list.

### Changes (1 file: `src/pages/SimpleAssets.tsx`)

1. **Remove `packs` from `CATEGORY_LABELS`** — no longer needed as a category.

2. **Exclude `packs` category from the card assets** when building the `categories` list — filter out any asset with `category === 'packs'` from the categories memo.

3. **Expand `categories` to include pack-only categories** — merge in categories from `PACK_CATEGORY_MAP` values (for token packs the user owns) and `ATOMIC_PACK_CATEGORY_MAP` values (for atomic packs the user owns), so that e.g. "Crash Gordon" appears in the dropdown even if the user has zero Crash Gordon cards but has a Crash Gordon pack.

4. **Also filter out cards with `category === 'packs'` from the `filtered` list** so pack NFTs don't show as card grid items (they're already shown via the dedicated pack sections above the grid).

### Technical detail
```typescript
// categories memo becomes:
const categories = useMemo(() => {
  const fromAssets = new Set(assets.map(a => a.category).filter(c => c !== 'packs'));
  // Add categories from owned token packs
  for (const p of packs) {
    const cat = PACK_CATEGORY_MAP[p.symbol];
    if (cat) fromAssets.add(cat);
  }
  // Add categories from owned atomic packs
  for (const p of atomicPacks) {
    const cat = ATOMIC_PACK_CATEGORY_MAP[p.templateId];
    if (cat) fromAssets.add(cat);
  }
  return [...fromAssets].sort();
}, [assets, packs, atomicPacks]);

// filtered memo adds: && a.category !== 'packs'
```

