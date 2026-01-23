import { useState, useEffect, useRef, useMemo } from 'react';
import type { NFTDrop } from '@/types/drop';
import { enrichDropTemplates } from '@/services/atomicApi';

// Global cache of enriched drops to persist across hook instances
const enrichedDropsCache = new Map<string, NFTDrop>();

/**
 * Hook that enriches only the provided drops with template data (images, metadata).
 * Designed for page-level enrichment - only fetches templates for the drops passed in.
 * Much faster than enriching all drops at once.
 */
export function useEnrichDrops(drops: NFTDrop[]): {
  enrichedDrops: NFTDrop[];
  isEnriching: boolean;
  progress: { loaded: number; total: number };
} {
  // Use lazy state initialization to avoid React queue errors
  const [enrichedDrops, setEnrichedDrops] = useState<NFTDrop[]>(() => []);
  const [isEnriching, setIsEnriching] = useState(() => false);
  const [progress, setProgress] = useState(() => ({ loaded: 0, total: 0 }));
  const abortRef = useRef<AbortController | null>(null);
  const isEnrichingRef = useRef(false);
  const lastDropsKeyRef = useRef('');

  // Create a stable key from drop IDs to detect when the drops actually change
  const dropsKey = useMemo(() => {
    if (!drops || !drops.length) return '';
    return drops.map(d => d.id).sort().join(',');
  }, [drops]);

  // Memoize drops with cache applied
  const dropsWithCache = useMemo(() => {
    if (!drops || !drops.length) return [];
    return drops.map(drop => {
      const cached = enrichedDropsCache.get(drop.id);
      if (cached && cached.image && cached.image !== '/placeholder.svg') {
        return cached;
      }
      return drop;
    });
  }, [drops]);

  // Check if we actually need to enrich
  const dropsNeedingEnrichment = useMemo(() => {
    return dropsWithCache.filter(drop => {
      if (!drop.image || drop.image === '/placeholder.svg' || drop.image.includes('placeholder')) {
        return true;
      }
      return false;
    });
  }, [dropsWithCache]);

  useEffect(() => {
    // If no drops, clear state
    if (!drops || !drops.length) {
      setEnrichedDrops([]);
      setIsEnriching(false);
      setProgress({ loaded: 0, total: 0 });
      return;
    }

    // If all drops already have images from cache, just return them
    if (dropsNeedingEnrichment.length === 0) {
      setEnrichedDrops(dropsWithCache);
      setIsEnriching(false);
      setProgress({ loaded: dropsWithCache.length, total: dropsWithCache.length });
      return;
    }

    // Only restart enrichment if the drops actually changed
    const keyChanged = dropsKey !== lastDropsKeyRef.current;
    lastDropsKeyRef.current = dropsKey;

    // If already enriching the same set, don't restart
    if (isEnrichingRef.current && !keyChanged) {
      return;
    }

    // Cancel previous enrichment only if key changed
    if (keyChanged && abortRef.current) {
      abortRef.current.abort();
    }
    
    abortRef.current = new AbortController();
    const controller = abortRef.current;

    setIsEnriching(true);
    isEnrichingRef.current = true;
    setProgress({ loaded: 0, total: dropsNeedingEnrichment.length });

    console.log('[useEnrichDrops] Enriching', dropsNeedingEnrichment.length, 'of', drops.length, 'drops');

    // Start enrichment for just the drops needing it
    enrichDropTemplates(
      dropsNeedingEnrichment,
      controller.signal,
      (prog, partialEnriched) => {
        if (controller.signal.aborted) return;
        
        setProgress(prog);
        
        // Update cache with enriched drops
        partialEnriched.forEach(d => {
          if (d.image && d.image !== '/placeholder.svg') {
            enrichedDropsCache.set(d.id, d);
          }
        });
        
        // Build merged result from original drops + cache
        const merged = drops.map(drop => {
          const cached = enrichedDropsCache.get(drop.id);
          return cached || drop;
        });
        
        setEnrichedDrops(merged);
        
        if (prog.loaded === prog.total && prog.total > 0) {
          setIsEnriching(false);
          isEnrichingRef.current = false;
          console.log('[useEnrichDrops] Enrichment complete');
        }
      }
    ).catch(err => {
      if (err?.name !== 'AbortError') {
        console.error('[useEnrichDrops] Enrichment failed:', err);
      }
      setIsEnriching(false);
      isEnrichingRef.current = false;
    });

    // Don't abort on cleanup - let enrichment complete
    // Only abort when dropsKey changes (handled above)
  }, [dropsKey, dropsNeedingEnrichment.length, drops, dropsWithCache]);

  // Always return something - cache-applied drops or original
  const result = enrichedDrops.length > 0 ? enrichedDrops : dropsWithCache;

  return {
    enrichedDrops: result,
    isEnriching,
    progress,
  };
}

/**
 * Hook to prefetch templates for the next page in the background.
 * Low priority - won't block UI.
 */
export function usePrefetchDrops(drops: NFTDrop[], enabled: boolean): void {
  const abortRef = useRef<AbortController | null>(null);

  const dropsKey = useMemo(() => {
    if (!drops || !drops.length) return '';
    return drops.map(d => d.id).sort().join(',');
  }, [drops]);

  const toPrefetch = useMemo(() => {
    if (!drops || !drops.length) return [];
    return drops.filter(d => {
      // Skip if already in cache
      if (enrichedDropsCache.has(d.id)) return false;
      if (d.image && d.image !== '/placeholder.svg') return false;
      return true;
    });
  }, [drops]);

  useEffect(() => {
    if (!enabled || !toPrefetch.length) return;

    // Cancel previous prefetch
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const controller = abortRef.current;

    console.log('[usePrefetchDrops] Prefetching', toPrefetch.length, 'drops for next page');

    // Use setTimeout to run at low priority
    const timeoutId = setTimeout(() => {
      enrichDropTemplates(
        toPrefetch,
        controller.signal,
        (prog, enriched) => {
          enriched.forEach(d => {
            if (d.image && d.image !== '/placeholder.svg') {
              enrichedDropsCache.set(d.id, d);
            }
          });
        }
      ).catch(() => {
        // Silently ignore prefetch errors
      });
    }, 500); // Delay to let current page load first

    return () => {
      clearTimeout(timeoutId);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [dropsKey, enabled, toPrefetch]);
}

/**
 * Clear the enrichment cache (useful after refresh)
 */
export function clearEnrichmentCache() {
  enrichedDropsCache.clear();
}
