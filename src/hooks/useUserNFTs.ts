import { useState, useEffect, useMemo, useCallback } from 'react';
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

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function getImageUrl(img: string | undefined): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img || '/placeholder.svg';
}

// Fetch asset IDs directly from blockchain (real-time, no indexer delay)
async function getOwnedAssetIds(owner: string): Promise<Set<string>> {
  const ownedAssets = new Set<string>();
  
  try {
    let more = true;
    let lowerBound = '';
    
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

// Fetch metadata for specific asset IDs that weren't returned by the bulk query
async function fetchAssetMetadata(assetIds: string[]): Promise<UserNFT[]> {
  if (assetIds.length === 0) return [];
  
  const results: UserNFT[] = [];
  
  // Batch requests in groups of 50 to avoid URL length limits
  const batchSize = 50;
  for (let i = 0; i < assetIds.length; i += batchSize) {
    const batch = assetIds.slice(i, i + batchSize);
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
        
        for (const asset of assets) {
          const data = { ...asset.immutable_data, ...asset.data };
          results.push({
            asset_id: asset.asset_id,
            name: data.name || asset.name || `NFT #${asset.asset_id}`,
            image: getImageUrl(data.img || data.image),
            collection: asset.collection.collection_name,
            schema: asset.schema.schema_name,
            template_id: asset.template?.template_id || '',
            mint: asset.template_mint || '1',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching asset metadata for batch:', error);
    }
  }
  
  return results;
}

export function useUserNFTs(accountName: string | null) {
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!accountName) {
      setNfts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get verified asset IDs directly from blockchain (real-time)
      const ownedAssetIds = await getOwnedAssetIds(accountName);
      console.log(`[useUserNFTs] On-chain found ${ownedAssetIds.size} assets for ${accountName}`);
      
      if (ownedAssetIds.size === 0) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      // Step 2: Fetch metadata from AtomicAssets API with pagination
      const fetchedAssetIds = new Set<string>();
      const allNfts: UserNFT[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          owner: accountName,
          limit: String(limit),
          page: String(page),
          order: 'desc',
          sort: 'asset_id',
        });

        // Add cache-busting timestamp
        const cacheBuster = `&_ts=${Date.now()}`;
        const path = `${ATOMIC_API.paths.assets}?${params.toString()}${cacheBuster}`;
        
        try {
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();

          if (!json.success || !json.data) {
            break;
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

          // Only include assets that are verified on-chain
          const mappedAssets = assets
            .filter((asset) => ownedAssetIds.has(asset.asset_id))
            .map((asset) => {
              fetchedAssetIds.add(asset.asset_id);
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

          allNfts.push(...mappedAssets);

          if (assets.length < limit) {
            hasMore = false;
          } else {
            page++;
            // Safety limit
            if (page > 50) hasMore = false;
          }
        } catch (err) {
          console.error('Error fetching page', page, err);
          break;
        }
      }

      // Step 3: Find any assets that are on-chain but weren't returned by the API
      const missingAssetIds = Array.from(ownedAssetIds).filter(id => !fetchedAssetIds.has(id));
      
      if (missingAssetIds.length > 0) {
        console.log(`[useUserNFTs] Fetching ${missingAssetIds.length} missing assets by ID:`, missingAssetIds);
        const missingAssets = await fetchAssetMetadata(missingAssetIds);
        
        // Track which IDs were successfully fetched
        const fetchedMissingIds = new Set(missingAssets.map(a => a.asset_id));
        allNfts.push(...missingAssets);
        
        // For any assets still missing (not indexed yet), create placeholder entries
        const stillMissing = missingAssetIds.filter(id => !fetchedMissingIds.has(id));
        if (stillMissing.length > 0) {
          console.log(`[useUserNFTs] Creating placeholders for ${stillMissing.length} unindexed assets:`, stillMissing);
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
      
      // Sort by asset_id descending (newest first)
      allNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
      
      setNfts(allNfts);
    } catch (err) {
      console.error('Failed to fetch user NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
      setNfts([]);
    } finally {
      setIsLoading(false);
    }
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

  return {
    nfts,
    isLoading,
    error,
    refetch: fetchNFTs,
    collections,
  };
}
