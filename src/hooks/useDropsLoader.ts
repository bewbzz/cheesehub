import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';

const DROPS_CACHE_KEY = 'cheesehub_drops_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  drops: NFTDrop[];
  timestamp: number;
}

// Load cached drops from localStorage
function loadCachedDrops(): NFTDrop[] | null {
  try {
    const cached = localStorage.getItem(DROPS_CACHE_KEY);
    if (!cached) return null;
    
    const data: CacheData = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(DROPS_CACHE_KEY);
      return null;
    }
    
    return data.drops;
  } catch {
    return null;
  }
}

// Save drops to cache
function saveCacheDrops(drops: NFTDrop[]) {
  try {
    const data: CacheData = {
      drops,
      timestamp: Date.now(),
    };
    localStorage.setItem(DROPS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full
  }
}

// Clear drops cache
export function clearDropsCache() {
  try {
    localStorage.removeItem(DROPS_CACHE_KEY);
  } catch {
    // ignore
  }
}

// Optimized drops fetcher with batched template lookups
async function fetchDropsOptimized(
  onProgress?: (loaded: number, total: number) => void
): Promise<NFTDrop[]> {
  const { fetchTableRows } = await import('@/lib/waxRpcFallback');
  const { fetchWithFallback } = await import('@/lib/fetchWithFallback');
  const { ATOMIC_API, CHEESE_CONFIG, NFTHIVE_CONFIG } = await import('@/lib/waxConfig');
  
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ];

  function getIpfsUrl(hash: string): string {
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }

  function getImageUrl(img: string | undefined): string {
    if (!img) return '/placeholder.svg';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('ipfs://')) {
      const hash = img.replace('ipfs://', '');
      return getIpfsUrl(hash);
    }
    if (img.startsWith('Qm') || img.startsWith('bafy') || img.startsWith('bafk')) {
      return getIpfsUrl(img);
    }
    if (img.startsWith('/ipfs/')) {
      return `https://ipfs.io${img}`;
    }
    if (/^[a-zA-Z0-9]{46,}$/.test(img)) {
      return getIpfsUrl(img);
    }
    return img || '/placeholder.svg';
  }

  function parseListingPrice(listingPrice: string): { price: number; currency: string } {
    const parts = listingPrice.trim().split(' ');
    if (parts.length >= 2) {
      return { price: parseFloat(parts[0]) || 0, currency: parts[1] || 'WAX' };
    }
    return { price: 0, currency: 'WAX' };
  }

  // Step 1: Fetch raw drops from blockchain (fast)
  interface OnChainDrop {
    drop_id: number;
    authorized_account: string;
    collection_name: string;
    assets_to_mint: Array<{ template_id: number; tokens_to_back: unknown[]; pool_id: number }>;
    listing_price: string;
    settlement_symbol: string;
    price_recipient: string;
    fee_rate: string;
    auth_required: number;
    is_hidden: number;
    max_claimable: number;
    current_claimed: number;
    account_limit: number;
    account_limit_cooldown: number;
    start_time: number;
    end_time: number;
    display_data: string;
  }

  const result = await fetchTableRows<OnChainDrop>({
    code: 'nfthivedrops',
    scope: 'nfthivedrops',
    table: 'drops',
    limit: 1000,
  });

  const now = Math.floor(Date.now() / 1000);
  const rawDrops = result.rows.filter(d => {
    if (d.is_hidden) return false;
    if (d.end_time > 0 && d.end_time < now) return false;
    return true;
  });

  onProgress?.(0, rawDrops.length);

  // Step 2: Collect unique template IDs for batch fetching
  const templateIdMap = new Map<string, { collectionName: string; templateId: string }>();
  for (const drop of rawDrops) {
    const templateId = drop.assets_to_mint?.[0]?.template_id;
    if (templateId) {
      const key = `${drop.collection_name}/${templateId}`;
      if (!templateIdMap.has(key)) {
        templateIdMap.set(key, { collectionName: drop.collection_name, templateId: String(templateId) });
      }
    }
  }

  // Step 3: Batch fetch templates (10 parallel requests at a time)
  const templateData = new Map<string, { name: string; image: string; maxSupply: number; issuedSupply: number }>();
  const templateEntries = Array.from(templateIdMap.entries());
  const BATCH_SIZE = 10;

  for (let i = 0; i < templateEntries.length; i += BATCH_SIZE) {
    const batch = templateEntries.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(async ([key, { collectionName, templateId }]) => {
        try {
          const path = `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();
          
          if (json.success && json.data) {
            const template = json.data;
            const data = template.immutable_data || {};
            return {
              key,
              data: {
                name: data.name || template.name || `Template #${templateId}`,
                image: getImageUrl(data.img || data.image),
                maxSupply: parseInt(template.max_supply) || 0,
                issuedSupply: parseInt(template.issued_supply) || 0,
              },
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        templateData.set(result.value.key, result.value.data);
      }
    }

    onProgress?.(Math.min(i + BATCH_SIZE, templateEntries.length), templateEntries.length);
  }

  // Step 4: Build enriched drops using cached template data
  const enrichedDrops: NFTDrop[] = rawDrops.map((drop) => {
    const templateId = drop.assets_to_mint?.[0]?.template_id;
    const { price, currency } = parseListingPrice(drop.listing_price);

    let displayData: { name?: string; description?: string } = {};
    try {
      if (drop.display_data) {
        displayData = JSON.parse(drop.display_data);
      }
    } catch { /* ignore */ }

    const templateKey = `${drop.collection_name}/${templateId}`;
    const template = templateData.get(templateKey);

    const name = displayData.name || template?.name || `Drop #${drop.drop_id}`;
    const description = displayData.description || 'A unique NFT drop';
    const image = template?.image || '/placeholder.svg';

    const maxClaimable = drop.max_claimable || 0;
    const remaining = Math.max(0, maxClaimable - drop.current_claimed);

    return {
      id: `nfthive-${drop.drop_id}`,
      dropId: String(drop.drop_id),
      templateId: templateId ? String(templateId) : undefined,
      collectionName: drop.collection_name,
      name,
      description,
      image,
      price,
      totalSupply: maxClaimable,
      remaining,
      attributes: [{ trait: 'Rarity', value: 'Common' }],
      endDate: drop.end_time > 0 ? new Date(drop.end_time * 1000).toISOString() : undefined,
      dropSource: 'nfthive' as const,
      settlementSymbol: drop.settlement_symbol,
      listingPrice: drop.listing_price,
      currency,
    };
  });

  // Filter and dedupe
  const seen = new Set<string>();
  return enrichedDrops.filter((drop) => {
    const key = drop.templateId ? `template-${drop.templateId}` : drop.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return drop.price > 0;
  });
}

export interface DropsLoaderState {
  drops: NFTDrop[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  progress: { loaded: number; total: number };
  refresh: () => Promise<void>;
}

export function useDropsLoader(): DropsLoaderState {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialCacheRef = useRef<NFTDrop[] | null>(null);

  // Load from cache on mount
  useEffect(() => {
    initialCacheRef.current = loadCachedDrops();
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['drops-optimized'],
    queryFn: async () => {
      const drops = await fetchDropsOptimized((loaded, total) => {
        setProgress({ loaded, total });
      });
      saveCacheDrops(drops);
      return drops;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // 5 minutes
    placeholderData: () => initialCacheRef.current || undefined,
  });

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    clearDropsCache();
    await queryClient.invalidateQueries({ queryKey: ['drops-optimized'] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  return {
    drops: data || initialCacheRef.current || [],
    isLoading: isLoading && !initialCacheRef.current,
    isRefreshing,
    error: error as Error | null,
    progress,
    refresh,
  };
}
