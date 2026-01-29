import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWax } from '@/context/WaxContext';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { ATOMIC_API } from '@/lib/waxConfig';
import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface MusicNFT {
  asset_id: string;
  name: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  audioUrl: string;
  clipUrl?: string;
  videoUrl?: string;
  hasVideo: boolean;
  coverArt: string;
  backCover?: string;
  duration?: number;
  collection: string;
  schema: string;
  template_id: string;
  mint: string;
}

export interface StackedMusicNFT extends MusicNFT {
  copies: number;
  allAssetIds: string[];
}

function stackMusicNFTs(nfts: MusicNFT[]): StackedMusicNFT[] {
  const templateMap = new Map<string, MusicNFT[]>();
  
  // Group by template_id (same template = same song)
  for (const nft of nfts) {
    // Use template + audioUrl as key to prevent stacking tracks with different audio content
    // This ensures a sample and full track (same template, different audio) are shown separately
    const audioIdentifier = nft.audioUrl ? nft.audioUrl.slice(-32) : ''; // Last 32 chars of IPFS hash
    const key = (nft.template_id || nft.asset_id) + '_' + audioIdentifier;
    const existing = templateMap.get(key) || [];
    existing.push(nft);
    templateMap.set(key, existing);
  }
  
  // Convert to stacked NFTs (use first copy as the representative, sorted by lowest mint)
  return Array.from(templateMap.values()).map(copies => {
    // Sort by mint number to get the lowest mint as representative
    copies.sort((a, b) => {
      const mintA = parseInt(a.mint) || Infinity;
      const mintB = parseInt(b.mint) || Infinity;
      return mintA - mintB;
    });
    
    return {
      ...copies[0],
      copies: copies.length,
      allAssetIds: copies.map(c => c.asset_id),
    };
  });
}

interface CachedMusicData {
  nfts: MusicNFT[];
  timestamp: number;
  assetIds: string[];
}

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

const CACHE_KEY_PREFIX = 'cheesehub_music_nfts_v2_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function extractIpfsHash(url: string | undefined): string | null {
  if (!url) return null;
  
  // Direct IPFS hash (Qm... or bafy...)
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return url;
  }
  
  // IPFS URL formats
  const patterns = [
    /ipfs:\/\/(.+)/,
    /\/ipfs\/(.+)/,
    /gateway\.pinata\.cloud\/ipfs\/(.+)/,
    /ipfs\.io\/ipfs\/(.+)/,
    /cloudflare-ipfs\.com\/ipfs\/(.+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function getMediaUrl(field: string | undefined): string {
  if (!field) return '';
  
  // Already a full URL
  if (field.startsWith('http://') || field.startsWith('https://')) {
    return field;
  }
  
  // IPFS hash or URL
  const hash = extractIpfsHash(field);
  if (hash) {
    return `${IPFS_GATEWAYS[0]}${hash}`;
  }
  
  return field;
}

function isMusicNFT(data: Record<string, unknown>): boolean {
  // Check for audio field (primary indicator - cXc.world standard)
  if (data.audio) return true;
  // Check for clip field (preview audio)
  if (data.clip) return true;
  // Check for video with music metadata (music videos)
  if (data.video && (data.artist || data.title || data.album)) return true;
  return false;
}

// Helper to create MusicNFT entries from asset data - creates multiple entries if both audio and clip exist
function createMusicNFTsFromAsset(asset: { asset_id: string; name?: string; collection?: { collection_name?: string }; schema?: { schema_name?: string }; template?: { template_id?: string; immutable_data?: Record<string, unknown> }; template_mint?: string }, allData: Record<string, unknown>): MusicNFT[] {
  const results: MusicNFT[] = [];
  const videoUrl = allData.video ? getMediaUrl(allData.video as string) : undefined;
  const clipUrl = allData.clip ? getMediaUrl(allData.clip as string) : undefined;
  const fullAudioUrl = allData.audio ? getMediaUrl(allData.audio as string) : undefined;
  
  const baseNFT = {
    name: asset.name || (allData.name as string) || 'Untitled Track',
    title: allData.title as string | undefined,
    artist: allData.artist as string | undefined,
    album: allData.album as string | undefined,
    genre: allData.genre as string | undefined,
    coverArt: getMediaUrl((allData.img || allData.image) as string | undefined),
    backCover: allData.backimg ? getMediaUrl(allData.backimg as string) : undefined,
    duration: allData.duration ? parseInt(String(allData.duration)) : undefined,
    collection: asset.collection?.collection_name || '',
    schema: asset.schema?.schema_name || '',
    template_id: asset.template?.template_id || '',
    mint: asset.template_mint || '',
  };

  // Add full track entry if audio field exists
  if (fullAudioUrl) {
    results.push({
      ...baseNFT,
      asset_id: asset.asset_id,
      audioUrl: fullAudioUrl,
      clipUrl,
      videoUrl,
      hasVideo: !!videoUrl,
    });
  }

  // Add clip entry - only label as "Sample" if BOTH audio and clip exist
  if (clipUrl && clipUrl !== fullAudioUrl) {
    // Only mark as sample if there's ALSO a full audio track
    const isSample = !!fullAudioUrl;
    results.push({
      ...baseNFT,
      asset_id: isSample ? `${asset.asset_id}-clip` : asset.asset_id,
      audioUrl: clipUrl,
      clipUrl: undefined, // This IS the clip
      videoUrl: isSample ? undefined : videoUrl,
      hasVideo: isSample ? false : !!videoUrl,
      name: isSample ? `${baseNFT.name} (Sample)` : baseNFT.name,
    });
  }

  // Fallback: if no audio and no clip, try video with music metadata
  if (results.length === 0 && videoUrl && (allData.artist || allData.title)) {
    results.push({
      ...baseNFT,
      asset_id: asset.asset_id,
      audioUrl: videoUrl,
      clipUrl,
      videoUrl,
      hasVideo: true,
    });
  }

  return results;
}

function getCachedMusicNFTs(owner: string): CachedMusicData | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${owner}`);
    if (!cached) return null;
    
    const data: CachedMusicData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${owner}`);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

function setCachedMusicNFTs(owner: string, nfts: MusicNFT[], assetIds: string[]): void {
  try {
    const data: CachedMusicData = {
      nfts,
      timestamp: Date.now(),
      assetIds,
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}${owner}`, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

interface OnChainAsset {
  asset_id: string;
  collection_name: string;
  schema_name: string;
  template_id: number;
}

// Fetch asset data directly from blockchain
async function getOwnedAssets(owner: string): Promise<Map<string, OnChainAsset>> {
  const ownedAssets = new Map<string, OnChainAsset>();
  
  try {
    const firstBatch = await waxRpcCall<{
      rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
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
        ownedAssets.set(String(asset.asset_id), {
          asset_id: String(asset.asset_id),
          collection_name: asset.collection_name,
          schema_name: asset.schema_name,
          template_id: asset.template_id,
        });
      }
    }
    
    let more = firstBatch.more;
    let lowerBound = firstBatch.next_key || '';
    
    while (more) {
      const data = await waxRpcCall<{
        rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
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
          ownedAssets.set(String(asset.asset_id), {
            asset_id: String(asset.asset_id),
            collection_name: asset.collection_name,
            schema_name: asset.schema_name,
            template_id: asset.template_id,
          });
        }
      }
      
      more = data.more;
      lowerBound = data.next_key || '';
    }
  } catch (error) {
    console.error('[useMusicNFTs] Error fetching owned assets from blockchain:', error);
  }
  
  return ownedAssets;
}

// Fetch metadata for specific asset IDs in parallel batches with faster timeouts
async function fetchAssetMetadata(assetIds: string[]): Promise<MusicNFT[]> {
  if (assetIds.length === 0) return [];
  
  const batchSize = 50;
  const batches: string[][] = [];
  
  for (let i = 0; i < assetIds.length; i += batchSize) {
    batches.push(assetIds.slice(i, i + batchSize));
  }
  
  // Increased parallelism for faster loading
  const parallelLimit = 5;
  const results: MusicNFT[] = [];
  
  for (let i = 0; i < batches.length; i += parallelLimit) {
    const parallelBatches = batches.slice(i, i + parallelLimit);
    
    const batchResults = await Promise.all(
      parallelBatches.map(async (batch) => {
        const idsParam = batch.join(',');
        
        try {
          const cacheBuster = `&_ts=${Date.now()}`;
          const path = `${ATOMIC_API.paths.assets}?ids=${idsParam}${cacheBuster}`;
          // Use faster 5s timeout for quicker failover
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 5000);
          const json = await response.json();
          
          if (json.success && json.data) {
            const musicNfts: MusicNFT[] = [];
            
            for (const asset of json.data) {
              const immutableData = asset.immutable_data || {};
              const mutableData = asset.mutable_data || {};
              const templateData = asset.template?.immutable_data || {};
              const allData = { ...templateData, ...immutableData, ...mutableData };
              
              if (isMusicNFT(allData)) {
                musicNfts.push(...createMusicNFTsFromAsset(asset, allData));
              }
            }
            
            return musicNfts;
          }
        } catch (error) {
          console.error('[useMusicNFTs] Error fetching asset metadata for batch:', error);
        }
        return [];
      })
    );
    
    results.push(...batchResults.flat());
  }
  
  return results;
}

// Fetch a single page of API metadata and filter for music NFTs
async function fetchApiPage(owner: string, page: number, limit: number): Promise<{
  musicNfts: MusicNFT[];
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
    // Use faster 5s timeout for quicker failover
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 5000);
    const json = await response.json();

    if (!json.success || !json.data) {
      return { musicNfts: [], hasMore: false };
    }

    const musicNfts: MusicNFT[] = [];
    
    for (const asset of json.data) {
      const immutableData = asset.immutable_data || {};
      const mutableData = asset.mutable_data || {};
      const templateData = asset.template?.immutable_data || {};
      const allData = { ...templateData, ...immutableData, ...mutableData };
      
      if (isMusicNFT(allData)) {
        musicNfts.push(...createMusicNFTsFromAsset(asset, allData));
      }
    }

    return {
      musicNfts,
      hasMore: json.data.length >= limit,
    };
  } catch (err) {
    console.error('[useMusicNFTs] Error fetching page', page, err);
    return { musicNfts: [], hasMore: false };
  }
}

export function useMusicNFTs() {
  const { accountName } = useWax();
  const [nfts, setNfts] = useState<MusicNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const abortRef = useRef(false);

  const fetchMusicNFTs = useCallback(async (skipCache = false) => {
    if (!accountName || fetchingRef.current) return;
    
    fetchingRef.current = true;
    abortRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!skipCache) {
        const cached = getCachedMusicNFTs(accountName);
        if (cached) {
          console.log(`[useMusicNFTs] Using cached data: ${cached.nfts.length} music NFTs`);
          setNfts(cached.nfts);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Phase 1: Parallel fetch - on-chain assets and first API pages
      const [ownedAssetsMap, firstPages] = await Promise.all([
        getOwnedAssets(accountName),
        Promise.all([
          fetchApiPage(accountName, 1, 100),
          fetchApiPage(accountName, 2, 100),
          fetchApiPage(accountName, 3, 100),
          fetchApiPage(accountName, 4, 100),
          fetchApiPage(accountName, 5, 100),
        ]),
      ]);

      if (abortRef.current) return;

      const ownedAssetIds = new Set(ownedAssetsMap.keys());
      console.log(`[useMusicNFTs] On-chain found ${ownedAssetIds.size} total assets for ${accountName}`);

      if (ownedAssetIds.size === 0) {
        setNfts([]);
        setIsLoading(false);
        setCachedMusicNFTs(accountName, [], []);
        fetchingRef.current = false;
        return;
      }

      // Collect music NFTs from first pages (filter by on-chain ownership)
      const fetchedAssetIds = new Set<string>();
      const allMusicNfts: MusicNFT[] = [];

      for (const pageResult of firstPages) {
        for (const nft of pageResult.musicNfts) {
          // Strip -clip suffix to check real asset ownership
          const realAssetId = nft.asset_id.replace(/-clip$/, '');
          if (ownedAssetIds.has(realAssetId) && !fetchedAssetIds.has(nft.asset_id)) {
            fetchedAssetIds.add(nft.asset_id);
            allMusicNfts.push(nft);
          }
        }
      }

      // Progressive update
      if (allMusicNfts.length > 0) {
        allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
        setNfts([...allMusicNfts]);
      }

      if (abortRef.current) return;

      // Phase 2: Continue fetching remaining pages if needed
      const lastPageHadMore = firstPages[firstPages.length - 1].hasMore;
      if (lastPageHadMore) {
        let page = 6;
        const maxPage = 50;
        
        while (page <= maxPage) {
          const pagePromises = [];
          for (let i = 0; i < 5 && page + i <= maxPage; i++) {
            pagePromises.push(fetchApiPage(accountName, page + i, 100));
          }
          
          const results = await Promise.all(pagePromises);
          
          if (abortRef.current) return;
          
          let foundAny = false;
          for (const result of results) {
            for (const nft of result.musicNfts) {
              // Strip -clip suffix to check real asset ownership
              const realAssetId = nft.asset_id.replace(/-clip$/, '');
              if (ownedAssetIds.has(realAssetId) && !fetchedAssetIds.has(nft.asset_id)) {
                fetchedAssetIds.add(nft.asset_id);
                allMusicNfts.push(nft);
                foundAny = true;
              }
            }
            if (!result.hasMore) break;
          }
          
          if (foundAny) {
            allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
            setNfts([...allMusicNfts]);
          }
          
          if (results.every(r => !r.hasMore || r.musicNfts.length === 0)) break;
          
          page += 5;
        }
      }

      if (abortRef.current) return;

      // Phase 3: For any assets we haven't checked yet, fetch by ID to find more music NFTs
      const uncheckedAssetIds = Array.from(ownedAssetIds).filter(id => !fetchedAssetIds.has(id));
      
      if (uncheckedAssetIds.length > 0 && uncheckedAssetIds.length <= 500) {
        console.log(`[useMusicNFTs] Checking ${uncheckedAssetIds.length} unchecked assets for music NFTs`);
        const additionalMusicNfts = await fetchAssetMetadata(uncheckedAssetIds);
        
        if (additionalMusicNfts.length > 0) {
          allMusicNfts.push(...additionalMusicNfts);
          allMusicNfts.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
          setNfts([...allMusicNfts]);
        }
      }

      console.log(`[useMusicNFTs] Found ${allMusicNfts.length} music NFTs`);
      setCachedMusicNFTs(
        accountName,
        allMusicNfts,
        allMusicNfts.map(n => n.asset_id)
      );
    } catch (err) {
      console.error('[useMusicNFTs] Failed to fetch music NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch music NFTs');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [accountName]);

  useEffect(() => {
    if (accountName) {
      fetchMusicNFTs();
    } else {
      setNfts([]);
    }
  }, [accountName, fetchMusicNFTs]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const refetch = useCallback(() => {
    fetchMusicNFTs(true);
  }, [fetchMusicNFTs]);

  const stackedNfts = useMemo(() => {
    return stackMusicNFTs(nfts);
  }, [nfts]);

  const collections = useMemo(() => {
    const collectionMap = new Map<string, number>();
    nfts.forEach(nft => {
      const count = collectionMap.get(nft.collection) || 0;
      collectionMap.set(nft.collection, count + 1);
    });
    return Array.from(collectionMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nfts]);

  const artists = useMemo(() => {
    const artistMap = new Map<string, number>();
    nfts.forEach(nft => {
      if (nft.artist) {
        const count = artistMap.get(nft.artist) || 0;
        artistMap.set(nft.artist, count + 1);
      }
    });
    return Array.from(artistMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nfts]);

  return {
    nfts,
    stackedNfts,
    isLoading,
    error,
    refetch,
    collections,
    artists,
    totalTracks: nfts.length,
  };
}
