# cheesebannad - CHEESEHub Banner Ad Contract

Smart contract for paid banner advertising slots on CHEESEHub.

## Overview

The contract owner initializes 24-hour ad slots. Anyone can rent slots by paying WAX:
- **100 WAX per day** (default, configurable via `setconfig`)

WAX payments are split atomically (if any step fails, the entire transaction reverts):
- **20% WAX** → `cheeseburner` (ecosystem financing)
- **80% WAX** → swapped to CHEESE via Alcor Pool 1252
  - **66% CHEESE** → burned to `eosio.null`
  - **34% CHEESE** → sent to `xcheeseliqst` (liquidity staking)

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
cleos push action cheesebannad setconfig '["100.00000000 WAX", 1.50]' -p cheesebannad@active
```

### 6. Initialize Ad Slots
Create 30 days of slots starting from a Unix timestamp:
```bash
cleos push action cheesebannad initbannerad '[1707350400, 30]' -p cheesebannad@active
```

## User Flow

### Rent with WAX
```bash
cleos transfer myaccount cheesebannad "100.00000000 WAX" "banner|1707350400|1" -p myaccount@active
```

### Rent with CHEESE
```bash
cleos transfer myaccount cheesebannad "5000.0000 CHEESE" "banner|1707350400|1" -c cheeseburger -p myaccount@active
```

### Edit Banner
```bash
cleos push action cheesebannad editadbanner '["myaccount", 1707350400, "QmHash...", "https://mysite.com"]' -p myaccount@active
```

## Tables

| Table | Scope | Description |
|-------|-------|-------------|
| `bannerads` | contract | Ad slots (key: timestamp) |
| `config` | contract | Pricing config (singleton) |

## Security

- Alcor Pool 1252 reserves-based pricing with 30% deviation guard
- Cannot rent past or already-rented slots
- IPFS hash max 128 chars, URL max 256 chars
- Only slot owner can edit their banner content
