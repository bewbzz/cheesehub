import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
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
  const { stakedFarms, isLoading, refetch } = useAlcorFarms();
  const [isTransacting, setIsTransacting] = useState(false);
  const [expandedFarm, setExpandedFarm] = useState<string | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<string, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);

  // Guard against non-array stakedFarms early
  const farmsList = Array.isArray(stakedFarms) ? stakedFarms : [];

  // Create unique key for each farm position (position can be in multiple incentives)
  const getFarmKey = (farm: AlcorFarmPosition) => `${farm.positionId}-${farm.incentiveId}`;

  // Update live rewards every second
  useEffect(() => {
    if (farmsList.length === 0) return;

    const updateRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const newRewards = new Map<string, number>();

      farmsList.forEach(farm => {
        const key = getFarmKey(farm);
        const elapsedSeconds = Math.max(0, now - farm.lastUpdate);
        const liveReward = farm.pendingReward + (farm.rewardPerSecond * elapsedSeconds);
        newRewards.set(key, liveReward);
      });

      setLiveRewards(newRewards);
    };

    // Initial update
    updateRewards();

    // Update every second
    const interval = setInterval(updateRewards, 1000);
    return () => clearInterval(interval);
  }, [farmsList]);

  const handleClaimRewards = useCallback(async (farm: AlcorFarmPosition) => {
    if (!session || !accountName) return;

    setIsTransacting(true);
    try {
      const actions = buildClaimRewardsAction(accountName, [farm.incentiveId]);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Rewards Claimed!',
        `Claimed ${farm.farmedRewardDisplay} from ${farm.tokenA.symbol}/${farm.tokenB.symbol} farm`,
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
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleClaimAll = useCallback(async () => {
    if (!session || !accountName || farmsList.length === 0) return;

    setIsTransacting(true);
    try {
      const incentiveIds = [...new Set(farmsList.map(f => f.incentiveId))];
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
  }, [session, accountName, farmsList, onTransactionSuccess, refetch, onTransactionComplete]);

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

  // Group farms by position ID for cleaner display
  const groupedFarms = farmsList.reduce((acc, farm) => {
    const key = farm.positionId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(farm);
    return acc;
  }, {} as Record<number, AlcorFarmPosition[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-cheese" />
        <span className="text-muted-foreground">Loading farm positions...</span>
      </div>
    );
  }

  if (farmsList.length === 0) {
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

  return (
    <div className="space-y-4">
      {/* Header with claim all and refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Your Farm Positions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {farmsList.length} incentive{farmsList.length !== 1 ? 's' : ''} across {Object.keys(groupedFarms).length} position{Object.keys(groupedFarms).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isTransacting}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
        </div>
      </div>

      {/* Farm position cards */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-2">
          {farmsList.map((farm) => {
            const farmKey = getFarmKey(farm);
            const liveReward = liveRewards.get(farmKey) || farm.pendingReward;
            const isExpanded = expandedFarm === farmKey;

            return (
              <Card key={farmKey} className="bg-muted/30 border-border/50">
                <CardContent className="p-4">
                  {/* Main row */}
                  <div className="flex items-center gap-3">
                    {/* Pair */}
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={farm.tokenA.contract} symbol={farm.tokenA.symbol} size="sm" />
                        <TokenLogo contract={farm.tokenB.contract} symbol={farm.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {farm.tokenA.symbol}/{farm.tokenB.symbol}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          #{farm.positionId}
                        </div>
                      </div>
                    </div>

                    {/* Earned Reward */}
                    <div className="flex-1 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Coins className="h-3 w-3" />
                        Earned
                      </div>
                      <div className="font-mono text-sm text-cheese font-medium">
                        {liveReward.toFixed(farm.rewardToken.precision)} {farm.rewardToken.symbol}
                      </div>
                    </div>

                    {/* Daily Rate */}
                    <div className="text-center min-w-[90px]">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Daily
                      </div>
                      <div className="font-mono text-xs">
                        {farm.dailyEarnRate.toFixed(Math.min(4, farm.rewardToken.precision))} {farm.rewardToken.symbol}
                      </div>
                    </div>

                    {/* Share */}
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Percent className="h-3 w-3" />
                      </div>
                      <div className="text-xs">{farm.rewardShare.toFixed(2)}%</div>
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
                        onClick={() => setExpandedFarm(isExpanded ? null : farmKey)}
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
                          <span className="text-muted-foreground">Incentive ID:</span>
                          <div className="font-mono mt-1">#{farm.incentiveId}</div>
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
