import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';

export interface SimpleAsset {
  id: string;
  owner: string;
  author: string;
  category: string;
  name: string;
  image: string;
  cardid: string;
  quality: string;
  idata: Record<string, unknown>;
  mdata: Record<string, unknown>;
  container: unknown[];
  containerf: unknown[];
}

interface RawSAsset {
  id: string;
  owner: string;
  author: string;
  category: string;
  idata: string;
  mdata: string;
  container: unknown[];
  containerf: unknown[];
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) || {};
  } catch {
    return {};
  }
}

function resolveImage(data: Record<string, unknown>): string {
  const raw = (data.img || data.image || data.icon || '') as string;
  if (!raw) return '/placeholder.svg';

  // Already a full URL
  if (raw.startsWith('http')) return raw;

  // IPFS protocol
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);

  // Bare CID
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) {
    return getIpfsUrl(raw);
  }

  return raw || '/placeholder.svg';
}

export function useSimpleAssets(account: string | null) {
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!account) {
      setAssets([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allRows: RawSAsset[] = [];
      let lowerBound = '';
      let hasMore = true;

      while (hasMore) {
        const result = await fetchTableRows<RawSAsset>({
          code: 'simpleassets',
          scope: account,
          table: 'sassets',
          limit: 100,
          lower_bound: lowerBound || undefined,
        });

        allRows.push(...result.rows);
        hasMore = result.more;

        if (hasMore && result.rows.length > 0) {
          const lastId = result.rows[result.rows.length - 1].id;
          lowerBound = String(BigInt(lastId) + 1n);
        }
      }

      const parsed: SimpleAsset[] = allRows
        .filter((row) => row.author === 'gpk.topps')
        .map((row) => {
        const idata = parseJsonSafe(row.idata);
        const mdata = parseJsonSafe(row.mdata);
        const combined = { ...idata, ...mdata };
        const name = (combined.name as string) || `Asset #${row.id}`;
        const image = resolveImage(combined);
        const cardid = (combined.cardid as string) || '';
        const quality = (combined.quality as string) || '';

        return {
          id: row.id,
          owner: row.owner,
          author: row.author,
          category: row.category,
          name,
          image,
          cardid,
          quality,
          idata,
          mdata,
          container: row.container || [],
          containerf: row.containerf || [],
        };
      });

      parsed.sort((a, b) => {
        const numA = parseInt(a.cardid, 10);
        const numB = parseInt(b.cardid, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          if (numA !== numB) return numA - numB;
          return a.quality.localeCompare(b.quality);
        }
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return Number(BigInt(a.id) - BigInt(b.id));
      });
      setAssets(parsed);
    } catch (err) {
      console.error('[SimpleAssets] Failed to fetch:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return { assets, isLoading, error, refetch: fetchAssets };
}
