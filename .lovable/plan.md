

## Update Contract Files

Replace both contract source files with the user-uploaded versions:

1. **`contracts/cheesebannad/cheesebannad.cpp`** — Overwrite with `user-uploads://cheesebannad.cpp` (483 lines). This contains the fix where `get_self()` is used as the RAM payer in `assign_slots` instead of `user`, resolving the RAM billing error in notify contexts.

2. **`contracts/cheesebannad/cheesebannad.hpp`** — Overwrite with `user-uploads://cheesebannad.hpp` (192 lines). This is the matching header file for the deployed contract.

No other files need to change. This simply syncs the repository with what is actually deployed on-chain.

