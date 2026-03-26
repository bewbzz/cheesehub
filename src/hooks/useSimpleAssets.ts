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
  idata: Record<string, unknown>;
  mdata: Record<string, unknown>;
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

      const parsed: SimpleAsset[] = allRows.map((row) => {
        const idata = parseJsonSafe(row.idata);
        const mdata = parseJsonSafe(row.mdata);
        const combined = { ...idata, ...mdata };
        const name = (combined.name as string) || `Asset #${row.id}`;
        const image = resolveImage(combined);

        return {
          id: row.id,
          owner: row.owner,
          author: row.author,
          category: row.category,
          name,
          image,
          idata,
          mdata,
        };
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
