

## Add Key Pair Generator to Create Account Section

### Overview
Add a "Generate Key Pair" button that creates a random EOS/WAX key pair (private + public) using the `PrivateKey` class already available from `@wharfkit/session` (installed dependency). Users can generate keys and optionally auto-fill the Owner/Active key fields, similar to WaxBlock's wallet utilities.

### Design
- A collapsible "Key Generator" section below the account name field (or above the key inputs)
- "Generate New Key Pair" button that creates a random private/public key pair
- Display the generated private key (WIF format) and public key (PUB_K1_ format) with copy buttons
- "Use as Owner Key" and "Use as Active Key" buttons to auto-fill the respective fields
- Option to generate separate keys for owner and active, or use the same key for both
- Warning banner: "Save your private key securely. It will not be shown again."

### Implementation

**File: `src/components/wallet/CreateAccountManager.tsx`**

1. Import `PrivateKey` from `@wharfkit/session`
2. Add state for generated key pairs (up to 2: one for owner, one for active)
3. Add a `KeyGenerator` sub-component:
   - "Generate Key Pair" button calls `PrivateKey.generate('K1')` 
   - Displays private key (`.toWif()`) and public key (`.toPublic().toString()`) 
   - Copy-to-clipboard buttons for each key
   - "Use as Owner Key" / "Use as Active Key" buttons that call `setOwnerKey` / `setActiveKey` with the public key
   - "Use for Both" shortcut button
4. Styled with a bordered card/section with a key icon, matching the existing cheese theme
5. Strong warning about saving the private key before proceeding

### Security Note
Key generation happens entirely client-side using the WharfKit crypto library. No private keys are transmitted anywhere.

