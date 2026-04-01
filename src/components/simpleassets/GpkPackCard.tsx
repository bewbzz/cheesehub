import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GpkPack } from '@/hooks/useGpkPacks';
import gpkSeries2aImg from '@/assets/gpk_pack_series_2.png';
import gpkSeries2bImg from '@/assets/gpk_pack_series_2b.png';
import gpkSeries2cImg from '@/assets/gpk_pack_series_2c.png';

const SERIES_2_IMAGES: Record<string, string> = {
  GPKTWOA: gpkSeries2aImg,
  GPKTWOB: gpkSeries2bImg,
  GPKTWOC: gpkSeries2cImg,
};

interface GpkPackCardProps {
  pack: GpkPack;
}

export function GpkPackCard({ pack }: GpkPackCardProps) {
  const isSeries2 = SERIES_2_SYMBOLS.has(pack.symbol);

  return (
    <Card className="bg-card border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
        {isSeries2 ? (
          <img src={gpkSeries2Img} alt={pack.label} className="w-20 h-auto rounded" />
        ) : (
          <span className="text-3xl">📦</span>
        )}
        <p className="font-bold text-foreground text-sm">{pack.label}</p>
        <p className="text-xs text-muted-foreground">{pack.symbol}</p>
        <p className="text-lg font-mono text-primary">{pack.amount}</p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" disabled className="w-full text-xs opacity-50">
                Open Pack
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming soon — verifying unbox contract status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
