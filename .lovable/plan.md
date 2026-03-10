

## Terms of Use Page for CHEESEHub

Create a `/terms` page covering platform usage terms, consistent with the existing Disclaimer page style and the project's decentralized, DAO-governed nature.

### Content Sections

1. **Acceptance of Terms** — by using CHEESEHub you agree to these terms; if you disagree, do not use the platform
2. **Platform Description** — CHEESEHub is a community-built frontend for interacting with smart contracts on the WAX blockchain; it is not a custodial service
3. **Eligibility** — users must be of legal age in their jurisdiction; users in restricted jurisdictions must not use the platform
4. **User Responsibilities** — secure your own wallet and keys; you are solely responsible for all transactions; DYOR before interacting with any smart contract
5. **Intellectual Property** — CHEESE branding and site content are community/DAO-owned; third-party content (NFTs, logos) belongs to respective owners
6. **Prohibited Use** — no illegal activity, no exploiting smart contracts maliciously, no attempts to disrupt the platform
7. **Third-Party Services** — the platform links to external services (Alcor, AtomicHub, etc.); CHEESEHub is not responsible for third-party platforms
8. **No Warranties** — platform provided "as is" with no guarantees of uptime, accuracy, or availability
9. **Limitation of Liability** — mirrors the disclaimer's liability clause (website owner, DAO, contributors)
10. **Modifications** — terms may be updated at any time; continued use constitutes acceptance
11. **Governing Law** — disputes governed by applicable law; no specific jurisdiction cited (consistent with generalized approach)

### Changes

1. **Create `src/pages/Terms.tsx`** — styled identically to `Disclaimer.tsx` using `<Layout>`, same typography and spacing
2. **Update `src/App.tsx`** — add route `/terms`
3. **Update `src/components/Footer.tsx`** — add "Terms of Use" link alongside the Disclaimer link

