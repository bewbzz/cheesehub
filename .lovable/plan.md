

# Fix Burner Status Display + Deviation Bar Scaling

## Problem 1: Burner Shows "Disabled" When It's Actually Running

The `cheeseburner` contract is functioning, but its old `config` table is no longer in the ABI after redeployment. Since the fetch returns `null`, the dashboard interprets `enabled = undefined` as "Disabled" and marks it critical.

**Fix**: Distinguish between "config unavailable" and "actually disabled". When `burnerConfig` is `null`, show a neutral "Config Unavailable" badge instead of "Disabled", and set the card status to `ok` (not critical). The stats table still works, so burns/claimed/burned values will still display.

## Problem 2: Deviation Bar Fills Disproportionately

The bar represents a range from -10% to +10%, with 0% at the center (50% position). Currently the bar width is calculated as:

```
width: Math.abs(deviationPct) * 10
```

A 3.62% deviation produces a 36.2% wide bar starting from the 50% mark -- visually filling ~72% of one half. But 3.62% out of 10% should only fill ~36% of one half (18% of total bar).

**Fix**: The bar's half is 50% of the container. A deviation of 10% should fill that entire half. So the formula should be:

```
width: Math.abs(deviationPct) * 5   (i.e. 10% -> 50% width)
```

This way +3.62% produces an 18.1% wide bar starting at the 50% mark, correctly filling about 36% of the right half.

## Files to Change

### `src/pages/Admin.tsx`
- Change `burnerDisabled` logic: only treat as disabled when config exists AND `enabled === 0`
- When `burnerConfig` is null, show "Config Unavailable" (neutral/info badge) instead of "Disabled"
- Set card status to `ok` when config is simply unavailable

### `src/components/admin/PriceDeviationGauge.tsx`
- Change bar width formula from `Math.abs(deviationPct) * 10` to `Math.abs(deviationPct) * 5`
- This correctly maps the 0-10% range onto the 0-50% half of the bar

