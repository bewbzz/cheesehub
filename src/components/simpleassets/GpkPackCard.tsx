import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { PackRevealDialog } from './PackRevealDialog';
import { PackBrowserDialog } from './PackBrowserDialog';
import type { GpkPack } from '@/hooks/useGpkPacks';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2a.png';
import gpkSeries2bImg from '@/assets/gpk_pack_series_2b.png';
import gpkSeries2cImg from '@/assets/gpk_pack_series_2c.png';

const SERIES_2_IMAGES: Record<string, string> = {
  GPKTWOA: gpkSeries2aImg,
  GPKTWOB: gpkSeries2bImg,
  GPKTWOC: gpkSeries2cImg,
};

/** Verified on-chain unbox type names for each pack symbol */
const UNBOX_TYPE_MAP: Record<string, string> = {
  GPKFIVE: 'five',
  GPKTWOA: 'gpktwoeight',
  GPKTWOB: 'gpktwo25',
  GPKTWOC: 'gpktwo55',
};

interface GpkPackCardProps {
  pack: GpkPack;
  session: Session | null;
  accountName: string;
  onSuccess?: () => void;
}

async function snapshotAssetIds(owner: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const aaPath = `${ATOMIC_API.paths.assets}?owner=${owner}&collection_name=gpk.topps&order=desc&sort=asset_id&limit=200`;
    const aaResp = await fetchWithFallback(ATOMIC_API.baseUrls, aaPath);
    const aaJson = await aaResp.json();
    for (const a of aaJson?.data ?? []) ids.add(`aa-${a.asset_id}`);
  } catch { /* ignore */ }
  try {
    const saRows = await fetchTableRows<{ id: string; author: string }>({
      code: 'simpleassets',
      scope: owner,
      table: 'sassets',
      limit: 200,
    });
    for (const r of saRows.rows) {
      if (r.author === 'gpk.topps') ids.add(`sa-${r.id}`);
    }
  } catch { /* ignore */ }
  return ids;
}

export function GpkPackCard({ pack, session, accountName, onSuccess }: GpkPackCardProps) {
  const series2Img = SERIES_2_IMAGES[pack.symbol];
  const [isOpening, setIsOpening] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [preOpenIds, setPreOpenIds] = useState<Set<string>>(new Set());
  const [browserOpen, setBrowserOpen] = useState(false);
  const { executeTransaction } = useWaxTransaction(session);

  const unboxType = UNBOX_TYPE_MAP[pack.symbol];
  const hasMultiple = pack.amount > 1;

  const handleOpen = useCallback(async () => {
    if (!session || !unboxType) return;
    setIsOpening(true);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    const qty = pack.precision > 0
      ? `${(1).toFixed(pack.precision)} ${pack.symbol}`
      : `1 ${pack.symbol}`;

    try {
      // Snapshot current assets before opening
      const snapshot = await snapshotAssetIds(accountName);
      setPreOpenIds(snapshot);

      const result = await executeTransaction(
        [
          {
            account: 'packs.topps',
            name: 'transfer',
            authorization: auth,
            data: { from: actor, to: 'gpk.topps', quantity: qty, memo: '' },
          },
          {
            account: 'gpk.topps',
            name: 'unbox',
            authorization: auth,
            data: { from: actor, type: unboxType },
          },
        ],
        {
          successTitle: 'Pack Opened!',
          successDescription: `Your ${pack.label} has been opened. Revealing cards...`,
        }
      );
      if (result.success) {
        setRevealOpen(true);
      }
    } finally {
      setIsOpening(false);
    }
  }, [session, unboxType, pack, accountName, executeTransaction]);

  const handleRevealComplete = useCallback(() => {
    onSuccess?.();
  }, [onSuccess]);

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
          {series2Img ? (
            <img src={series2Img} alt={pack.label} className="w-3/4 h-auto rounded mx-auto" />
          ) : (
            <span className="text-3xl">📦</span>
          )}
          <p className="font-bold text-foreground text-sm">{pack.label}</p>
          <p className="text-xs text-muted-foreground">{pack.symbol}</p>
          <p className="text-lg font-mono text-primary">{pack.amount}</p>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={!session || isOpening || !unboxType}
            onClick={handleOpen}
          >
            {isOpening ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : 'Open Pack'}
          </Button>
        </CardContent>
      </Card>

      <PackRevealDialog
        open={revealOpen}
        onOpenChange={setRevealOpen}
        packSymbol={pack.symbol}
        packLabel={pack.label}
        packImage={series2Img}
        accountName={accountName}
        preOpenAssetIds={preOpenIds}
        onComplete={handleRevealComplete}
      />
    </>
  );
}
