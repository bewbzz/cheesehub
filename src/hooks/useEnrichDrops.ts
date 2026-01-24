import { useState, useEffect, useRef, useMemo } from 'react';
import type { NFTDrop } from '@/types/drop';
import { enrichDropTemplates } from '@/services/atomicApi';

// Global cache of enriched drops to persist across hook instances
const enrichedDropsCache = new Map<string, NFTDrop>();

// Track drops that failed to load images (for retry functionality)
const failedDropIds = new Set<string>();

// Subscribers for retry events
const retrySubscribers = new Set<() => void>();

/**
 * Mark a drop as failed (image didn't load)
 */
export function markDropAsFailed(dropId: string) {
  failedDropIds.add(dropId);
}

/**
 * Trigger a retry of all failed drops - clears them from cache and re-enriches
 */
export function retryFailedDrops() {
  // Clear failed drops from cache so they get re-enriched
  failedDropIds.forEach(id => {
    enrichedDropsCache.delete(id);
  });
  failedDropIds.clear();
  
  // Notify all subscribers to re-enrich
  retrySubscribers.forEach(fn => fn());
}

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
  const [retryTrigger, setRetryTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const isEnrichingRef = useRef(false);
  const lastDropsKeyRef = useRef('');

  // Subscribe to retry events
  useEffect(() => {
    const handleRetry = () => setRetryTrigger(t => t + 1);
    retrySubscribers.add(handleRetry);
    return () => { retrySubscribers.delete(handleRetry); };
  }, []);

  // Create a stable key from drop IDs to detect when the drops actually change
  const dropsKey = useMemo(() => {
    if (!drops || !drops.length) return '';
    return drops.map(d => d.id).sort().join(',');
  }, [drops]);

  // Memoize drops with cache applied (include retryTrigger to force refresh)
  const dropsWithCache = useMemo(() => {
    if (!drops || !drops.length) return [];
    return drops.map(drop => {
      const cached = enrichedDropsCache.get(drop.id);
      if (cached && cached.image && cached.image !== '/placeholder.svg') {
        return cached;
      }
      return drop;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, retryTrigger]);

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

    // Create a key that includes retryTrigger to force re-enrichment
    const fullKey = `${dropsKey}-${retryTrigger}`;
    const keyChanged = fullKey !== lastDropsKeyRef.current;
    lastDropsKeyRef.current = fullKey;

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
  }, [dropsKey, dropsNeedingEnrichment.length, drops, dropsWithCache, retryTrigger]);

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
