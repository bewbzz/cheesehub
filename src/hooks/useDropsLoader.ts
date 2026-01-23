import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';
import { fetchRawDrops } from '@/services/atomicApi';

const DROPS_CACHE_KEY = 'cheesehub_drops_cache_v4'; // Bumped version - now stores raw drops only
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

export interface DropsLoaderState {
  drops: NFTDrop[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Simplified drops loader - fetches raw drops only.
 * Template enrichment is now handled at the page level by useEnrichDrops.
 * This makes initial load much faster since we don't fetch 1000+ templates upfront.
 */
export function useDropsLoader(): DropsLoaderState {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialCacheRef = useRef<NFTDrop[] | null>(null);

  // Load from cache on mount
  useEffect(() => {
    initialCacheRef.current = loadCachedDrops();
  }, []);

  // Fast query - just gets raw drop data from chain (no template fetching)
  const { data: rawDrops, isLoading, error, refetch } = useQuery({
    queryKey: ['drops-raw'],
    queryFn: async () => {
      const drops = await fetchRawDrops();
      // Cache raw drops for fast subsequent loads
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
    initialCacheRef.current = null;
    
    await queryClient.invalidateQueries({ queryKey: ['drops-raw'] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  // Return raw drops immediately - enrichment happens at page level
  const displayDrops = rawDrops || initialCacheRef.current || [];

  return {
    drops: displayDrops,
    isLoading: isLoading && !initialCacheRef.current,
    isRefreshing,
    error: error as Error | null,
    refresh,
  };
}
