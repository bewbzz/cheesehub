import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import type { GpkPack } from '@/hooks/useGpkPacks';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2.png';
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
  // GPKMEGA: 'thirty', // unverified — disabled for safety
  GPKTWOA: 'gpktwoeight',
  GPKTWOB: 'gpktwo25',
  GPKTWOC: 'gpktwo55',
};

interface GpkPackCardProps {
  pack: GpkPack;
  session: Session | null;
  onSuccess?: () => void;
}

export function GpkPackCard({ pack, session, onSuccess }: GpkPackCardProps) {
  const series2Img = SERIES_2_IMAGES[pack.symbol];
  const [isOpening, setIsOpening] = useState(false);
  const { executeTransaction } = useWaxTransaction(session);

  const handleOpen = async () => {
    if (!session) return;
    setIsOpening(true);
    try {
      const result = await executeTransaction(
        [
          {
            account: 'gpk.topps',
            name: 'unbox',
            authorization: [{ actor: String(session.actor), permission: String(session.permission) }],
            data: {
              from: String(session.actor),
              type: pack.symbol,
            },
          },
        ],
        {
          successTitle: 'Pack Opened!',
          successDescription: `Your ${pack.label} has been opened. New cards should appear shortly.`,
        }
      );
      if (result.success) {
        setTimeout(() => onSuccess?.(), 2000);
      }
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Card className="bg-card border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
        {series2Img ? (
          <img src={series2Img} alt={pack.label} className="w-20 h-auto rounded" />
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
          disabled={!session || isOpening}
          onClick={handleOpen}
        >
          {isOpening ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : 'Open Pack'}
        </Button>
      </CardContent>
    </Card>
  );
}
