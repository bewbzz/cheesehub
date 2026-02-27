

# CHEESEDrip -- Slow Drip Escrow Frontend

## Overview
New page at `/drip` providing a frontend for the `waxdaoescrow` smart contract. Two tabs: **Create Drip** and **My Drips**. Follows the same layout patterns as the existing CHEESELock page.

## What the WaxDAO Escrow UI Shows

From the live WaxDAO escrow page, the "Create Slow Drip" form has these fields:
- **Receiving Account** (text input, e.g. `mike.wam`)
- **Amount Per Payment** (number input)
- **Token Name** (text input, e.g. `WAX`)
- **Token Contract** (text input, e.g. `eosio.token`)
- **Token Precision** (number input, e.g. `8`)
- **Hours Between Payments** (number input)
- **Drip Completion Date** (date picker)

This is a two-step process: (1) call `createdrip` on `waxdaoescrow`, (2) send a token transfer to `waxdaoescrow` with memo `|drip_deposit|{ID}|` to fund it.

## Files to Create

### 1. `src/lib/drip.ts` -- Data layer and types
- `ESCROW_CONTRACT = "waxdaoescrow"`
- `DripEscrow` interface (ID, payer, receiver, payout_amount, token_contract, hours_between_payouts, end_time, last_claim, amount_deposited, amount_claimed, status)
- `fetchUserDrips(account)` -- fetches drips table, filters where user is payer or receiver
- Helper functions: `parseDripStatus()`, `getClaimableCount()`, `getTimeUntilNextClaim()`, `getDripProgress()`
- Console logs raw table data on first load so we can verify field names match the ABI

### 2. `src/components/drip/CreateDrip.tsx` -- Create tab
Card-based form matching the WaxDAO fields:
- **Receiving Account** -- text input
- **Amount Per Payment** -- number input with token symbol suffix
- **Token Name** -- text input (symbol) or select from user's token balances
- **Token Contract** -- text input (auto-filled if selecting from balances)
- **Token Precision** -- number input (auto-filled if selecting from balances)
- **Hours Between Payments** -- number input with preset buttons (1h, 6h, 12h, 24h, 48h, 168h)
- **Drip Completion Date** -- date input
- Auto-calculated summary: total payments count, total deposit needed
- Two-step flow:
  - Step 1: Sign `createdrip` transaction
  - Step 2: Query table for new drip ID, then sign token transfer with `|drip_deposit|{ID}|` memo
- Uses `useWax` context and `useWaxTransaction` hook
- "Connect wallet" placeholder when not connected (same pattern as CreateLock)

### 3. `src/components/drip/MyDrips.tsx` -- View/manage tab
Two sections:
- **Drips I'm Paying** -- cards where user is `payer`
  - Cancel button (active drips), Finalize button (expired drips)
- **Drips I'm Receiving** -- cards where user is `receiver`
  - Claim button when tokens are available

Each drip card shows:
- Token symbol, payer/receiver accounts
- Progress bar (amount claimed / total deposited)
- Next claim countdown timer
- Payout rate (e.g., "1,000 CHEESE every 24h")
- Status badge (Active, Awaiting Deposit, Completed, Cancelled)
- Action buttons: Claim (`claimdrip`), Cancel (`canceldrip`), Finalize (`finalizedrip`)

### 4. `src/pages/Drip.tsx` -- Page component
Same hero section pattern as Locker page:
- Animated orb (reuse cheese-logo or create new drip orb image)
- Title: CHEESEDrip with BETA badge
- Description text
- Two tabs: Create Drip / My Drips
- Footer linking to `waxdaoescrow` contract on waxblock

### 5. Route and Navigation Updates

**`src/App.tsx`**:
- Import `Drip` page, add `<Route path="/drip" element={<Drip />} />`

**`src/components/Header.tsx`**:
- Add CHEESEDrip link in the secondary nav row (Row 2), alongside CHEESEDrop and CHEESELock
- Icon: `💧` or `🫧` (to differentiate from CHEESEDrop)

## Contract Actions Reference

| Action | Contract | Parameters |
|--------|----------|------------|
| `createdrip` | `waxdaoescrow` | payer, receiver, payout_amount (asset), token_contract, hours_between_payouts, end_time (unix timestamp) |
| Token transfer (deposit) | Token contract | to: `waxdaoescrow`, memo: `\|drip_deposit\|{ID}\|` |
| `claimdrip` | `waxdaoescrow` | drip_id, claimer (receiver) |
| `canceldrip` | `waxdaoescrow` | drip_id, canceller (payer) |
| `finalizedrip` | `waxdaoescrow` | drip_id, finalizer (payer) |

## Technical Notes

- Two-step create flow: Since the drip ID is assigned by the contract, we first transact `createdrip`, then query the `drips` table to find the newly created drip (by payer, most recent), then send the deposit transfer in a second transaction.
- All wallet operations use `useWax` context (per architecture memory).
- Transaction signing uses `useWaxTransaction` hook with WharfKit modal cleanup.
- Table fetching uses the existing `fetchTable` utility with RPC endpoint fallback.
- Raw table data will be console-logged initially so we can quickly verify/adjust field names if the ABI differs from our assumptions.

## Implementation Order

1. Create `src/lib/drip.ts`
2. Create `src/components/drip/CreateDrip.tsx`
3. Create `src/components/drip/MyDrips.tsx`
4. Create `src/pages/Drip.tsx`
5. Update `src/App.tsx` and `src/components/Header.tsx`

