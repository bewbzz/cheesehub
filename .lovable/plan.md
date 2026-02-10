

# Add Withdraw Excess Rewards for Active Farms

## Summary
Add a "Withdraw" button next to "Deposit" in the Reward Pools section, visible only to the farm creator while the farm is active. This calls the `farms.waxdao::withdraw` action, which the contract limits to only excess rewards (beyond what is needed to cover current stakers until expiry).

## Changes

### 1. Create `WithdrawRewardsDialog` component
**New file: `src/components/farm/WithdrawRewardsDialog.tsx`**

Modeled after `DepositRewardsDialog`:
- Dialog with inputs for each reward pool token
- Calls the `farms.waxdao::withdraw` action with parameters: `user` (creator), `farmname`, and `quantities` (array of asset strings like `"100.0000 CHEESE"`)
- Shows a caveat warning inside the dialog: "The contract will only allow you to withdraw rewards in excess of what is needed to pay stakers until the farm expires. If you over-request, the transaction will fail."
- Only shown to the farm creator when the farm is active (not expired, not under construction, not closed)

### 2. Add Withdraw button to FarmDetail Reward Pools section
**File: `src/components/farm/FarmDetail.tsx`**

- Import `WithdrawRewardsDialog`
- Place it next to the existing `DepositRewardsDialog` button (line 495), conditionally rendered when `isCreator` and the farm is active (`!isUnderConstruction && !isExpired && !isClosed && !isPermClosed`)

## Technical Details

The `farms.waxdao::withdraw` action expects:
- `user`: the farm creator's account name
- `farmname`: the farm name string
- `quantities`: an array of quantity strings (e.g., `["100.00000000 WAX", "500.0000 CHEESE"]`)

The contract enforces the excess limit on-chain, so the UI just needs to send the request and handle errors gracefully.

