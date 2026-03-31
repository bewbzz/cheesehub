

## Sort GPK Cards by Card Number + Quality (1a, 1b, 2a, 2b...)

### Discovery
The `cardid` field contains just the number (e.g. `"1"`, `"2"`, `"3"`), and the `quality` field contains the letter variant (`"a"` or `"b"`). Both are in `idata`/`mdata`.

### Changes

**`src/hooks/useSimpleAssets.ts`**
- Extract `cardid` and `quality` from the combined `idata`/`mdata` metadata
- Add both as fields on the `SimpleAsset` interface
- Replace the current sort with a comparator that:
  1. Parses `cardid` as a number → sort ascending
  2. Sorts by `quality` alphabetically (a before b)
  3. Falls back to asset ID if either field is missing

Result: cards display as `1a, 1b, 2a, 2b, 3a, 3b, ...`

### Files modified: 1
- `src/hooks/useSimpleAssets.ts`

