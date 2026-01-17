import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';
import { fetchNFTHiveDrops } from '@/services/atomicApi';

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

// Fast fetch using NFTHive API (primary path - returns enriched data in single request)
async function fetchDropsFast(): Promise<NFTDrop[]> {
  const drops = await fetchNFTHiveDrops();
  
  if (drops && drops.length > 0) {
    saveCacheDrops(drops);
    return drops;
  }
  
  throw new Error('No drops returned from NFTHive API');
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
      const drops = await fetchDropsFast();
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
