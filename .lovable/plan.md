

## Remove CHEESEFaucet from Platform

Three changes across two files:

### 1. `src/components/Header.tsx` — Remove nav link (lines 66-75)
Delete the CHEESEFaucet external link block entirely.

### 2. `src/pages/Index.tsx` — Remove dApp card (lines 107-124)
Delete the entire CHEESEFaucet card from the homepage grid.

### 3. Verify no remaining references
Search confirmed faucet references exist only in these two files. No Disclaimer/Terms references to clean up.

