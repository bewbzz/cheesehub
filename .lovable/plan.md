

## Burn NFTs Feature

Add the ability to burn NFTs from the wallet's Send NFTs section, using the `atomicassets::burnasset` action. The existing NFT selector grid will be reused. A red "Burn NFTs" button will appear alongside the existing "Send" button. Clicking it shows an irreversibility warning dialog before executing.

### Changes

**1. WaxContext.tsx -- Add `burnNFTs` function**
- Add `burnNFTs: (assetIds: string[]) => Promise<string | null>` to the context interface
- Implement it using the `atomicassets::burnasset` action (one action per asset ID, batched in a single transaction)
- Each action: `{ account: 'atomicassets', name: 'burnasset', data: { asset_owner: session.actor, asset_id } }`
- Follow the same error handling pattern as `transferNFTs`

**2. NFTSendManager.tsx -- Add burn button and confirmation dialog**
- Import `AlertDialog` components and `Flame` icon
- Add a `[isBurning, setIsBurning]` state and `[showBurnConfirm, setShowBurnConfirm]` state
- Add a red "Burn NFTs" button next to the existing Send button (only enabled when NFTs are selected, no recipient needed)
- Clicking the burn button opens an `AlertDialog` with:
  - Title: "Burn NFTs Permanently?"
  - Description warning that this is irreversible, any backed tokens will be returned, and listing the count of NFTs selected
  - "Cancel" and "Burn Forever" (red/destructive) action buttons
- On confirm, call `burnNFTs(assetIds)`, handle success/error the same way as send, clear selection and refetch on success

### Technical Details

- The `burnasset` action signature: `asset_owner` (Name), `asset_id` (uint64)
- Multiple burns are batched as multiple actions in one transaction (same pattern as multi-NFT transfers but one action per asset)
- The burn button does NOT require a recipient, so it works independently of the recipient input validation
- `canBurn = selectedNFTs.size > 0 && !isBurning && !isSending`

