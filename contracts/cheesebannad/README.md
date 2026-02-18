# cheesebannad - CHEESEHub Banner Ad Contract

Smart contract for paid banner advertising slots on CHEESEHub.

## Overview

The contract owner initializes 24-hour ad slots. Anyone can rent slots by paying WAX:
- **100 WAX per day** (default, configurable via `setconfig`)
- **80 WAX per day** for shared slots (20% discount)

WAX payments are split atomically (if any step fails, the entire transaction reverts):
- **20% WAX** → `cheeseburner` (ecosystem financing)
- **80% WAX** → swapped to CHEESE via Alcor Pool 1252
  - **66% CHEESE** → burned to `eosio.null`
  - **34% CHEESE** → sent to `xcheeseliqst` (liquidity staking)

Overpayment is automatically refunded to the sender.

## Deployment

### 1. Build
```bash
make
```

### 2. Create WAX Account
Create the `cheesebannad` account on WAX mainnet.

### 3. Deploy
```bash
make deploy
```

### 4. Add eosio.code Permission
Required for inline CHEESE burn/stake transfers:
```bash
make setup-permissions
```

### 5. Configure Pricing
```bash
cleos push action cheesebannad setconfig '["100.00000000 WAX", 1.5]' -p cheesebannad@active
```
Arguments:
1. `wax_price_per_day` — WAX price per slot per day (must be in WAX)
2. `wax_per_cheese_baseline` — WAX/CHEESE rate shown in the UI (float, e.g. `1.5`)

### 6. Initialize Ad Slots
Create 30 days of slots starting from a Unix timestamp:
```bash
cleos push action cheesebannad initbannerad '[1707350400, 30]' -p cheesebannad@active
```

## User Flow

### Rent Exclusive (WAX)
```bash
cleos transfer myaccount cheesebannad "100.00000000 WAX" "banner|1707350400|1|1|e" -p myaccount@active
```

### Rent Shared Primary (WAX — 20% off)
```bash
cleos transfer myaccount cheesebannad "80.00000000 WAX" "banner|1707350400|1|1|s" -p myaccount@active
```

### Join Existing Shared Slot (WAX — 20% off)
```bash
cleos transfer myaccount cheesebannad "80.00000000 WAX" "banner|1707350400|1|1|j" -p myaccount@active
```

Memo format: `banner|start_time|num_days|position[|mode]`
- `start_time` — Unix timestamp of the slot day
- `num_days` — number of consecutive days (1–365)
- `position` — `1` or `2`
- `mode` — `e` (exclusive, default), `s` (shared primary), `j` (join shared)

### Edit Banner Content
```bash
cleos push action cheesebannad editadbanner '["myaccount", 1707350400, 1, "QmHash...", "https://mysite.com"]' -p myaccount@active
```

### Edit Shared Banner Content (secondary renter)
```bash
cleos push action cheesebannad editsharedbanner '["myaccount", 1707350400, 1, "QmHash...", "https://mysite.com"]' -p myaccount@active
```

## Admin Actions

### Withdraw Tokens
```bash
cleos push action cheesebannad withdraw '["eosio.token", "adminaccount", "10.00000000 WAX"]' -p cheesebannad@active
```

### Cleanup Expired Slots (recover RAM)
Erases up to 100 expired slots per call. Run periodically.
```bash
# Erase all slots older than 2024-02-08 00:00:00 UTC (timestamp 1707350400)
cleos push action cheesebannad cleanup '[1707350400]' -p cheesebannad@active
```

## Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `bannerads` | contract | Ad slots (key: `time * 10 + position`) |
| `config` | contract | Pricing config (id = 1) |

### config fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | uint64 | Always `1` (singleton) |
| `wax_price_per_day` | asset | Price per slot per day in WAX |
| `wax_per_cheese_baseline` | double | WAX/CHEESE baseline rate for UI display |

## Security

- Cannot rent past or already-rented slots
- Overpayment is automatically refunded to sender
- Expired slots cannot be edited (`editadbanner` / `editsharedbanner`)
- Malformed memo values return a clean error (no unhandled C++ exception)
- Renting user pays their own RAM on slot modification
- Max 100 slots erased per `cleanup` call to prevent CPU timeout
- IPFS hash max 128 chars, URL max 256 chars
- Only slot owner can edit their banner content
