import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';
import { fetchRawDrops, enrichDropTemplates } from '@/services/atomicApi';

const DROPS_CACHE_KEY = 'cheesehub_drops_cache_v3'; // Bumped version for new structure
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
  progress: { loaded: number; total: number };
  refresh: () => Promise<void>;
}

// Load cache synchronously to avoid state updates during render
const getInitialCache = () => loadCachedDrops();

export function useDropsLoader(): DropsLoaderState {
  const queryClient = useQueryClient();
  // Initialize with cached data synchronously to avoid hook order issues
  const [initialCache] = useState<NFTDrop[] | null>(getInitialCache);
  const [enrichedDrops, setEnrichedDrops] = useState<NFTDrop[]>(() => initialCache || []);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ loaded: 0, total: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const enrichmentAbortRef = useRef<AbortController | null>(null);

  // Fast query - just gets raw drop data from chain (no template fetching)
  const { data: rawDrops, isLoading, error, refetch } = useQuery({
    queryKey: ['drops-raw'],
    queryFn: () => fetchRawDrops(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // 5 minutes
    placeholderData: () => initialCache || undefined,
  });

  // Separate enrichment effect - runs independently of React Query's abort signal
  useEffect(() => {
    if (!rawDrops?.length) return;

    // If we have cached enriched drops with images, skip re-enrichment
    const hasEnrichedCache = initialCache?.some(d => d.image && d.image !== '/placeholder.svg');
    if (hasEnrichedCache && enrichedDrops.length > 0) {
      // Only re-enrich if the raw drop count changed significantly
      const countDiff = Math.abs(rawDrops.length - enrichedDrops.length);
      if (countDiff < 5) {
        return;
      }
    }

    // Cancel any previous enrichment
    if (enrichmentAbortRef.current) {
      enrichmentAbortRef.current.abort();
    }
    enrichmentAbortRef.current = new AbortController();

    console.log('[DropsLoader] Starting template enrichment for', rawDrops.length, 'drops');

    // Start enrichment - this runs in the background
    enrichDropTemplates(
      rawDrops,
      enrichmentAbortRef.current.signal,
      (progress, partialDrops) => {
        setEnrichmentProgress(progress);
        setEnrichedDrops(partialDrops);
        
        // Save to cache as we go
        if (progress.loaded === progress.total && progress.total > 0) {
          saveCacheDrops(partialDrops);
          console.log('[DropsLoader] Enrichment complete, saved to cache');
        }
      }
    ).catch(err => {
      if (err?.name !== 'AbortError') {
        console.error('[DropsLoader] Enrichment failed:', err);
      }
    });

    return () => {
      if (enrichmentAbortRef.current) {
        enrichmentAbortRef.current.abort();
      }
    };
  }, [rawDrops]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    clearDropsCache();
    // Cache will be refreshed on next load
    setEnrichedDrops([]);
    setEnrichmentProgress({ loaded: 0, total: 0 });
    
    // Cancel any ongoing enrichment
    if (enrichmentAbortRef.current) {
      enrichmentAbortRef.current.abort();
    }
    
    await queryClient.invalidateQueries({ queryKey: ['drops-raw'] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  // Return enriched drops if available, otherwise raw drops, otherwise cached
  const displayDrops = enrichedDrops.length > 0 
    ? enrichedDrops 
    : rawDrops || initialCache || [];

  return {
    drops: displayDrops,
    isLoading: isLoading && !initialCache && enrichedDrops.length === 0,
    isRefreshing,
    error: error as Error | null,
    progress: enrichmentProgress,
    refresh,
  };
}
