# cheesefeefee Smart Contract

A WAX blockchain smart contract that enables CHEESE token payments for DAO and Farm creation fees with a 20% discount.

## Overview

This contract acts as an intermediary that:
1. Holds CHEESE prepayments from users
2. Provides dynamically-priced WAXDAO to users when they create a DAO or Farm
3. Transfers the CHEESE to `eosio.null` after successful creation

## How It Works

### User Flow

1. **Prepay with CHEESE**: User sends CHEESE to `cheesefeefee` with memo:
   - For DAO creation: `daofee|mydaoname`
   - For Farm creation: `farmfee|myfarmname`

2. **Create DAO/Farm**: User submits a bundled transaction containing:
   - `cheesefeefee::provide` action (receives WAXDAO from contract)
   - `mdcryptonfts::transfer` (pay WAXDAO to creation contract)
   - `dao.waxdao::createdao` or `farms.waxdao::createfarm`
   - `cheesefeefee::finalise` action (transfers CHEESE to eosio.null)

3. **Behind the scenes**:
   - `provide` verifies the creation action exists in the same tx
   - Contract sends dynamically-priced WAXDAO to the user
   - User's WAXDAO is used to pay the creation fee
   - `finalise` transfers CHEESE to `eosio.null` and deletes the prepayment
   - Everything succeeds or everything reverts

### WAXDAO Dynamic Pricing

The WAXDAO amount is calculated by the frontend using the same formula as WaxDAO:

```
WAXDAO_fee = (250 WAX / WAXDAO_price_in_WAX) × 0.80
```

A 0.5% safety buffer is added to prevent failures from price drift.

### Transaction Flow

```
TX 1: User sends CHEESE to cheesefeefee
      -> Contract records prepayment, holds CHEESE

TX 2: Bundled creation (atomic - all succeed or all revert)
      1. cheesefeefee::provide
         - Marks prepayment as used
         - Sends calculated WAXDAO to user
         
      2. mdcryptonfts::transfer
         - User pays WAXDAO to dao.waxdao/farms.waxdao
         
      3. dao.waxdao::assertpoint
      
      4. dao.waxdao::createdao (or farms.waxdao::createfarm)
         - DAO/Farm is created
         
      5. cheesefeefee::finalise    <-- ONLY IF ALL ABOVE SUCCEED
         - Transfers CHEESE to eosio.null
         - Deletes prepayment record
```

**If any step 1-4 fails:** CHEESE remains in contract, admin can refund

### Admin Functions

- **refund(prepayment_id)**: Return CHEESE for unused prepayments
- **withdraw(token_contract, to, quantity)**: Withdraw any token from the contract

## Deployment

### Prerequisites

- EOSIO CDT installed
- cleos configured for WAX mainnet
- WAX account `cheesefeefee` created and funded

### Build

```bash
cd contracts/cheesefeefee
make
```

### Deploy

```bash
# Deploy contract
make deploy

# Add eosio.code permission (required for inline token transfers)
make setup-permissions
```

### Fund the Pool

```bash
# Send WAXDAO to the contract (e.g., 100,000 WAXDAO initial pool)
cleos push action mdcryptonfts transfer '["yourwallet", "cheesefeefee", "100000.00000000 WAXDAO", "Initial pool funding"]' -p yourwallet@active
```

## Tables

### prepayments

| Field | Type | Description |
|-------|------|-------------|
| id | uint64 | Unique ID |
| user | name | User who sent CHEESE |
| fee_type | string | "dao" or "farm" |
| entity_name | name | DAO/Farm name |
| cheese_paid | asset | Amount of CHEESE |
| paid_at | time_point_sec | Payment timestamp |
| used | bool | Whether consumed by provide action |

## Security Considerations

1. **Atomic Transactions**: The `provide` action verifies the creation action exists in the same transaction, and `finalise` only runs after successful creation.

2. **Delayed Transfer**: CHEESE is only transferred to eosio.null in the `finalise` action, which runs at the end of the bundled transaction. If creation fails, CHEESE remains in the contract.

3. **Admin Controls**: Only the contract account can refund prepayments or withdraw tokens.

4. **No Middleman**: CHEESE goes directly to `eosio.null`, not held by anyone.

## Monitoring

```bash
# Check WAXDAO balance
cleos get table mdcryptonfts cheesefeefee accounts

# Check CHEESE balance
cleos get table cheeseburger cheesefeefee accounts

# View pending prepayments
cleos get table cheesefeefee cheesefeefee prepayments
```

## License

MIT
