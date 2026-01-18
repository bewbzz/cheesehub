import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CombinedBacking, 
  fetchMultipleCombinedBackings,
  calculateCombinedBackingTotals,
  formatTokenAmount,
} from '@/lib/tokenBacking';

interface NFTWithCollection {
  asset_id: string;
  collection: string;
}

interface BackingTotals {
  native: Map<string, { amount: number; contract: string; precision: number }>;
  waxdao: Map<string, { amount: number; contract: string; precision: number }>;
  waxdaoAssetIds: string[];
}

interface UseNFTBackingResult {
  backingMap: Map<string, CombinedBacking>;
  isLoading: boolean;
  error: string | null;
  getBackingForAsset: (assetId: string) => CombinedBacking | undefined;
  hasAnyBacking: (assetId: string) => boolean;
  getBackingDisplay: (assetId: string) => string[];
  calculateTotalsForSelection: (assetIds: string[]) => BackingTotals;
  formatTotalsList: (totals: BackingTotals) => { native: string[]; waxdao: string[] };
  refetch: () => void;
}

/**
 * Hook to fetch and manage backing information for NFTs
 * Fetches from both AtomicAssets native and WaxDAO backer
 */
export function useNFTBacking(nfts: NFTWithCollection[]): UseNFTBackingResult {
  const [backingMap, setBackingMap] = useState<Map<string, CombinedBacking>>(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  const nftsRef = useRef<NFTWithCollection[]>([]);

  // Store nfts in ref to access in callback without dependency
  nftsRef.current = nfts;

  // Create stable key from NFT asset IDs to detect actual content changes
  const nftKey = nfts.length > 0 
    ? nfts.map(n => `${n.asset_id}:${n.collection}`).sort().join(',')
    : '';

  // Fetch backing when NFTs change - use stable key for dependency
  useEffect(() => {
    const currentNfts = nftsRef.current;
    if (currentNfts.length === 0) return;

    // Filter out already fetched
    const unfetched = currentNfts.filter(
      nft => !fetchedRef.current.has(nft.asset_id)
    );

    if (unfetched.length === 0) return;

    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    fetchMultipleCombinedBackings(unfetched)
      .then(results => {
        // Mark as fetched
        unfetched.forEach(nft => fetchedRef.current.add(nft.asset_id));
        
        // Merge with existing
        setBackingMap(prev => {
          const next = new Map(prev);
          results.forEach((value, key) => next.set(key, value));
          return next;
        });
      })
      .catch((err: any) => {
        console.error('Failed to fetch NFT backing:', err);
        setError(err.message || 'Failed to fetch backing info');
      })
      .finally(() => {
        setIsLoading(false);
        isFetchingRef.current = false;
      });
  }, [nftKey]);

  const getBackingForAsset = useCallback(
    (assetId: string) => backingMap.get(assetId),
    [backingMap]
  );

  const hasAnyBacking = useCallback(
    (assetId: string) => {
      const backing = backingMap.get(assetId);
      if (!backing) return false;
      return backing.native.length > 0 || backing.waxdao.length > 0;
    },
    [backingMap]
  );

  const getBackingDisplay = useCallback(
    (assetId: string): string[] => {
      const backing = backingMap.get(assetId);
      if (!backing) return [];
      
      const lines: string[] = [];
      
      for (const token of backing.native) {
        lines.push(`${token.quantity} (Native)`);
      }
      
      for (const token of backing.waxdao) {
        lines.push(`${token.quantity} (WaxDAO)`);
      }
      
      return lines;
    },
    [backingMap]
  );

  const calculateTotalsForSelection = useCallback(
    (assetIds: string[]): BackingTotals => {
      return calculateCombinedBackingTotals(backingMap, assetIds);
    },
    [backingMap]
  );

  const formatTotalsList = useCallback(
    (totals: BackingTotals): { native: string[]; waxdao: string[] } => {
      const native: string[] = [];
      const waxdao: string[] = [];
      
      totals.native.forEach((data, symbol) => {
        native.push(formatTokenAmount(data.amount, data.precision, symbol));
      });
      
      totals.waxdao.forEach((data, symbol) => {
        waxdao.push(formatTokenAmount(data.amount, data.precision, symbol));
      });
      
      return { native, waxdao };
    },
    []
  );

  const refetch = useCallback(() => {
    fetchedRef.current.clear();
    isFetchingRef.current = false;
    setBackingMap(new Map());
  }, []);

  return {
    backingMap,
    isLoading,
    error,
    getBackingForAsset,
    hasAnyBacking,
    getBackingDisplay,
    calculateTotalsForSelection,
    formatTotalsList,
    refetch,
  };
}
