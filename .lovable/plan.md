

# CHEESEHub Banner Ad Smart Contract

## Overview
A new EOSIO/WAX smart contract (deployed to a new account) that manages paid banner advertising slots for CHEESEHub. The contract owner initializes time slots, and any user can rent and customize a slot by paying in either WAX (100 WAX per day) or CHEESE (equivalent value at current Alcor pool price).

## Contract Design

### Account & Deployment
- Deploy to a new WAX account (e.g. `cheeseadshub` or similar -- you choose the name and create the account)
- The account will need `eosio.code` permission added to its `active` authority for inline token transfers (burn + stake)

### Data Model

**`bannerads` table** (scope: contract, primary key: `time`)
| Field | Type | Description |
|-------|------|-------------|
| `time` | uint64 | Slot start timestamp (primary key, each slot = 24 hours) |
| `user` | name | Account that rented this slot |
| `ipfs_hash` | string | IPFS hash of banner image |
| `website_url` | string | Click-through URL |

**`config` table** (singleton)
| Field | Type | Description |
|-------|------|-------------|
| `id` | uint64 | Always 1 |
| `wax_price_per_day` | asset | Price in WAX (default: "100.00000000 WAX") |
| `wax_per_cheese_baseline` | double | For deviation checks |

### Actions

**`initbannerad`** (admin only -- `require_auth(get_self())`)
- Parameters: `start_time` (uint64), `amount_of_slots` (uint64)
- Creates empty banner ad rows in the table, each 24 hours apart starting from `start_time`
- Sets `user` to the contract account and blank `ipfs_hash`/`website_url`

**`editadbanner`** (user action)
- Parameters: `user` (name), `start_time` (uint64), `ipfs_hash` (string), `website_url` (string)
- Requires `require_auth(user)`
- Finds the slot by `start_time` in the table
- Validates the user has already paid (slot `user` field matches)
- Updates `ipfs_hash` and `website_url`

**`setconfig`** (admin only)
- Parameters: `wax_price_per_day` (asset), `wax_per_cheese_baseline` (double)
- Updates pricing config

**`withdraw`** (admin only)
- Same pattern as cheesefeefee -- withdraw any token from the contract

### Payment Flow

Payment happens via token transfer notifications. The contract listens for both WAX and CHEESE transfers:

**WAX Payment** (`eosio.token::transfer` notification):
1. User transfers WAX to the contract with memo: `banner|{start_time}|{num_days}`
2. Contract validates: 100 WAX per day (amount >= num_days * 100 WAX)
3. Contract assigns the slot(s) to the user
4. WAX stays in the contract for the owner to withdraw

**CHEESE Payment** (`cheeseburger::transfer` notification):
1. User transfers CHEESE with memo: `banner|{start_time}|{num_days}`
2. Contract reads Alcor Pool 1252 (CHEESE/WAX) to get current WAX-per-CHEESE price
3. Validates CHEESE value >= num_days * 100 WAX worth
4. Applies price deviation check (reuses same logic as cheesefeefee)
5. Distributes CHEESE: 66% burned to `eosio.null`, 34% to `xcheeseliqst`

### Security Features
- Same two-pool pricing approach and deviation checks from cheesefeefee for CHEESE valuation
- Slot validation: cannot rent already-rented slots (user != contract account means taken)
- Cannot rent slots in the past
- Input validation on IPFS hash length and URL length
- Only slot renter can edit their own banner content

## Contract File Structure

```
contracts/cheesebannad/
  cheesebannad.hpp    -- Header with tables, constants, action declarations
  cheesebannad.cpp    -- Implementation
  Makefile            -- Build rules (same pattern as cheesefeefee)
  README.md           -- Deployment and usage instructions
```

## Technical Details

### Constants
```cpp
static constexpr name WAX_CONTRACT = "eosio.token"_n;
static constexpr symbol WAX_SYMBOL = symbol("WAX", 8);
static constexpr name CHEESE_CONTRACT = "cheeseburger"_n;
static constexpr symbol CHEESE_SYMBOL = symbol("CHEESE", 4);
static constexpr name NULL_ACCOUNT = "eosio.null"_n;
static constexpr name LIQUIDITY_STAKING = "xcheeseliqst"_n;
static constexpr name ALCOR_CONTRACT = "swap.alcor"_n;
static constexpr uint64_t CHEESE_WAX_POOL_ID = 1252;
static constexpr double BURN_PERCENT = 0.66;
static constexpr uint64_t SECONDS_PER_DAY = 86400;
static constexpr int64_t DEFAULT_WAX_PRICE = 10000000000; // 100 WAX (8 decimals)
```

### Alcor Pool Table
Reuses the same `alcor_pool` struct from cheesefeefee for reading pool reserves and calculating CHEESE-to-WAX price.

### Compilation
Same CDT toolchain as cheesefeefee. The Makefile will follow the same pattern.

### Post-Deployment Steps
1. Create WAX account
2. Deploy contract
3. Add `eosio.code` to active permission: `cleos set account permission <account> active --add-code`
4. Fund contract with enough RAM
5. Call `setconfig` to set pricing
6. Call `initbannerad` to create initial ad slots
