import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms } from '@/hooks/useAlcorFarms';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
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

// Grouped position with all its incentive rewards
interface GroupedFarmPosition {
  positionId: number;
  poolId: number;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  isInRange: boolean;
  incentives: AlcorFarmPosition[];
  usdValue: number;
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, isLoading, refetch } = useAlcorFarms();
  const { data: tokenPrices } = useAlcorTokenPrices();
  const { data: waxUsdPrice = 0 } = useWaxPrice();
  const [isTransacting, setIsTransacting] = useState(false);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<string, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);

  // Guard against non-array stakedFarms
  const farmsList = Array.isArray(stakedFarms) ? stakedFarms : [];

  // Helper to get token USD value - supports lookup by symbol when contract is unknown
  const getTokenUsdValue = useCallback((contract: string, symbol: string, amount: number): number => {
    if (symbol === 'WAX' && (contract === 'eosio.token' || !contract)) {
      return amount * waxUsdPrice;
    }
    if (tokenPrices) {
      // Try exact match first
      if (contract) {
        const key = `${contract}:${symbol}`;
        const priceInWax = tokenPrices.get(key);
        if (priceInWax) {
          return amount * priceInWax * waxUsdPrice;
        }
      }
      // Fallback: search by symbol only (for reward tokens where contract is unknown)
      for (const [key, priceInWax] of tokenPrices) {
        if (key.endsWith(`:${symbol}`)) {
          return amount * priceInWax * waxUsdPrice;
        }
      }
    }
    return 0;
  }, [tokenPrices, waxUsdPrice]);

  // Group farms by position ID and calculate USD value, then sort by value
  const groupedPositions = useMemo(() => {
    const groups = new Map<number, GroupedFarmPosition>();
    
    farmsList.forEach(farm => {
      if (!groups.has(farm.positionId)) {
        // Calculate USD value of the position
        const tokenAValue = getTokenUsdValue(farm.tokenA.contract, farm.tokenA.symbol, farm.tokenA.amount);
        const tokenBValue = getTokenUsdValue(farm.tokenB.contract, farm.tokenB.symbol, farm.tokenB.amount);
        const usdValue = tokenAValue + tokenBValue;

        groups.set(farm.positionId, {
          positionId: farm.positionId,
          poolId: farm.poolId,
          tokenA: farm.tokenA,
          tokenB: farm.tokenB,
          isInRange: farm.isInRange,
          incentives: [],
          usdValue,
        });
      }
      groups.get(farm.positionId)!.incentives.push(farm);
    });
    
    // Sort by USD value descending (highest value first)
    return Array.from(groups.values()).sort((a, b) => b.usdValue - a.usdValue);
  }, [farmsList]);

  // Create unique key for each incentive
  const getIncentiveKey = (farm: AlcorFarmPosition) => `${farm.positionId}-${farm.incentiveId}`;

  // Update live rewards every second
  useEffect(() => {
    if (farmsList.length === 0) return;

    const updateRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const newRewards = new Map<string, number>();

      farmsList.forEach(farm => {
        const key = getIncentiveKey(farm);
        const elapsedSeconds = Math.max(0, now - farm.lastUpdate);
        const liveReward = farm.pendingReward + (farm.rewardPerSecond * elapsedSeconds);
        newRewards.set(key, liveReward);
      });

      setLiveRewards(newRewards);
    };

    updateRewards();
    const interval = setInterval(updateRewards, 1000);
    return () => clearInterval(interval);
  }, [farmsList]);

  const handleClaimRewards = useCallback(async (incentiveIds: number[]) => {
    if (!session || !accountName || incentiveIds.length === 0) return;

    setIsTransacting(true);
    try {
      const actions = buildClaimRewardsAction(accountName, incentiveIds);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Rewards Claimed!',
        `Claimed rewards from ${incentiveIds.length} incentive(s)`,
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
        `Claimed rewards from ${incentiveIds.length} incentive(s)`,
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
            {groupedPositions.length} position{groupedPositions.length !== 1 ? 's' : ''} earning {farmsList.length} reward{farmsList.length !== 1 ? 's' : ''}
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

      {/* Farm position cards - grouped by position */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-2">
          {groupedPositions.map((position) => {
            const isExpanded = expandedPosition === position.positionId;
            const positionIncentiveIds = position.incentives.map(i => i.incentiveId);

            return (
              <Card key={position.positionId} className="bg-muted/30 border-border/50">
                <CardContent className="p-4">
                  {/* Main row - Position info */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Pair */}
                    <div className="flex items-center gap-2 w-[140px] shrink-0">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
                        <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {position.tokenA.symbol}/{position.tokenB.symbol}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span>#{position.positionId}</span>
                          {position.usdValue > 0 && (
                            <span className="text-cheese">${position.usdValue.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* APR - stacked */}
                    <div className="w-[70px] shrink-0 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Percent className="h-3 w-3" />
                        APR
                      </div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          // Calculate APR: (dailyEarnRate * 365 * tokenUsdPrice) / positionUsdValue * 100
                          const dailyValueUsd = getTokenUsdValue(
                            incentive.rewardToken.contract,
                            incentive.rewardToken.symbol,
                            incentive.dailyEarnRate
                          );
                          const apr = position.usdValue > 0 
                            ? (dailyValueUsd * 365 / position.usdValue) * 100 
                            : 0;
                          return (
                            <div key={key} className="font-mono text-xs text-green-400">
                              {apr > 0 ? `${apr.toFixed(1)}%` : '—'}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Daily earn - stacked (middle) */}
                    <div className="w-[130px] shrink-0 text-center">
                      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Daily
                      </div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          return (
                            <div key={key} className="font-mono text-xs">
                              {incentive.dailyEarnRate.toFixed(Math.min(4, incentive.rewardToken.precision))} {incentive.rewardToken.symbol}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* All rewards for this position - stacked (right, next to claim) */}
                    <div className="min-w-[100px]">
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Coins className="h-3 w-3" />
                        Earned
                      </div>
                      <div className="space-y-0.5">
                        {position.incentives.map((incentive) => {
                          const key = getIncentiveKey(incentive);
                          const liveReward = liveRewards.get(key) || incentive.pendingReward;
                          return (
                            <div key={key} className="font-mono text-sm text-cheese font-medium">
                              {liveReward.toFixed(Math.min(4, incentive.rewardToken.precision))} {incentive.rewardToken.symbol}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClaimRewards(positionIncentiveIds)}
                        disabled={isTransacting}
                        className="h-8 px-3 text-xs"
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedPosition(isExpanded ? null : position.positionId)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                      {/* Position Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Your Stake:</span>
                          <div className="font-mono mt-1">
                            <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                            <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                          </div>
                        </div>
                        <div>
                          <Badge 
                            variant={position.isInRange ? "default" : "secondary"}
                            className={cn(
                              "text-xs",
                              position.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : ""
                            )}
                          >
                            {position.isInRange ? 'In Range' : 'Out of Range'}
                          </Badge>
                        </div>
                      </div>

                      {/* All incentive rewards breakdown */}
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground font-medium">Reward Breakdown:</span>
                        <div className="grid gap-2">
                          {position.incentives.map((incentive) => {
                            const key = getIncentiveKey(incentive);
                            const liveReward = liveRewards.get(key) || incentive.pendingReward;
                            return (
                              <div 
                                key={key}
                                className="flex items-center justify-between p-2 rounded bg-background/50 text-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <TokenLogo 
                                    contract={incentive.rewardToken.contract} 
                                    symbol={incentive.rewardToken.symbol} 
                                    size="sm" 
                                  />
                                  <span className="font-medium">{incentive.rewardToken.symbol}</span>
                                  <span className="text-xs text-muted-foreground">
                                    #{incentive.incentiveId}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono text-cheese">
                                    {liveReward.toFixed(incentive.rewardToken.precision)}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    {incentive.dailyEarnRate.toFixed(Math.min(4, incentive.rewardToken.precision))}/day
                                    <span className="ml-1">
                                      <Percent className="h-3 w-3 inline" />
                                      {incentive.rewardShare.toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIncreaseLiquidityPosition(position.incentives[0])}
                          disabled={isTransacting}
                          className="flex-1 gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Increase Stake
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnstake(position.incentives[0])}
                          disabled={isTransacting}
                          className="flex-1 text-destructive hover:text-destructive"
                        >
                          Unstake
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`https://wax.alcor.exchange/positions/${position.positionId}`, '_blank')}
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
