import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { ATOMIC_API } from '@/lib/waxConfig';
import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface UserNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
  mint: string;
}

interface CachedNFTData {
  nfts: UserNFT[];
  timestamp: number;
  assetIds: string[];
}

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const CACHE_KEY_PREFIX = 'cheesehub_nfts_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img || '/placeholder.svg';
}

// Get cached NFT data from localStorage
function getCachedNFTs(owner: string): CachedNFTData | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${owner}`);
    if (!cached) return null;
    
    const data: CachedNFTData = JSON.parse(cached);
    // Check if cache is still valid
    if (Date.now() - data.timestamp < CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// Save NFT data to cache
function setCachedNFTs(owner: string, nfts: UserNFT[], assetIds: string[]): void {
  try {
    const data: CachedNFTData = {
      nfts,
      timestamp: Date.now(),
      assetIds,
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${owner}`, JSON.stringify(data));
  } catch {
    // Storage full or unavailable, ignore
  }
}

// Fetch asset IDs directly from blockchain with parallel pagination
async function getOwnedAssetIds(owner: string): Promise<Set<string>> {
  const ownedAssets = new Set<string>();
  
  try {
    // First fetch to get initial batch and estimate total
    const firstBatch = await waxRpcCall<{
      rows: Array<{ asset_id: string }>;
      more: boolean;
      next_key: string;
    }>('/v1/chain/get_table_rows', {
      json: true,
      code: 'atomicassets',
      scope: owner,
      table: 'assets',
      limit: 1000,
    });
    
    if (firstBatch.rows) {
      for (const asset of firstBatch.rows) {
        ownedAssets.add(String(asset.asset_id));
      }
    }
    
    // If there's more, continue fetching
    let more = firstBatch.more;
    let lowerBound = firstBatch.next_key || '';
    
    while (more) {
      const data = await waxRpcCall<{
        rows: Array<{ asset_id: string }>;
        more: boolean;
        next_key: string;
      }>('/v1/chain/get_table_rows', {
        json: true,
        code: 'atomicassets',
        scope: owner,
        table: 'assets',
        limit: 1000,
        lower_bound: lowerBound,
      });
      
      if (data.rows) {
        for (const asset of data.rows) {
          ownedAssets.add(String(asset.asset_id));
        }
      }
      
      more = data.more;
      lowerBound = data.next_key || '';
    }
  } catch (error) {
    console.error('Error fetching owned assets from blockchain:', error);
  }
  
  return ownedAssets;
}

// Fetch a single page of API metadata
async function fetchApiPage(owner: string, page: number, limit: number): Promise<{
  assets: UserNFT[];
  hasMore: boolean;
}> {
  const params = new URLSearchParams({
    owner,
    limit: String(limit),
    page: String(page),
    order: 'desc',
    sort: 'asset_id',
  });

  const cacheBuster = `&_ts=${Date.now()}`;
  const path = `${ATOMIC_API.paths.assets}?${params.toString()}${cacheBuster}`;
  
  try {
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
    const json = await response.json();

    if (!json.success || !json.data) {
      return { assets: [], hasMore: false };
    }

    const assets = json.data as Array<{
      asset_id: string;
      name: string;
      template_mint: string;
      collection: { collection_name: string };
      schema: { schema_name: string };
      template?: { template_id: string };
      data?: { img?: string; image?: string; name?: string };
      immutable_data?: { img?: string; image?: string; name?: string };
    }>;

    const mappedAssets = assets.map((asset) => {
      const data = { ...asset.immutable_data, ...asset.data };
      return {
        asset_id: asset.asset_id,
        name: data.name || asset.name || `NFT #${asset.asset_id}`,
        image: getImageUrl(data.img || data.image),
        collection: asset.collection.collection_name,
        schema: asset.schema.schema_name,
        template_id: asset.template?.template_id || '',
        mint: asset.template_mint || '1',
      };
    });

    return {
      assets: mappedAssets,
      hasMore: assets.length >= limit,
    };
  } catch (err) {
    console.error('Error fetching page', page, err);
    return { assets: [], hasMore: false };
  }
}

// Fetch metadata for specific asset IDs in parallel batches
async function fetchAssetMetadata(assetIds: string[]): Promise<UserNFT[]> {
  if (assetIds.length === 0) return [];
  
  const batchSize = 50;
  const batches: string[][] = [];
  
  for (let i = 0; i < assetIds.length; i += batchSize) {
    batches.push(assetIds.slice(i, i + batchSize));
  }
  
  // Process batches in parallel groups of 3
  const parallelLimit = 3;
  const results: UserNFT[] = [];
  
  for (let i = 0; i < batches.length; i += parallelLimit) {
    const parallelBatches = batches.slice(i, i + parallelLimit);
    
    const batchResults = await Promise.all(
      parallelBatches.map(async (batch) => {
        const idsParam = batch.join(',');
        
        try {
          const cacheBuster = `&_ts=${Date.now()}`;
          const path = `${ATOMIC_API.paths.assets}?ids=${idsParam}${cacheBuster}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();
          
          if (json.success && json.data) {
            const assets = json.data as Array<{
              asset_id: string;
              name: string;
              template_mint: string;
              collection: { collection_name: string };
              schema: { schema_name: string };
              template?: { template_id: string };
              data?: { img?: string; image?: string; name?: string };
              immutable_data?: { img?: string; image?: string; name?: string };
            }>;
            
            return assets.map((asset) => {
              const data = { ...asset.immutable_data, ...asset.data };
              return {
                asset_id: asset.asset_id,
                name: data.name || asset.name || `NFT #${asset.asset_id}`,
                image: getImageUrl(data.img || data.image),
                collection: asset.collection.collection_name,
                schema: asset.schema.schema_name,
                template_id: asset.template?.template_id || '',
                mint: asset.template_mint || '1',
              };
            });
          }
        } catch (error) {
          console.error('Error fetching asset metadata for batch:', error);
        }
        return [];
      })
    );
    
    results.push(...batchResults.flat());
  }
  
  return results;
}

export function useUserNFTs(accountName: string | null) {
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const fetchNFTs = useCallback(async (skipCache = false) => {
    if (!accountName) {
      setNfts([]);
      return;
    }

    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setLoadingProgress(null);

    try {
      // Phase 1: Check cache first for instant display
      if (!skipCache) {
        const cached = getCachedNFTs(accountName);
        if (cached && cached.nfts.length > 0) {
          console.log(`[useUserNFTs] Using cached data: ${cached.nfts.length} NFTs`);
          setNfts(cached.nfts);
          // Continue in background to verify and update
        }
      }

      // Phase 2: Parallel fetch - on-chain IDs and first API pages simultaneously
      const [ownedAssetIds, firstPages] = await Promise.all([
        getOwnedAssetIds(accountName),
        // Fetch first 5 pages in parallel
        Promise.all([
          fetchApiPage(accountName, 1, 100),
          fetchApiPage(accountName, 2, 100),
          fetchApiPage(accountName, 3, 100),
          fetchApiPage(accountName, 4, 100),
          fetchApiPage(accountName, 5, 100),
        ]),
      ]);

      if (abortRef.current) return;

      console.log(`[useUserNFTs] On-chain found ${ownedAssetIds.size} assets for ${accountName}`);
      
      if (ownedAssetIds.size === 0) {
        setNfts([]);
        setIsLoading(false);
        setCachedNFTs(accountName, [], []);
        return;
      }

      setLoadingProgress({ loaded: 0, total: ownedAssetIds.size });

      // Collect NFTs from first pages (filter by on-chain ownership)
      const fetchedAssetIds = new Set<string>();
      const allNfts: UserNFT[] = [];

      for (const pageResult of firstPages) {
        for (const nft of pageResult.assets) {
          if (ownedAssetIds.has(nft.asset_id) && !fetchedAssetIds.has(nft.asset_id)) {
            fetchedAssetIds.add(nft.asset_id);
            allNfts.push(nft);
          }
        }
      }

      // Progressive update - show what we have so far
      if (allNfts.length > 0) {
        allNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
        setNfts([...allNfts]);
        setLoadingProgress({ loaded: allNfts.length, total: ownedAssetIds.size });
      }

      if (abortRef.current) return;

      // Phase 3: Continue fetching remaining pages if needed
      const lastPageHadMore = firstPages[firstPages.length - 1].hasMore;
      if (lastPageHadMore && fetchedAssetIds.size < ownedAssetIds.size) {
        let page = 6;
        const maxPage = 100;
        
        // Fetch in parallel batches of 5 pages
        while (page <= maxPage && fetchedAssetIds.size < ownedAssetIds.size) {
          const pagePromises = [];
          for (let i = 0; i < 5 && page + i <= maxPage; i++) {
            pagePromises.push(fetchApiPage(accountName, page + i, 100));
          }
          
          const results = await Promise.all(pagePromises);
          
          if (abortRef.current) return;
          
          let foundAny = false;
          for (const result of results) {
            for (const nft of result.assets) {
              if (ownedAssetIds.has(nft.asset_id) && !fetchedAssetIds.has(nft.asset_id)) {
                fetchedAssetIds.add(nft.asset_id);
                allNfts.push(nft);
                foundAny = true;
              }
            }
            if (!result.hasMore) break;
          }
          
          // Progressive update
          if (foundAny) {
            allNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
            setNfts([...allNfts]);
            setLoadingProgress({ loaded: allNfts.length, total: ownedAssetIds.size });
          }
          
          // Check if all pages returned empty or no more
          if (results.every(r => !r.hasMore || r.assets.length === 0)) break;
          
          page += 5;
        }
      }

      if (abortRef.current) return;

      // Phase 4: Fetch any missing assets by ID (parallel batches)
      const missingAssetIds = Array.from(ownedAssetIds).filter(id => !fetchedAssetIds.has(id));
      
      if (missingAssetIds.length > 0) {
        console.log(`[useUserNFTs] Fetching ${missingAssetIds.length} missing assets by ID`);
        const missingAssets = await fetchAssetMetadata(missingAssetIds);
        
        if (abortRef.current) return;
        
        const fetchedMissingIds = new Set(missingAssets.map(a => a.asset_id));
        allNfts.push(...missingAssets);
        
        // Create placeholders for any still missing (not indexed yet)
        const stillMissing = missingAssetIds.filter(id => !fetchedMissingIds.has(id));
        if (stillMissing.length > 0) {
          console.log(`[useUserNFTs] Creating placeholders for ${stillMissing.length} unindexed assets`);
          for (const assetId of stillMissing) {
            allNfts.push({
              asset_id: assetId,
              name: `NFT #${assetId}`,
              image: '/placeholder.svg',
              collection: 'Unknown (syncing...)',
              schema: '',
              template_id: '',
              mint: '?',
            });
          }
        }
      }

      console.log(`[useUserNFTs] Final NFT count: ${allNfts.length} (on-chain: ${ownedAssetIds.size})`);
      
      // Final sort and update
      allNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
      setNfts(allNfts);
      setLoadingProgress({ loaded: allNfts.length, total: ownedAssetIds.size });
      
      // Cache the results
      setCachedNFTs(accountName, allNfts, Array.from(ownedAssetIds));
      
    } catch (err) {
      console.error('Failed to fetch user NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
    } finally {
      setIsLoading(false);
      setLoadingProgress(null);
    }
  }, [accountName]);

  // Cleanup on unmount or account change
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, [accountName]);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  // Extract unique collections for filtering
  const collections = useMemo(() => {
    const collectionMap = new Map<string, number>();
    nfts.forEach((nft) => {
      collectionMap.set(nft.collection, (collectionMap.get(nft.collection) || 0) + 1);
    });
    return Array.from(collectionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nfts]);

  const refetch = useCallback(() => {
    return fetchNFTs(true); // Skip cache on manual refetch
  }, [fetchNFTs]);

  return {
    nfts,
    isLoading,
    loadingProgress,
    error,
    refetch,
    collections,
  };
}
