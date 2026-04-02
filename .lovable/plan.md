
I found your cards.

## What I verified on-chain

Your pack open `af5ebc4121e4974b2bfc7d238c6d70eee6ef8fd7bbe45d2ace8fe0a357873f5e` created an unboxing job with `assoc_id / unboxingid = 30355`.

In `gpk.topps` table `pendingnft.a`, scoped to your account `guydgnjzgage`, there are 8 rows for that unboxing:

```text
id        unboxingid draw boxtype     user         variant quality done cardid
30355000  30355      0    gpktwoeight guydgnjzgage slime   b       0    13
30355001  30355      1    gpktwoeight guydgnjzgage slime   b       0    35
30355002  30355      2    gpktwoeight guydgnjzgage slime   a       0    21
30355003  30355      3    gpktwoeight guydgnjzgage slime   b       0    4
30355004  30355      4    gpktwoeight guydgnjzgage raw     a       0    32
30355008  30355      8    gpktwoeight guydgnjzgage base    b       0    30
30355009  30355      9    gpktwoeight guydgnjzgage base    b       0    1
30355010  30355      10   gpktwoeight guydgnjzgage base    b       0    3
```

## The important difference vs successful opens

I also checked a successful user scope (`rvfr2.wam`) in the same `pendingnft.a` table.

For their pack rows:
- the same kind of entries exist
- but their `done` value is `1`

For your 8 rows:
- `done = 0` on every row

## Conclusion

Your cards are not lost in the UI and they are not just “pending indexers”.

They are stuck inside `gpk.topps` as unresolved pending mint rows for unboxing `30355`.

That is the concrete reason they never appeared in your wallet:
- card outcomes were generated
- rows were written into `pendingnft.a`
- the contract never completed the final step that marks them done and delivers them

## What to build next

1. Add a GPK recovery inspector to `/simpleassets`
   - query `pendingnft.a`, `mintcounts.a`, and `rngjobs`
   - group by `unboxingid`
   - show exact stuck cards like the 8 above

2. Upgrade `PackRevealDialog`
   - after open, check contract tables in addition to wallet assets
   - detect:
     - wallet delivered
     - pending contract rows
     - fully stuck mint

3. Show a precise stuck-state UI
   - “Your cards are stuck in `gpk.topps` pending queue”
   - show `unboxingid 30355`
   - show the exact 8 pending cards
   - link the opening tx and callback tx

4. If the ABI exposes a finalize/claim action, wire a recovery flow
   - inspect contract actions for a mint-finalize or claim path
   - if callable by user, add a “Recover Pending Cards” button
   - if not callable, expose the exact evidence needed for Topps/manual recovery

## Technical details

```text
Your flow:
pack tx succeeds
-> RNG/callback resolves
-> pendingnft.a rows written
-> rows remain done=0
-> no wallet delivery

Successful flow:
pack tx succeeds
-> RNG/callback resolves
-> pendingnft.a rows written
-> rows become done=1
-> cards appear in wallet
```

So the real issue is not “where did the cards go?” anymore.

They are sitting in `gpk.topps.pendingnft.a` under unboxing `30355`, waiting on the final mint/complete step that never happened.
