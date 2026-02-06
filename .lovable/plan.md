
# Fix: NFT Image Loading Issues in Drop Detail Page

## Problem Summary

NFT images in the Drop Detail page are failing to display, showing either a blank gray square or a permanent loading spinner. This happens even when the same NFTs display correctly in the grid/card view.

## Root Causes Identified

### 1. Inconsistent IPFS Gateway Configuration

The gateway lists between `DropCard.tsx` and `DropDetail.tsx` are different:

| Component | Gateway Order |
|-----------|--------------|
| DropCard | Pinata, Cloudflare, NFT.storage, dweb.link, ipfs.io |
| DropDetail | ipfs.io, Pinata, Cloudflare, dweb.link (missing NFT.storage) |

This inconsistency means an image that loads via Pinata in the card view will try ipfs.io first in the detail view, potentially timing out.

### 2. Missing Gateway in DropDetail

`DropDetail.tsx` is missing the `nftstorage.link` gateway, reducing its fallback options.

### 3. Gateway Reliability Issues

Based on network analysis, Cloudflare IPFS gateway is experiencing `ERR_TUNNEL_CONNECTION_FAILED` errors. The current gateway order prioritizes unreliable gateways.

## Solution

### Change 1: Unify IPFS Gateway Configuration

Create a shared constant for IPFS gateways to ensure consistency across all components.

**New file: `src/lib/ipfsGateways.ts`**
```typescript
// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing)
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/', 
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/', // Moved to last - experiencing tunnel errors
];

// Timeout configuration
export const IMAGE_LOAD_TIMEOUT = {
  card: 6000,        // 6 seconds for cards (50 loading at once)
  detail: 10000,     // 10 seconds for detail page
  increment: 3000,   // Add 3s per retry
  max: 15000,        // Max 15 seconds
};
```

### Change 2: Update DropDetail.tsx

Import from shared config and fix the gateway list:

```typescript
import { IPFS_GATEWAYS, IMAGE_LOAD_TIMEOUT } from '@/lib/ipfsGateways';

// Remove local IPFS_GATEWAYS definition
// Use IMAGE_LOAD_TIMEOUT.detail instead of hardcoded 10000
```

### Change 3: Update DropCard.tsx

Import from shared config:

```typescript
import { IPFS_GATEWAYS, IMAGE_LOAD_TIMEOUT } from '@/lib/ipfsGateways';

// Remove local IPFS_GATEWAYS and timeout definitions
```

### Change 4: Update atomicApi.ts

The preload function also has its own gateway list - unify it:

```typescript
import { IPFS_GATEWAYS } from '@/lib/ipfsGateways';

// Remove local IPFS_GATEWAYS definition (lines 68-74)
```

### Change 5: Add Better Error Recovery in DropDetail

Fix the stale closure issue in the timeout effect:

```typescript
// Add handleImageError to dependency array
}, [imageUrl, imageLoaded, imageError, handleImageError]);
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/ipfsGateways.ts` | New file - shared IPFS gateway configuration |
| `src/pages/DropDetail.tsx` | Import shared config, fix dependency array |
| `src/components/drops/DropCard.tsx` | Import shared config |
| `src/services/atomicApi.ts` | Import shared config |

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| Card shows image, detail blank | Gateway mismatch | Same gateway order used |
| Cloudflare timeouts | First/second in fallback | Last in fallback order |
| Missing NFT.storage in detail | Only 4 gateways | All 5 gateways available |
| Stale closure bugs | Possible race conditions | Fixed dependency arrays |

## Technical Notes

- Gateway order is based on observed reliability: Pinata and dweb.link are most reliable
- Cloudflare IPFS is moved to last due to `ERR_TUNNEL_CONNECTION_FAILED` errors
- NFT.storage added back to DropDetail for complete coverage
- Shared configuration prevents future drift between components
