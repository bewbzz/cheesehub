

## Add "Create Account" to CHEESEWallet

A new sidebar menu item and form section will be added to the wallet dialog, allowing users to create new WAX accounts directly from CHEESEWallet.

### Form Fields (matching WaxBlock)
- **Account Name** -- 1-12 chars, a-z/1-5/period, with validation indicator
- **Public Owner Key** -- placeholder "Owner Key (Starts with PUB_K1...)"
- **Public Active Key** -- placeholder "Active Key (Starts with PUB_K1...)"
- **NET to Stake** -- default 0.2 WAX
- **CPU to Stake** -- default 0.2 WAX
- **RAM to Buy (bytes)** -- default 3000
- **Transfer checkbox** -- "Transfer staked resources to new account"
- **Create Account button**

### Technical Details

**New file: `src/components/wallet/CreateAccountManager.tsx`**
- Standalone component following existing patterns (like `RamManager`, `StakeManager`)
- Uses `useWaxTransaction` hook to execute the `newaccount`, `buyrambytes`, and `delegatebw` system actions in a single transaction
- Validates account name (WAX rules) and public keys (must start with `PUB_K1` or `EOS`)
- Shows success dialog with transaction ID on completion

**Edit: `src/components/WalletTransferDialog.tsx`**
- Add `'create-account'` to the `WalletSection` type union
- Add a new menu item with `UserPlus` icon (from lucide-react) to `mainMenuItems` array
- Add rendering logic for the new section in the content area, rendering `<CreateAccountManager />`

**Transaction actions** (sent as a single multi-action transaction):
1. `eosio::newaccount` -- creates the account with owner/active keys
2. `eosio::buyrambytes` -- buys RAM for the new account
3. `eosio::delegatebw` -- stakes CPU/NET, with optional transfer flag

