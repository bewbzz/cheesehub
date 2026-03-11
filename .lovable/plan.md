

## Plan: Add "Platform Features & dApps" Section to Clause

**Goal**: Move the CHEESENull disclosure out of Section 2 (Nature of CHEESE) and into a new dedicated section that provides clarity on each dApp accessible through CHEESEHub. This keeps Section 2 focused on CHEESE-the-token and gives each dApp its own concise legal framing.

### Changes — `src/pages/Disclaimer.tsx`

**1. Trim Section 2 (Nature of CHEESE)**
Remove the third paragraph (the CHEESENull disclosure, lines 25-27). Section 2 stays focused on what CHEESE is, its DAO governance, and its non-security status.

**2. Insert new Section 7: Platform Features & dApps** (after current Section 6)
A new section with a brief intro followed by subsections for each major dApp, covering:

- **CHEESENull** (`cheeseburner`) — Community-driven WAX vote reward claiming. Discloses the multi-purpose distribution (restake, powerups, swap/burn/liquidity). Explicitly states nulling does not add value, reducing supply does not guarantee price increase, and it is not an investment strategy.
- **CHEESEUp** (`cheesepowerz`) — Users burn CHEESE to receive CPU/NET resources. 100% of CHEESE is burned; WAX reserves fund the powerup. Not a financial service.
- **CHEESEAds** (`cheesebannad`) — Banner ad rental paid in WAX. Revenue distributed to burning, powerups, and liquidity via fixed contract logic.
- **CHEESEAmp** (`cheeseamphub`) — Music NFT player with play-count royalties. No fee taken from listeners.
- **CHEESEFarm** (`farms.waxdao`) — NFT staking farms powered by WaxDAO. Non-custodial; NFTs remain in user wallets. Creation fees routed through `cheesefeefee`.
- **CHEESEDao** (`dao.waxdao`) — DAO governance powered by WaxDAO. Creation fees routed through `cheesefeefee`.
- **CHEESEDrops** (`nfthivedrops`) — NFT drops powered by NFTHive. No CHEESE-specific fee routing.
- **CHEESELock** (`waxdaolocker`) — Token/liquidity locking via WaxDAO.
- **CHEESESwap** (`swap.alcor`) — Embedded Alcor DEX swap widget. No additional CHEESE fees.
- **CHEESEWallet** — Client-side wallet interface. No smart contract; all transactions signed by the user's own wallet.

Each subsection will be a short paragraph (2-4 sentences) identifying the contract, what it does, and key disclaimers (no custody, no guaranteed returns, user-initiated transactions, etc.). Third-party dApps (WaxDAO, NFTHive, Alcor) will note that the contract is owned and operated by that third party.

A closing paragraph will reiterate that all dApps are interfaces to independently deployed smart contracts, CHEESEHub does not custody funds, and users interact at their own risk.

**3. Renumber subsequent sections**
Current sections 7-12 become 8-13.

### Structure preview

```text
Section 2: Nature of CHEESE (trimmed — no CHEESENull detail)
...
Section 6: No Dealing...
Section 7: Platform Features & dApps   ← NEW
  7.1 CHEESENull
  7.2 CHEESEUp
  7.3 CHEESEAds
  7.4 CHEESEAmp
  7.5 CHEESEFarm
  7.6 CHEESEDao
  7.7 CHEESEDrops
  7.8 CHEESELock
  7.9 CHEESESwap
  7.10 CHEESEWallet
Section 8: Liquidity Provision & Farming (was 7)
Section 9: Tax Obligations (was 8)
...
Section 13: Not Professional Advice (was 12)
```

### File changed
- `src/pages/Disclaimer.tsx`

