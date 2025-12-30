import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { ATOMIC_API, WAX_CHAIN } from '@/lib/waxConfig';
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

// Verify asset ownership directly from blockchain (real-time, no indexer delay)
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
      console.log(`[useUserNFTs] On-chain verification found ${ownedAssetIds.size} assets for ${accountName}`);
      
      if (ownedAssetIds.size === 0) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      // Step 2: Fetch metadata from AtomicAssets API with cache-busting
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

        // Step 3: Only include assets that are verified on-chain
        const mappedAssets = assets
          .filter((asset) => ownedAssetIds.has(asset.asset_id))
          .map((asset) => {
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
          if (page > 20) hasMore = false;
        }
      }

      console.log(`[useUserNFTs] Final verified NFT count: ${allNfts.length}`);
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
