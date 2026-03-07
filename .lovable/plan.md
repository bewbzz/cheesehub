

## Add Anchor "Dangerous Transaction" Explainer to Create Farm & Create DAO

### Problem
When users pay to create a Farm or DAO, the transaction includes inline actions from the `cheesefeefee` contract (e.g., sending WAXDAO tokens back to the user, burning CHEESE/WAX). Anchor Wallet flags these as "dangerous transactions" by default, blocking users from signing unless they enable "Allow Dangerous Transactions" in settings.

### Where to Add
Both **CreateFarm** and **CreateDao** components — added as a new FAQ item in each help dialog, plus a visible inline warning near the submit button.

### Changes

**1. `src/components/farm/CreateFarm.tsx`**
- Add a new FAQ item to the `FAQ_ITEMS` array explaining inline actions, why they're safe, and how to temporarily enable "Allow Dangerous Transactions" in Anchor.
- Add a small amber/warning alert near the "Create Farm" submit button area with a brief note and link to the FAQ.

**2. `src/components/dao/CreateDao.tsx`**
- Add the same FAQ item to the DAO creation help dialog accordion.
- Add the same inline warning near the submit button area.

### FAQ Content (shared across both)
- **Question**: "Why does Anchor show a 'Dangerous Transaction' warning?"
- **Answer**: Explains that the transaction includes inline actions from the `cheesefeefee` smart contract (sending WAXDAO tokens to the user, burning fees). These are standard, safe operations — the contract is open source and verified. To proceed:
  1. Open Anchor Wallet settings (gear icon)
  2. Toggle "Allow Dangerous Transactions" ON
  3. Sign the transaction
  4. Optionally toggle it back OFF afterward
  
  Alternatively, users can check "Allow for this transaction only" if that option appears.

### Inline Warning (near submit button)
A small amber-colored alert box:
> ⚠️ **Anchor Wallet Users**: This transaction includes inline actions and may trigger a "Dangerous Transaction" warning. This is normal and safe. See the help guide (ℹ️) above for instructions.

### Files Modified
- `src/components/farm/CreateFarm.tsx` — new FAQ item + inline alert
- `src/components/dao/CreateDao.tsx` — new accordion item + inline alert

