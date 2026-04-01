

## Fix Pack Reveal Not Showing Cards After Real Open

### Root cause
There is a **race condition** in `PackRevealDialog`. When the dialog opens:

1. The reset effect (line 123) runs and calls `setPhase('waiting')`
2. The polling effect (line 145) runs in the **same render cycle**, but may see the previous `phase` value (e.g. `'revealing'` from a prior open), causing it to skip
3. On re-render, both effects run again — but the reset effect re-sets `'waiting'` (triggering another render), creating an unstable loop where polling may never reliably start

Additionally, the AA asset fetch in polling uses `limit=100` which could miss new cards if the user has a large collection, and the 35-second timeout may be too short for slow WAX RNG responses.

### Fix

**`src/components/simpleassets/PackRevealDialog.tsx`**

1. **Consolidate the reset + polling into a single effect** — when `open` becomes true and it's not demo mode, reset state and start polling in one effect. This eliminates the race between two competing effects.

2. **Increase AA polling limit** from 100 to 200 (matches SA and snapshot limits)

3. **Increase timeout** from 35s to 60s — WAX RNG can be slow

4. **Add a small initial delay** (3-4 seconds) before first poll to give the RNG oracle time to process, reducing wasted early polls

5. **Add console logging** to polling so failures are diagnosable:
   - Log when polling starts, each poll result count, when cards are found, and timeout

### Changes summary

```text
Before (2 separate effects):
  Effect 1: reset phase on open change
  Effect 2: start polling if phase === 'waiting' (race condition)

After (1 unified effect):
  Effect: if open && !demo → reset state, wait 4s, then start polling
  Demo effect: unchanged (separate, no conflict)
```

### Files modified: 1
- `src/components/simpleassets/PackRevealDialog.tsx`

