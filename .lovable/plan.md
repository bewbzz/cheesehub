

## Analysis: Terms of Use Gaps

After comparing the updated Clause (13 sections, including the new Section 7 with 9 dApp subsections) against the current Terms of Use (13 sections), there are several concepts users should explicitly acknowledge in the Terms that are currently only disclosed in the Clause.

### Gaps Identified

**1. No financial services acknowledgement**
The Clause (Section 5) explicitly states CHEESEHub holds no financial licence. The Terms have no corresponding user acknowledgement. Users should confirm they understand CHEESEHub is not a regulated financial service.

**2. CHEESENull — supply reduction ≠ value increase**
The Clause (7.1) discloses the multi-purpose distribution and explicitly states nulling does not add value. The Terms should include a user acknowledgement that token burning does not imply or guarantee price appreciation.

**3. CHEESEShip — consumer protection & refund rights**
The Clause (7.7) states merchandise is covered by consumer protection laws with a full refund policy. The Terms should acknowledge the refund policy and that NFT/merchandise purchases are subject to consumer protection obligations.

**4. Fee routing via deterministic contracts**
The Clause (Section 6) describes `cheesefeefee` atomic fee routing. The Terms mention nothing about automated on-chain fee conversions. Users should acknowledge that certain actions involve automatic token conversions via fixed contract logic.

**5. Liquidity provision is self-directed, no guaranteed returns**
The Clause (Section 8) covers LP risks in detail. The Terms only briefly mention staking/farming in Section 6. A specific acknowledgement about impermanent loss risk and no guaranteed APR/APY is missing.

### Plan — `src/pages/Terms.tsx`

**A. Add to Section 6 (User Responsibilities) — 3 new bullet points:**

- You acknowledge that CHEESEHub does not hold a financial services licence in any jurisdiction and does not provide financial product advice, deal in financial products, or operate as a financial services provider.
- You acknowledge that token burning or supply-reduction mechanisms (such as CHEESENull) do not constitute, imply, or guarantee an increase in price, value, or financial return. You accept that participation in such features is voluntary and carries no expectation of profit.
- You acknowledge that certain platform actions involve deterministic on-chain fee routing via smart contracts (such as `cheesefeefee`), which may automatically convert tokens as part of a single atomic transaction. These conversions are executed by fixed contract logic and do not constitute dealing or financial intermediation.

**B. Add new Section 10: Merchandise & Consumer Protection** (renumber current 10-13 → 11-14):

A short section stating: purchases of CHEESE NFTs and merchandise through CHEESEShip are covered by applicable consumer protection laws; undamaged goods may be returned for a full refund at any time; and users acknowledge their purchase is a consumer transaction, not a financial investment.

**C. Add to current Section 9 (Third-Party Services) — one additional sentence:**

Reference that liquidity provision via Alcor Exchange is self-directed, carries risk of impermanent loss, and no APR/APY is promised or guaranteed.

### Summary of changes

- `src/pages/Terms.tsx`: Add 3 bullets to Section 6, expand Section 9, insert new Section 10, renumber 10-13 → 11-14.

