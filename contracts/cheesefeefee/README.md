# cheesefeefee Smart Contract

A WAX blockchain smart contract that enables CHEESE token payments for DAO and Farm creation fees with a 20% discount.

## Overview

This contract acts as an intermediary that:
1. Holds CHEESE prepayments from users
2. Provides 250 WAX to users when they create a DAO or Farm
3. Burns the CHEESE by sending it to `eosio.null`

## How It Works

### User Flow

1. **Prepay with CHEESE**: User sends CHEESE to `cheesefeefee` with memo:
   - For DAO creation: `daofee|mydaoname`
   - For Farm creation: `farmfee|myfarmname`

2. **Create DAO/Farm**: User submits a bundled transaction containing:
   - `cheesefeefee::providewax` action
   - `eosio.token::transfer` (pay 250 WAX to creation contract)
   - `dao.waxdao::createdao` or `farms.waxdao::createfarm`

3. **Behind the scenes**:
   - `providewax` verifies the creation action exists in the same tx
   - Contract sends 250 WAX to the user
   - Contract sends CHEESE to `eosio.null` (burn)
   - User's WAX is used to pay the creation fee
   - Everything succeeds or everything reverts

### Admin Functions

- **refund(prepayment_id)**: Return CHEESE for unused prepayments
- **withdraw(to, quantity)**: Withdraw WAX from the pool to refill or manage

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
# Send WAX to the contract (e.g., 10,000 WAX initial pool)
cleos transfer yourwallet cheesefeefee "10000.00000000 WAX" "Initial pool funding"
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
| used | bool | Whether consumed |

## Security Considerations

1. **Atomic Transactions**: The `providewax` action verifies the creation action exists in the same transaction, ensuring the CHEESE is only burned when creation actually happens.

2. **Admin Controls**: Only the contract account can refund prepayments or withdraw WAX.

3. **No Middleman**: CHEESE goes directly to `eosio.null` (provably burned), not held by anyone.

## Monitoring

```bash
# Check WAX balance
make check-balance

# View pending prepayments
make check-prepayments
```

## License

MIT
