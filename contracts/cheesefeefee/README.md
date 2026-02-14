# cheesefeefee Smart Contract

A WAX blockchain smart contract that enables CHEESE token payments for DAO and Farm creation fees with a 20% discount.

## Overview

This contract provides secure, atomic fee routing for DAO and Farm creation on WAX:

1. **CHEESE Payment Path**: Validates CHEESE value via Alcor Pool 1252 (CHEESE/WAX), converts to WAXDAO via Pool 1236 (WAX/WAXDAO), and distributes the CHEESE (66% burn, 34% liquidity staking)
2. **WAX Payment Path**: Routes 250 WAX through the contract, converting 205 WAX to WAXDAO via Alcor Pool 1236, and sending 45 WAX to cheeseburner for ecosystem support
3. **Atomic Execution**: All operations complete in a single transaction with atomic failure handling

## How It Works

### CHEESE Payment Flow

1. **Send CHEESE**: User sends CHEESE to `cheesefeefee` with memo format:
    - For DAO creation: `daofee|mydaoname`
    - For Farm creation: `farmfee|myfarmname`

2. **Validation & Calculation** (inline, atomic):
    - Contract validates CHEESE value >= 200 WAX equivalent via Pool 1252
    - Contract calculates required WAXDAO via Pool 1236 (WAX/WAXDAO exchange)
    - Contract sends calculated WAXDAO directly to user
    - Contract burns 66% CHEESE to `eosio.null`, sends 34% to `xcheeseliqst`

3. **User Creates Entity**: User sends WAXDAO fee to DAO/Farm creation contract
    - If creation succeeds, all CHEESE distributions are locked in
    - If creation fails, entire transaction reverts (CHEESE returned to user)

### WAX Payment Flow

1. **Send 250 WAX**: User sends exactly 250 WAX to `cheesefeefee` with memo format:
    - For DAO creation: `waxdaofee|mydaoname`
    - For Farm creation: `waxfarmfee|myfarmname`

2. **Fee Routing** (inline, atomic via Alcor):
    - 205 WAX is swapped for WAXDAO via Alcor Pool 1236, output sent directly to user
    - 45 WAX is transferred to `cheeseburner` for ecosystem support
    - Swap memo uses extended asset format: `0.0001 WAXDAO@token.waxdao` (minimum output)

3. **User Creates Entity**: User sends WAXDAO fee to DAO/Farm creation contract
    - If creation succeeds, WAX distribution is locked in
    - If creation fails, entire transaction reverts

### WAXDAO Dynamic Pricing

For CHEESE payments:
```
WAX_value = CHEESE_amount × (WAX_per_CHEESE from Pool 1252)
WAXDAO_amount = WAX_value × (WAXDAO_per_WAX from Pool 1236)
Minimum: 200 WAX equivalent with 2.5% tolerance
```

**Two-Pool Security**: Attacker must manipulate both Pool 1252 (CHEESE/WAX) and Pool 1236 (WAX/WAXDAO) simultaneously to exploit pricing.

### Transaction Structure

**CHEESE Payment Path:**
```
User sends CHEESE to cheesefeefee
  ↓
Contract validates & calculates WAXDAO via two pools
  ↓
Contract sends WAXDAO to user (inline)
Contract burns 66% CHEESE (inline)
Contract stakes 34% CHEESE (inline)
  ↓
User sends WAXDAO fee + creates DAO/Farm
  ↓
All succeed or all revert atomically
```

**WAX Payment Path:**
```
User sends 250 WAX to cheesefeefee
  ↓
Contract swaps 205 WAX → WAXDAO via Alcor Pool 1236 (inline)
Contract sends WAXDAO to user (inline)
Contract sends 45 WAX to cheeseburner (inline)
  ↓
User sends WAXDAO fee + creates DAO/Farm
  ↓
All succeed or all revert atomically
```

### Alcor Swap Memo Format

The contract uses Alcor's `swapexactin` action with extended asset format for minimum output:

```
swapexactin#{pool_id}#{recipient}#{minimum_output}@{token_contract}#0
```

Examples:
- **CHEESE Payment**: `swapexactin#1236#user123#123.45678901 WAXDAO@token.waxdao#0`
- **WAX Payment**: `swapexactin#1236#user123#50.12345678 WAXDAO@token.waxdao#0`

The `@token.waxdao` or `@cheeseburger` suffix is **required** for Alcor to validate the extended asset.

## Security Considerations

1. **Two-Pool Pricing**: CHEESE payment pricing requires manipulating both Alcor Pool 1252 (CHEESE/WAX, high liquidity) and Pool 1236 (WAX/WAXDAO, high liquidity) simultaneously to exploit—significantly more difficult than single-pool attacks.

2. **WAX-Value Exchange**: Both payment paths use WAX as the common medium for pricing validation:
   - CHEESE → WAX (via Pool 1252) → WAXDAO (via Pool 1236)
   - This prevents isolated pool manipulation

3. **Price Deviation Bounds**: Contract validates prices stay within 10% of admin-set baselines:
   - Catches extreme market manipulation or volatility
   - Admin can adjust baselines via `setbaseline` action when market conditions change

4. **Minimum Output Checks**: 
   - Minimum 5 WAXDAO output per CHEESE payment prevents dust attacks
   - CHEESE value must be >= 200 WAX equivalent (with 2.5% tolerance for volatility)

5. **Atomic Transactions**: All fee routing and distributions complete in a single transaction:
   - If any step fails, entire transaction reverts
   - User either completes creation or gets full refund
   - No partial states or stranded funds

6. **Fee Distribution Integrity**:
   - 66% CHEESE burned to `eosio.null` (removed from circulation)
   - 34% CHEESE sent to `xcheeseliqst` (liquidity staking)
   - 45 WAX sent to `cheeseburner` (ecosystem support)

## Admin Actions

### withdraw(token_contract, to, quantity)
Withdraw any token from the contract. Only callable by contract account.

**Example:**
```bash
cleos push action cheesefeefee withdraw '["eosio.token", "my.wallet", "100.00000000 WAX"]' -p cheesefeefee@active
```

### setbaseline(wax_per_cheese, waxdao_per_wax)
Update baseline prices for price deviation validation. Allows adjusting tolerance bands as market conditions change.

**Example:**
```bash
cleos push action cheesefeefee setbaseline '[1.5, 32.0]' -p cheesefeefee@active
```

These are the ONLY admin actions. The contract has no state tables for prepayments or pending transactions—all fee routing is atomic and inline.

## Deployment & Configuration

### Prerequisites

- EOSIO CDT installed
- cleos configured for WAX mainnet
- WAX account `cheesefeefee` created and funded

### Build & Deploy

```bash
cd contracts/cheesefeefee
make
make deploy
make setup-permissions  # Adds eosio.code permission for inline transfers
```

### Configuration

Set baseline prices for deviation validation:

```bash
cleos push action cheesefeefee setbaseline '[1.5, 32.0]' -p cheesefeefee@active
```

### Monitoring

```bash
# Check WAXDAO balance
cleos get table eosio.token cheesefeefee accounts

# Check CHEESE balance
cleos get table cheeseburger cheesefeefee accounts

# View admin config
cleos get table cheesefeefee cheesefeefee config
```
