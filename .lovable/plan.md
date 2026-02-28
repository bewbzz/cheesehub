

## Admin Ecosystem Guide Page

### Overview
Create a new admin-only page at `/admin/guide` (or a tab within the existing admin page) containing a comprehensive, non-technical document explaining every dApp on CHEESEHub. The page will include written descriptions of each dApp, which smart contracts power them, who is responsible for each contract, and clear fee/token flow diagrams rendered as visual charts.

### Page Structure

The page will be a scrollable document-style layout within the admin `Layout` component, gated behind the same `useAdminAccess` hook used by the existing admin dashboard.

### Content Sections

**1. Introduction**
- What CHEESEHub is and its purpose as a unified platform for the CHEESE ecosystem.

**2. Per-dApp Sections** (each with: description, contract ownership, fee breakdown text, and a visual flow diagram)

The dApps to document:

| dApp | Contract(s) | Owner |
|---|---|---|
| CHEESEBurner | `cheeseburner` | CHEESE team |
| CHEESEPowerUp | `cheesepowerz` | CHEESE team |
| CHEESENull | `cheeseburner` (stats) | CHEESE team |
| CHEESEFeeFee | `cheesefeefee` | CHEESE team |
| CHEESEAds | `cheesebannad` | CHEESE team |
| CHEESEAmp | `cheeseamphub` | CHEESE team |
| CHEESEDrip | `waxdaoescrow` | WaxDAO |
| CHEESEDrops | `nfthivedrops`, `nft.hive` | NFTHive |
| CHEESEFarm | `farms.waxdao` | WaxDAO |
| CHEESEDao | `dao.waxdao` | WaxDAO |
| CHEESELock | `waxdaolocker` | WaxDAO |
| CHEESESwap | Alcor DEX (`swap.alcor`) | Alcor |
| CHEESEWallet | N/A (client-side) | CHEESE team |

**3. Fee Flow Diagrams** - Using Recharts or simple styled HTML/CSS flow diagrams showing token splits for each dApp that handles fees:

- **CHEESEBurner**: WAX vote rewards claimed -> 80% swapped to CHEESE on Alcor -> 75% burned, 12.5% caller reward, 12.5% to xcheeseliqst. Remaining WAX: 15% re-staked as CPU, 5% to cheesepowerz.
- **CHEESEAds (cheesebannad)**: WAX payment -> 25% to cheeseburner, 25% to cheesepowerz, 50% swapped to CHEESE on Alcor -> 66% burned, 34% to xcheeseliqst.
- **CHEESEFeeFee (CHEESE path)**: User pays CHEESE at 20% discount -> 66% burned, 34% to xcheeseliqst. User receives WAXDAO inline to pay WaxDAO.
- **CHEESEFeeFee (WAX path)**: User pays 265 WAX -> 215 WAX converted to WAXDAO for user, 50 WAX sent to cheeseburner.
- **CHEESEAmp**: Plays logged -> royalties paid from contract's CHEESE balance based on play count per collection.

### Implementation Plan

**File 1: `src/pages/AdminGuide.tsx`**
- New page component with all written content as JSX
- Each dApp section as a card with heading, description paragraphs, contract info badges, and fee flow diagram
- Fee flow diagrams built as simple styled div-based flow charts (colored boxes with arrows) -- no external charting library needed, just Tailwind-styled boxes connected with CSS arrows
- Admin access gate using `useAdminAccess` (same as Admin.tsx)

**File 2: Update `src/App.tsx`**
- Add route: `/admin/guide` -> `AdminGuide`

**File 3: Update `src/pages/Admin.tsx`**
- Add a navigation link/button to the guide page from the admin dashboard header

### Fee Flow Diagram Approach

Each diagram will be a horizontal or vertical flow of colored boxes connected by arrows, built with plain Tailwind CSS:

```text
Example for CHEESEBurner:

[Vote Rewards (WAX)]
        |
        v
  +-----------+
  | 15% Stake |  [re-staked as CPU]
  +-----------+
  | 5% PowerZ |  [sent to cheesepowerz]
  +-----------+
  | 80% Swap  |  [swapped to CHEESE on Alcor]
  +-----------+
        |
        v
  +-------------+
  | 75% Burned  |  [sent to eosio.null]
  +-------------+
  | 12.5% Reward|  [caller incentive]
  +-------------+
  | 12.5% Liq   |  [to xcheeseliqst]
  +-------------+
```

These will be implemented as a reusable `FlowDiagram` component that takes an array of steps with percentages, colors, and labels.

### Technical Details

- Reuses existing `Layout` component and admin access pattern
- No new dependencies required -- pure Tailwind CSS for diagrams
- Content is static/hardcoded (documentation page, not live data)
- Mobile-responsive card layout
- Each dApp section is collapsible using the existing Accordion component for easy scanning

