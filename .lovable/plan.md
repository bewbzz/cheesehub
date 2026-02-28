

## Admin Ecosystem Guide Page

### Overview
Create a comprehensive admin-only documentation page at `/admin/guide` explaining every dApp, its contracts, ownership, and fee flows with visual diagrams.

### Verified Fee Allocations (from contracts + your confirmation)

**CHEESEBurner** (`cheeseburner` - CHEESE team)
- WAX from vote rewards: 20% re-staked as CPU, 5% to cheesepowerz, 75% swapped to CHEESE on Alcor
- Resulting CHEESE: 85% burned (eosio.null), 15% to xcheeseliqst
- 0% caller reward

**CHEESEAds** (`cheesebannad` - CHEESE team)
- WAX from ad payment: 25% to cheeseburner, 25% to cheesepowerz, 50% swapped to CHEESE on Alcor
- Resulting CHEESE: 66% burned (eosio.null), 34% to xcheeseliqst
- Pricing: 100 WAX/day exclusive, 70 WAX/day shared (30% off), cheesepromoz gets 50% discount (stacks)

**CHEESEFeeFee** (`cheesefeefee` - CHEESE team)
- CHEESE path: User pays CHEESE (20% discount). Contract: 66% burned, 34% to xcheeseliqst. User receives WAXDAO inline (two-pool pricing).
- WAX path: User pays 265 WAX. Contract: 215 WAX swapped to WAXDAO for user via Alcor Pool 1236, 50 WAX sent to cheeseburner.

**CHEESEPowerUp** (`cheesepowerz` - CHEESE team)
- Receives WAX from cheeseburner (5%) and cheesebannad (25%). Powers up CPU/NET for users.

**CHEESENull** (uses `cheeseburner` stats - CHEESE team)
- Client-side burn button. Triggers cheeseburner flow. Stats tracked on-chain.

**CHEESEAmp** (`cheeseamphub` - CHEESE team)
- NFTs deposited to contract. Plays logged with 5-min cooldown. Collection creators claim royalties (configurable CHEESE per play) from contract balance.

**CHEESEDrip** (`waxdaoescrow` - WaxDAO)
- Escrow-based token drip. Creator deposits tokens, receiver claims on schedule. No CHEESE-specific fees.

**CHEESEDrops** (`nfthivedrops`, `nft.hive` - NFTHive)
- NFT drops marketplace. Fees set by NFTHive. No CHEESE-specific fee routing.

**CHEESEFarm** (`farms.waxdao` - WaxDAO)
- NFT staking farms. Creation fee: 265 WAX (or CHEESE equivalent via cheesefeefee). Non-custodial V2 staking.

**CHEESEDao** (`dao.waxdao` - WaxDAO)
- DAO creation and governance. Creation fee: 265 WAX (or CHEESE equivalent via cheesefeefee). Proposals, voting, treasury.

**CHEESELock** (`waxdaolocker` - WaxDAO)
- Token and liquidity locking. Managed by WaxDAO contracts.

**CHEESESwap** (`swap.alcor` - Alcor)
- Embedded Alcor DEX swap widget. Fees set by Alcor.

**CHEESEWallet** (client-side - CHEESE team)
- No smart contract. Client-side wallet management for transfers, staking, resources, NFT sending, voting, Alcor farm management.

---

### Implementation

**File 1: `src/pages/AdminGuide.tsx`** (new)
- Admin-gated page using `useAdminAccess` hook (same pattern as Admin.tsx)
- Scrollable document layout with collapsible Accordion sections per dApp
- Each section contains: plain-English description, contract badge(s), owner badge, fee flow text, and a visual flow diagram
- Flow diagrams built as reusable Tailwind CSS components (colored boxes with arrows showing percentage splits)
- No new dependencies needed

**File 2: Update `src/App.tsx`**
- Add route: `/admin/guide` mapped to lazy-loaded AdminGuide component

**File 3: Update `src/pages/Admin.tsx`**
- Add a "View Ecosystem Guide" link/button in the header area, linking to `/admin/guide`

### Visual Diagram Approach
Each fee flow rendered as a vertical chain of styled boxes:
- Input box (yellow/amber) showing the source (e.g., "Vote Rewards (WAX)")
- Split boxes (color-coded) showing percentage allocations with destination labels
- Sub-splits for resulting CHEESE from swaps
- Built with Tailwind CSS flexbox -- no chart library needed
- Reusable `FlowDiagram` component accepting structured step data

### Technical Notes
- Static content page (no live data fetching)
- Mobile-responsive with stacked cards
- Uses existing Accordion, Badge, Card components from the UI library
- Gated behind admin whitelist check

