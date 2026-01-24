import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWax } from '@/context/WaxContext';

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
  coverArt: string;
  backCover?: string;
  duration?: number;
  collection: string;
  schema: string;
  template_id: string;
  mint: string;
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

const CACHE_KEY_PREFIX = 'cheesehub_music_nfts_';
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

function isMusicNFT(data: Record<string, any>): boolean {
  // Check for audio field (primary indicator - cXc.world standard)
  if (data.audio) return true;
  // Check for clip field (preview audio)
  if (data.clip) return true;
  // Check for video with music metadata (music videos)
  if (data.video && (data.artist || data.title || data.album)) return true;
  return false;
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

export function useMusicNFTs() {
  const { accountName } = useWax();
  const [nfts, setNfts] = useState<MusicNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchMusicNFTs = useCallback(async (skipCache = false) => {
    if (!accountName || fetchingRef.current) return;
    
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!skipCache) {
        const cached = getCachedMusicNFTs(accountName);
        if (cached) {
          setNfts(cached.nfts);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Fetch from AtomicAssets API
      const allMusicNfts: MusicNFT[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://wax.api.atomicassets.io/atomicassets/v1/assets?owner=${accountName}&page=${page}&limit=${limit}&order=desc&sort=asset_id`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch NFTs');
        }

        const data = await response.json();
        const assets = data.data || [];

        if (assets.length === 0) {
          hasMore = false;
          break;
        }

        // Filter for music NFTs
        for (const asset of assets) {
          const immutableData = asset.immutable_data || {};
          const mutableData = asset.mutable_data || {};
          const templateData = asset.template?.immutable_data || {};
          
          // Merge all data sources
          const allData = { ...templateData, ...immutableData, ...mutableData };

          if (isMusicNFT(allData)) {
            const musicNft: MusicNFT = {
              asset_id: asset.asset_id,
              name: asset.name || allData.name || 'Untitled Track',
              title: allData.title,
              artist: allData.artist,
              album: allData.album,
              genre: allData.genre,
              audioUrl: getMediaUrl(allData.audio || allData.clip),
              clipUrl: allData.clip ? getMediaUrl(allData.clip) : undefined,
              videoUrl: allData.video ? getMediaUrl(allData.video) : undefined,
              coverArt: getMediaUrl(allData.img || allData.image),
              backCover: allData.backimg ? getMediaUrl(allData.backimg) : undefined,
              duration: allData.duration ? parseInt(allData.duration) : undefined,
              collection: asset.collection?.collection_name || '',
              schema: asset.schema?.schema_name || '',
              template_id: asset.template?.template_id || '',
              mint: asset.template_mint || '',
            };
            allMusicNfts.push(musicNft);
          }
        }

        if (assets.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      }

      setNfts(allMusicNfts);
      setCachedMusicNFTs(
        accountName,
        allMusicNfts,
        allMusicNfts.map(n => n.asset_id)
      );
    } catch (err) {
      console.error('Failed to fetch music NFTs:', err);
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

  const refetch = useCallback(() => {
    fetchMusicNFTs(true);
  }, [fetchMusicNFTs]);

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
    isLoading,
    error,
    refetch,
    collections,
    artists,
    totalTracks: nfts.length,
  };
}
