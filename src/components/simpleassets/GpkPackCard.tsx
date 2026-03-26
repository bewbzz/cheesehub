import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GpkPack } from '@/hooks/useGpkPacks';

interface GpkPackCardProps {
  pack: GpkPack;
}

export function GpkPackCard({ pack }: GpkPackCardProps) {
  return (
    <Card className="bg-card border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
        <span className="text-3xl">📦</span>
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
