# cheeseamphub Smart Contract

A WAX blockchain smart contract for tracking music NFT plays and distributing CHEESE royalties to collection creators.

## Overview

CHEESEAmp is a music player for WAX music NFTs. This contract:
1. Accepts music NFT deposits to register eligible tracks
2. Logs plays with a 5-minute per-user cooldown
3. Tracks play counts per collection
4. Allows collection creators to claim CHEESE royalties based on play counts

## How It Works

### For Music NFT Creators

1. **Deposit NFTs**: Send your music NFTs to `cheeseamphub` via AtomicAssets transfer
2. **Plays accumulate**: As users listen to your tracks, play counts increase
3. **Claim royalties**: Call `claimroyalty` to receive CHEESE based on `unclaimed_plays × royalty_per_play`

### For Listeners

**Anchor Wallet**: Plays are logged automatically per-track via session keys (frictionless, no popups after initial approval).

**Cloud Wallet**: Plays are buffered locally and submitted in a single batch transaction (`logplays`) during natural signing moments.

### Play Logging

- `logplay(caller, template_id)` — Single play (Anchor)
- `logplays(caller, template_ids[])` — Batch plays (Cloud Wallet, max 50)
- 5-minute cooldown per caller+template prevents spam

## Tables

### deposits (scope: self)

| Field | Type | Description |
|-------|------|-------------|
| asset_id | uint64 | Primary key, AtomicAssets asset ID |
| depositor | name | Account that deposited the NFT |
| collection_name | name | AtomicAssets collection |
| template_id | uint32 | Template ID for play matching |

### playcounts (scope: self)

| Field | Type | Description |
|-------|------|-------------|
| collection_name | name | Primary key, collection identifier |
| total_plays | uint64 | All-time play count |
| unclaimed_plays | uint64 | Plays since last royalty claim |

### config (scope: self, singleton)

| Field | Type | Description |
|-------|------|-------------|
| id | uint64 | Always 1 |
| royalty_per_play | asset | CHEESE amount per play |
| token_contract | name | Token contract for payouts |

### playlogs (scope: self)

| Field | Type | Description |
|-------|------|-------------|
| id | uint64 | Auto-increment primary key |
| caller | name | User who played |
| template_id | uint32 | Track template |
| timestamp | uint32 | Unix timestamp of play |

## Deployment

```bash
cd contracts/cheeseamphub
make
make deploy
make setup-permissions
```

### Initial Config

```bash
# Set royalty: 1.0000 CHEESE per play
cleos push action cheeseamphub setconfig '["1.0000 CHEESE", "cheeseburger"]' -p cheeseamphub@active
```

### Fund the Contract

```bash
# Send CHEESE to the contract for royalty payouts
cleos push action cheeseburger transfer '["yourwallet", "cheeseamphub", "100000.0000 CHEESE", "Royalty funding"]' -p yourwallet@active
```

## Security

- **Cooldown**: 5-minute per caller+template prevents replay spam
- **Template verification**: Only deposited templates can log plays
- **Batch limit**: Max 50 plays per `logplays` call
- **Admin controls**: Only contract account can setconfig, withdraw, removedepo

## License

MIT
