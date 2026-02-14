import { RefreshCw, Clock, CheckCircle, Gift, TrendingUp, Droplet } from 'lucide-react';
import { useCheeseNullData } from '@/hooks/useCheeseNullData';
import { formatWaxAmount, formatCheeseAmount, formatCountdown } from '@/lib/cheeseNullApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface NullStatsProps {
  onCanClaimChange?: (canClaim: boolean) => void;
}

export function NullStats({ onCanClaimChange }: NullStatsProps) {
  const {
    cheeseBurnAmount,
    cheeseRewardAmount,
    cheeseLiquidityAmount,
    waxStakeAmount,
    canClaim,
    timeUntilNextClaim,
    isLoading,
    isError,
    refetch,
  } = useCheeseNullData();

  if (onCanClaimChange) {
    onCanClaimChange(canClaim);
  }

  return (
    <Card className="w-full max-w-md bg-card/50 border-border/50">
      <CardContent className="p-6 space-y-6">
        {/* Estimated CHEESE Burn */}
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Current Estimated $CHEESE Null
            </h3>
            {isLoading ? (
              <Skeleton className="h-10 w-56 mx-auto bg-muted" />
            ) : isError ? (
              <p className="text-destructive text-sm">Error loading data</p>
            ) : (
              <p className="text-3xl font-bold text-cheese">
                {formatCheeseAmount(cheeseBurnAmount)} <span className="text-lg text-muted-foreground">CHEESE</span>
              </p>
            )}
          </div>

          {/* Distribution Breakdown */}
          {!isLoading && !isError && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <Gift className="w-3 h-3" />
                  <span className="text-xs font-medium">Your Reward</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatCheeseAmount(cheeseRewardAmount)}</p>
                <p className="text-xs text-muted-foreground">CHEESE</p>
              </div>
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <Droplet className="w-3 h-3" />
                  <span className="text-xs font-medium">xCHEESE</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatCheeseAmount(cheeseLiquidityAmount)}</p>
                <p className="text-xs text-muted-foreground">CHEESE</p>
              </div>
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-medium">Compound</span>
                </div>
                <p className="text-sm font-semibold text-cheese">{formatWaxAmount(waxStakeAmount)}</p>
                <p className="text-xs text-muted-foreground">WAX</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-cheese/10" />

        {/* Cooldown Status */}
        <div className="text-center space-y-2">
          {isLoading ? (
            <Skeleton className="h-6 w-40 mx-auto bg-muted" />
          ) : canClaim ? (
            <div className="flex items-center justify-center gap-2 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-semibold">Ready!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Next null in: <span className="font-mono font-semibold text-cheese">{formatCountdown(timeUntilNextClaim)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={refetch}
          disabled={isLoading}
          className={cn(
            'flex items-center justify-center gap-2 mx-auto',
            'text-xs text-muted-foreground hover:text-cheese transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </CardContent>
    </Card>
  );
}
