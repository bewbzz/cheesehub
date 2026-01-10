import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, TrendingUp, Clock, Percent, Coins, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms } from '@/hooks/useAlcorFarms';
import { buildClaimRewardsAction, buildUnstakeAction, AlcorFarmPosition } from '@/lib/alcorFarms';
import { TokenLogo } from '@/components/TokenLogo';
import { toast } from 'sonner';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { IncreaseLiquidityDialog } from './IncreaseLiquidityDialog';
import { cn } from '@/lib/utils';

interface AlcorFarmManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, incentivesMap, isLoading, refetch } = useAlcorFarms();
  const [isTransacting, setIsTransacting] = useState(false);
  const [expandedFarm, setExpandedFarm] = useState<number | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<number, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);

  // Update live rewards every second
  useEffect(() => {
    if (stakedFarms.length === 0) return;

    const updateRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const newRewards = new Map<number, number>();

      stakedFarms.forEach(farm => {
        const elapsedSeconds = Math.max(0, now - farm.lastUpdate);
        const liveReward = farm.pendingReward + (farm.rewardPerSecond * elapsedSeconds);
        newRewards.set(farm.positionId, liveReward);
      });

      setLiveRewards(newRewards);
    };

    // Initial update
    updateRewards();

    // Update every second
    const interval = setInterval(updateRewards, 1000);
    return () => clearInterval(interval);
  }, [stakedFarms]);

  const handleClaimRewards = useCallback(async (farm: AlcorFarmPosition) => {
    if (!session || !accountName) return;

    setIsTransacting(true);
    try {
      const actions = buildClaimRewardsAction(accountName, [farm.incentiveId]);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const reward = liveRewards.get(farm.positionId) || farm.pendingReward;
      onTransactionSuccess?.(
        'Rewards Claimed!',
        `Claimed ${reward.toFixed(farm.rewardToken.precision)} ${farm.rewardToken.symbol} from ${farm.tokenA.symbol}/${farm.tokenB.symbol} farm`,
        txId
      );
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error?.message || 'Failed to claim rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, liveRewards, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleClaimAll = useCallback(async () => {
    if (!session || !accountName || stakedFarms.length === 0) return;

    setIsTransacting(true);
    try {
      const incentiveIds = [...new Set(stakedFarms.map(f => f.incentiveId))];
      const actions = buildClaimRewardsAction(accountName, incentiveIds);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'All Rewards Claimed!',
        `Claimed rewards from ${incentiveIds.length} farm(s)`,
        txId
      );
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim all error:', error);
      toast.error(error?.message || 'Failed to claim all rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, stakedFarms, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleUnstake = useCallback(async (farm: AlcorFarmPosition) => {
    if (!session || !accountName) return;

    setIsTransacting(true);
    try {
      const action = buildUnstakeAction(accountName, farm.incentiveId, farm.positionId);
      const result = await session.transact({ actions: [action] });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Position Unstaked!',
        `Removed ${farm.tokenA.symbol}/${farm.tokenB.symbol} position from farm. Your LP tokens are still in the pool.`,
        txId
      );
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Unstake error:', error);
      toast.error(error?.message || 'Failed to unstake position');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const formatTimeRemaining = (endTime: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getTotalPendingRewards = useCallback(() => {
    const totals = new Map<string, { amount: number; precision: number }>();
    
    stakedFarms.forEach(farm => {
      const reward = liveRewards.get(farm.positionId) || farm.pendingReward;
      const key = `${farm.rewardToken.contract}:${farm.rewardToken.symbol}`;
      const existing = totals.get(key) || { amount: 0, precision: farm.rewardToken.precision };
      totals.set(key, { amount: existing.amount + reward, precision: farm.rewardToken.precision });
    });
    
    return totals;
  }, [stakedFarms, liveRewards]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-cheese" />
        <span className="text-muted-foreground">Loading farm positions...</span>
      </div>
    );
  }

  if (stakedFarms.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>You have no staked LP positions in Alcor Farms</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => window.open('https://wax.alcor.exchange/farm', '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Explore Alcor Farms
        </Button>
      </div>
    );
  }

  const totalRewards = getTotalPendingRewards();

  return (
    <div className="space-y-4">
      {/* Header with total rewards and claim all */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Your Farm Positions</h3>
          {totalRewards.size > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Total pending: {Array.from(totalRewards.entries()).map(([key, val]) => (
                <span key={key} className="text-cheese font-medium ml-1">
                  {val.amount.toFixed(val.precision)} {key.split(':')[1]}
                </span>
              ))}
            </div>
          )}
        </div>
        {stakedFarms.length > 0 && (
          <Button
            size="sm"
            onClick={handleClaimAll}
            disabled={isTransacting}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isTransacting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Coins className="h-4 w-4 mr-1" />
                Claim All
              </>
            )}
          </Button>
        )}
      </div>

      {/* Farm position cards */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-2">
          {stakedFarms.map((farm) => {
            const liveReward = liveRewards.get(farm.positionId) || farm.pendingReward;
            const isExpanded = expandedFarm === farm.positionId;

            return (
              <Card key={farm.positionId} className="bg-muted/30 border-border/50">
                <CardContent className="p-4">
                  {/* Main row */}
                  <div className="flex items-center gap-4">
                    {/* Pair */}
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={farm.tokenA.contract} symbol={farm.tokenA.symbol} size="sm" />
                        <TokenLogo contract={farm.tokenB.contract} symbol={farm.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {farm.tokenA.symbol}/{farm.tokenB.symbol}
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {farm.fee.toFixed(2)}%
                        </Badge>
                      </div>
                    </div>

                    {/* Reward */}
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Coins className="h-3 w-3" />
                        Earned
                      </div>
                      <div className="font-mono text-sm text-cheese font-medium">
                        {liveReward.toFixed(farm.rewardToken.precision)} {farm.rewardToken.symbol}
                      </div>
                    </div>

                    {/* Daily */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Daily
                      </div>
                      <div className="font-mono text-xs">
                        {farm.dailyEarnRate.toFixed(farm.rewardToken.precision)}
                      </div>
                    </div>

                    {/* Time remaining */}
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />
                        Ends
                      </div>
                      <div className="text-xs">{formatTimeRemaining(farm.incentiveEndsAt)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaimRewards(farm)}
                        disabled={isTransacting || liveReward <= 0}
                        className="h-8 px-3 text-xs"
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedFarm(isExpanded ? null : farm.positionId)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Your Stake:</span>
                          <div className="font-mono mt-1">
                            <div>{farm.tokenA.amount.toFixed(4)} {farm.tokenA.symbol}</div>
                            <div>{farm.tokenB.amount.toFixed(4)} {farm.tokenB.symbol}</div>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            Reward Share:
                          </span>
                          <div className="font-mono mt-1">{farm.rewardShare.toFixed(4)}%</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={farm.isInRange ? "default" : "secondary"}
                          className={cn(
                            "text-xs",
                            farm.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : ""
                          )}
                        >
                          {farm.isInRange ? 'In Range' : 'Out of Range'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Position #{farm.positionId}
                        </span>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIncreaseLiquidityPosition(farm)}
                          disabled={isTransacting}
                          className="flex-1 gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Increase Stake
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnstake(farm)}
                          disabled={isTransacting}
                          className="flex-1 text-destructive hover:text-destructive"
                        >
                          Unstake
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://wax.alcor.exchange/positions/${farm.positionId}`, '_blank')}
                          className="px-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Increase Liquidity Dialog */}
      <IncreaseLiquidityDialog
        open={!!increaseLiquidityPosition}
        onOpenChange={(open) => !open && setIncreaseLiquidityPosition(null)}
        position={increaseLiquidityPosition}
        onSuccess={(title, description, txId) => {
          setIncreaseLiquidityPosition(null);
          onTransactionSuccess?.(title, description, txId);
          refetch();
          onTransactionComplete?.();
        }}
      />
    </div>
  );
}
