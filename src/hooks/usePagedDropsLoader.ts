import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NFTDrop } from '@/types/drop';
import { fetchRawDrops, enrichDropTemplates } from '@/services/atomicApi';

const DROPS_CACHE_KEY = 'cheesehub_drops_cache_v4';
const PAGE_CACHE_KEY = 'cheesehub_drops_page';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DROPS_PER_PAGE = 50;

interface CacheData {
  drops: NFTDrop[];
  timestamp: number;
}

interface EnrichedPagesCache {
  [pageKey: string]: NFTDrop[];
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

// Session storage for last page
function getStoredPage(): number {
  try {
    const stored = sessionStorage.getItem(PAGE_CACHE_KEY);
    if (stored) {
      const page = parseInt(stored, 10);
      if (!isNaN(page) && page >= 1) return page;
    }
  } catch {
    // ignore
  }
  return 1;
}

function setStoredPage(page: number) {
  try {
    sessionStorage.setItem(PAGE_CACHE_KEY, String(page));
  } catch {
    // ignore
  }
}

export interface PagedDropsLoaderState {
  allDrops: NFTDrop[];
  pageDrops: NFTDrop[];
  currentPage: number;
  totalPages: number;
  totalDrops: number;
  isLoading: boolean;
  isEnrichingPage: boolean;
  isRefreshing: boolean;
  error: Error | null;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
}

export function usePagedDropsLoader(
  filteredDrops: NFTDrop[],
  filterDeps: unknown[] = []
): PagedDropsLoaderState {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(() => getStoredPage());
  const [enrichedPages, setEnrichedPages] = useState<EnrichedPagesCache>({});
  const [isEnrichingPage, setIsEnrichingPage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const enrichmentAbortRef = useRef<AbortController | null>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const initialCacheRef = useRef<NFTDrop[] | null>(null);

  // Load from cache on mount
  useEffect(() => {
    initialCacheRef.current = loadCachedDrops();
  }, []);

  // Fast query - just gets raw drop data from chain
  const { data: rawDrops, isLoading, error, refetch } = useQuery({
    queryKey: ['drops-raw'],
    queryFn: () => fetchRawDrops(),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    placeholderData: () => initialCacheRef.current || undefined,
  });

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredDrops.length / DROPS_PER_PAGE));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  // Get drops for current page
  const currentPageDrops = useMemo(() => {
    const start = (validPage - 1) * DROPS_PER_PAGE;
    const end = start + DROPS_PER_PAGE;
    return filteredDrops.slice(start, end);
  }, [filteredDrops, validPage]);

  // Get drops for next page (for prefetching)
  const nextPageDrops = useMemo(() => {
    if (validPage >= totalPages) return [];
    const start = validPage * DROPS_PER_PAGE;
    const end = start + DROPS_PER_PAGE;
    return filteredDrops.slice(start, end);
  }, [filteredDrops, validPage, totalPages]);

  // Create a stable key for the current page's drops
  const pageKey = useMemo(() => {
    return currentPageDrops.map(d => d.id).join(',');
  }, [currentPageDrops]);

  const nextPageKey = useMemo(() => {
    return nextPageDrops.map(d => d.id).join(',');
  }, [nextPageDrops]);

  // Check if drops need enrichment (missing images)
  const needsEnrichment = useCallback((drops: NFTDrop[]): boolean => {
    return drops.some(d => !d.image || d.image === '/placeholder.svg');
  }, []);

  // Enrich current page
  useEffect(() => {
    if (!currentPageDrops.length) return;

    // Check if already enriched
    if (enrichedPages[pageKey] && !needsEnrichment(enrichedPages[pageKey])) {
      return;
    }

    // Check if drops already have images (from cache)
    if (!needsEnrichment(currentPageDrops)) {
      setEnrichedPages(prev => ({ ...prev, [pageKey]: currentPageDrops }));
      return;
    }

    // Cancel previous enrichment
    if (enrichmentAbortRef.current) {
      enrichmentAbortRef.current.abort();
    }
    enrichmentAbortRef.current = new AbortController();

    setIsEnrichingPage(true);
    console.log('[PagedDropsLoader] Enriching page', validPage, 'with', currentPageDrops.length, 'drops');

    enrichDropTemplates(
      currentPageDrops,
      enrichmentAbortRef.current.signal,
      (progress, partialDrops) => {
        if (progress.loaded === progress.total && progress.total > 0) {
          setEnrichedPages(prev => ({ ...prev, [pageKey]: partialDrops }));
          setIsEnrichingPage(false);
          
          // Update main cache with enriched drops
          const allEnriched = [...(rawDrops || [])];
          partialDrops.forEach(enriched => {
            const idx = allEnriched.findIndex(d => d.id === enriched.id);
            if (idx !== -1) allEnriched[idx] = enriched;
          });
          saveCacheDrops(allEnriched);
        }
      }
    ).catch(err => {
      if (err?.name !== 'AbortError') {
        console.error('[PagedDropsLoader] Enrichment failed:', err);
      }
      setIsEnrichingPage(false);
    });

    return () => {
      if (enrichmentAbortRef.current) {
        enrichmentAbortRef.current.abort();
      }
    };
  }, [pageKey, currentPageDrops, validPage, needsEnrichment, rawDrops]);

  // Prefetch next page in background
  useEffect(() => {
    if (!nextPageDrops.length || isEnrichingPage) return;

    // Check if already enriched
    if (enrichedPages[nextPageKey] && !needsEnrichment(enrichedPages[nextPageKey])) {
      return;
    }

    // Check if drops already have images
    if (!needsEnrichment(nextPageDrops)) {
      setEnrichedPages(prev => ({ ...prev, [nextPageKey]: nextPageDrops }));
      return;
    }

    // Small delay before prefetching
    const timer = setTimeout(() => {
      if (prefetchAbortRef.current) {
        prefetchAbortRef.current.abort();
      }
      prefetchAbortRef.current = new AbortController();

      console.log('[PagedDropsLoader] Prefetching next page', validPage + 1);

      enrichDropTemplates(
        nextPageDrops,
        prefetchAbortRef.current.signal,
        (progress, partialDrops) => {
          if (progress.loaded === progress.total && progress.total > 0) {
            setEnrichedPages(prev => ({ ...prev, [nextPageKey]: partialDrops }));
          }
        }
      ).catch(err => {
        if (err?.name !== 'AbortError') {
          console.warn('[PagedDropsLoader] Prefetch failed:', err);
        }
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      if (prefetchAbortRef.current) {
        prefetchAbortRef.current.abort();
      }
    };
  }, [nextPageKey, nextPageDrops, validPage, isEnrichingPage, needsEnrichment]);

  // Reset to page 1 when filters change (except on initial load)
  const filterKey = JSON.stringify(filterDeps);
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setCurrentPage(1);
      setStoredPage(1);
    }
  }, [filterKey]);

  // Ensure page is valid when total changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
      setStoredPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setPage = useCallback((page: number) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
    setStoredPage(newPage);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    clearDropsCache();
    initialCacheRef.current = null;
    setEnrichedPages({});
    setCurrentPage(1);
    setStoredPage(1);
    
    if (enrichmentAbortRef.current) enrichmentAbortRef.current.abort();
    if (prefetchAbortRef.current) prefetchAbortRef.current.abort();
    
    await queryClient.invalidateQueries({ queryKey: ['drops-raw'] });
    await refetch();
    setIsRefreshing(false);
  }, [queryClient, refetch]);

  // Get the best available drops for display
  const pageDrops = useMemo(() => {
    // First, check if we have enriched drops for this exact page
    if (enrichedPages[pageKey]?.length) {
      return enrichedPages[pageKey];
    }
    // Fall back to current page drops (may have placeholder images)
    return currentPageDrops;
  }, [enrichedPages, pageKey, currentPageDrops]);

  return {
    allDrops: rawDrops || [],
    pageDrops,
    currentPage: validPage,
    totalPages,
    totalDrops: filteredDrops.length,
    isLoading: isLoading && !initialCacheRef.current,
    isEnrichingPage,
    isRefreshing,
    error: error as Error | null,
    setPage,
    refresh,
  };
}

export { DROPS_PER_PAGE };
