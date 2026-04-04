import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';

export interface GpkPack {
  symbol: string;
  amount: number;
  precision: number;
  label: string;
}

const GPK_LABELS: Record<string, string> = {
  GPKFIVE: 'GPK Series 1 Pack',
  GPKMEGA: 'GPK Mega Pack',
  GPKTWOA: 'GPK Series 2A Pack',
  GPKTWOB: 'GPK Series 2B Pack',
  GPKTWOC: 'GPK Series 2C Pack',
};

/** Symbols that should always appear in the pack list (even with 0 count) */
const ALWAYS_VISIBLE: string[] = ['GPKFIVE', 'GPKMEGA', 'GPKTWOA', 'GPKTWOB', 'GPKTWOC'];

export function useGpkPacks(accountName: string | null) {
  const [packs, setPacks] = useState<GpkPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    if (!accountName) { setPacks([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTableRows<{ balance: string }>({
        code: 'packs.topps',
        scope: accountName,
        table: 'accounts',
        limit: 100,
      });

      const parsed: GpkPack[] = res.rows
        .map((row) => {
          const parts = row.balance.split(' ');
          const amount = parseFloat(parts[0]) || 0;
          const symbol = parts[1] || '';
          const precision = parts[0].includes('.') ? parts[0].split('.')[1].length : 0;
          return { symbol, amount, precision, label: GPK_LABELS[symbol] || symbol };
        })
        .filter((p) => p.amount > 0 && GPK_LABELS[p.symbol]);

      setPacks(parsed);
    } catch (e) {
      console.warn('[GPK Packs] Fetch failed:', e);
      setError((e as Error).message);
      setPacks([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);

  return { packs, isLoading, error, refetch: fetchPacks };
}
