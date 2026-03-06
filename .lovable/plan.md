
Goal: stop the churn, restore CHEESEBoard quickly, then only add one safe improvement.

What’s actually broken
- The current query uses `act.data.to=cheesepowerz`, which returns zero actions on EOSUSA/WaxSweden.
- Hyperion expects `transfer.to=cheesepowerz` for token transfer filtering.
- We also have bad fallback endpoints (`wax.greymass.com` returns 404 for `/v2/history/get_actions`) causing noisy failures.

Reset-first approach (minimal, not overengineered)
1) Revert to a known-good, simple fetch path in `src/lib/fetchPowerupLeaderboard.ts`
- Use `transfer.to=cheesepowerz` (not `act.data.to`).
- Start with one known-working endpoint first: `https://wax.eosphere.io/v2/history/get_actions`.
- Keep pagination exactly as-is (`limit/skip`) to preserve historical loading behavior.
- Keep aggregation unchanged.

2) Add one safe fallback only (optional but low risk)
- Secondary endpoint: `https://wax.eosusa.io/v2/history/get_actions`.
- Remove WaxSweden/Greymass from this leaderboard path to avoid CORS/404 noise.

3) Improve failure visibility (small UX fix)
- If fetch fails, surface “Error loading leaderboard” (already wired) and log which endpoint failed.
- If fetch succeeds with zero rows, keep “No data yet”.

Why this matches your request
- It “goes back and starts again” from the last working idea (simple transfer-history query).
- It avoids extra complexity and focuses only on getting data back reliably.

Files to update
- `src/lib/fetchPowerupLeaderboard.ts`
  - query param correction: `transfer.to=cheesepowerz`
  - endpoint list cleanup to known working providers
- No UI structural changes needed in leaderboard/page components.

Validation checklist (after patch)
- Network request shows:
  - `/v2/history/get_actions?act.account=cheeseburger&act.name=transfer&transfer.to=cheesepowerz...`
- Response has `total.value > 0` and non-empty `actions`.
- CHEESEBoard renders rows (not “No data yet”).
- Sort toggle still works (CHEESE Burned vs Powerups).

Optional next tiny fix (after data is back)
- Add a small note: “Top 10 only” so it’s clear why top-10 sum can be less than total CHEESE in stats bar.
