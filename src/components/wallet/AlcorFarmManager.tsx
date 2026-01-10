import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, RefreshCw, Zap } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms, UnstakedIncentivesMap } from '@/hooks/useAlcorFarms';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { buildClaimRewardsAction, buildUnstakeAction, buildStakeAction, AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';
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
  tickLower: number;
  tickUpper: number;
  isInRange: boolean;
  incentives: AlcorFarmPosition[];
  unstakedIncentives: UnstakedIncentive[];
  usdValue: number;
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, unstakedIncentives, isLoading, refetch } = useAlcorFarms();
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
        
        // Get unstaked incentives for this position
        const positionUnstaked = unstakedIncentives.get(farm.positionId) || [];

        groups.set(farm.positionId, {
          positionId: farm.positionId,
          poolId: farm.poolId,
          tokenA: farm.tokenA,
          tokenB: farm.tokenB,
          tickLower: farm.tickLower,
          tickUpper: farm.tickUpper,
          isInRange: farm.isInRange,
          incentives: [],
          unstakedIncentives: positionUnstaked,
          usdValue,
        });
      }
      groups.get(farm.positionId)!.incentives.push(farm);
    });
    
    // Sort by USD value descending (highest value first)
    return Array.from(groups.values()).sort((a, b) => b.usdValue - a.usdValue);
  }, [farmsList, unstakedIncentives]);

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

  const handleClaimRewards = useCallback(async (claims: Array<{ incentiveId: number; posId: number }>) => {
    if (!session || !accountName || claims.length === 0) return;

    setIsTransacting(true);
    try {
      const actions = buildClaimRewardsAction(accountName, claims);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Rewards Claimed!',
        `Claimed rewards from ${claims.length} incentive(s)`,
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
      // Build unique claims with both incentiveId and posId
      const claimsMap = new Map<string, { incentiveId: number; posId: number }>();
      farmsList.forEach(f => {
        const key = `${f.incentiveId}-${f.positionId}`;
        if (!claimsMap.has(key)) {
          claimsMap.set(key, { incentiveId: f.incentiveId, posId: f.positionId });
        }
      });
      const claims = Array.from(claimsMap.values());
      
      const actions = buildClaimRewardsAction(accountName, claims);
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'All Rewards Claimed!',
        `Claimed rewards from ${claims.length} incentive(s)`,
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

  const handleUnstake = useCallback(async (incentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || incentives.length === 0) return;

    setIsTransacting(true);
    try {
      // Build unstake actions for ALL incentives for this position
      const actions = incentives.map(incentive => 
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const firstIncentive = incentives[0];
      onTransactionSuccess?.(
        'Position Unstaked!',
        `Removed ${firstIncentive.tokenA.symbol}/${firstIncentive.tokenB.symbol} position from ${incentives.length} farm reward(s). Your LP tokens are still in the pool.`,
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

  const handleStakeToIncentive = useCallback(async (positionId: number, incentive: UnstakedIncentive) => {
    if (!session || !accountName) return;

    setIsTransacting(true);
    try {
      const action = buildStakeAction(accountName, incentive.incentiveId, positionId);
      const result = await session.transact({ actions: [action] });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onTransactionSuccess?.(
        'Position Staked!',
        `Staked position #${positionId} to ${incentive.rewardToken.symbol} farm rewards`,
        txId
      );
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake error:', error);
      toast.error(error?.message || 'Failed to stake position');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, onTransactionComplete]);

  const handleStakeAllIncentives = useCallback(async (positionId: number, incentives: UnstakedIncentive[]) => {
    if (!session || !accountName || incentives.length === 0) return;

    setIsTransacting(true);
    try {
      const actions = incentives.map(incentive => 
        buildStakeAction(accountName, incentive.incentiveId, positionId)
      );
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const rewardSymbols = incentives.map(i => i.rewardToken.symbol).join(', ');
      onTransactionSuccess?.(
        'Position Staked!',
        `Staked position #${positionId} to ${incentives.length} farm rewards (${rewardSymbols})`,
        txId
      );
      refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake all error:', error);
      toast.error(error?.message || 'Failed to stake position');
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
            const positionClaims = position.incentives.map(i => ({ incentiveId: i.incentiveId, posId: i.positionId }));

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
                        onClick={() => handleClaimRewards(positionClaims)}
                        disabled={isTransacting}
                        className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
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
                      {/* Position Info with Stake button */}
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Your Stake:</span>
                          <div className="font-mono mt-1">
                            <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                            <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge 
                            variant={position.isInRange ? "default" : "secondary"}
                            className={cn(
                              "text-xs",
                              position.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : ""
                            )}
                          >
                            {position.isInRange ? 'In Range' : 'Out of Range'}
                          </Badge>
                          {/* Pulsing stake button when there are unstaked incentives */}
                          {position.unstakedIncentives.length > 0 && (
                            position.unstakedIncentives.length === 1 ? (
                              <Button
                                size="sm"
                                onClick={() => handleStakeToIncentive(position.positionId, position.unstakedIncentives[0])}
                                disabled={isTransacting}
                                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 animate-pulse"
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                Stake Position
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleStakeAllIncentives(position.positionId, position.unstakedIncentives)}
                                disabled={isTransacting}
                                className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 animate-pulse"
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                Stake All ({position.unstakedIncentives.length})
                              </Button>
                            )
                          )}
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

                      {/* Unstaked incentives - Stake Position buttons */}
                      {position.unstakedIncentives.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-medium">New Rewards Available:</span>
                          <div className="grid gap-2">
                            {position.unstakedIncentives.map((incentive) => (
                              <div 
                                key={incentive.incentiveId}
                                className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/30 text-sm"
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
                                <Button
                                  size="sm"
                                  onClick={() => handleStakeToIncentive(position.positionId, incentive)}
                                  disabled={isTransacting}
                                  className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                                >
                                  <Zap className="h-3 w-3 mr-1" />
                                  Stake Position
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            // Create position object for dialog using first incentive as base
                            const baseIncentive = position.incentives[0];
                            if (baseIncentive) {
                              setIncreaseLiquidityPosition({
                                ...baseIncentive,
                                tickLower: position.tickLower,
                                tickUpper: position.tickUpper,
                              });
                            }
                          }}
                          disabled={isTransacting || position.tickLower === 0 && position.tickUpper === 0}
                          className="flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Plus className="h-3 w-3" />
                          Increase Position
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUnstake(position.incentives)}
                          disabled={isTransacting}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Unstake from Farm
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
                      {/* Show warning if tick data missing */}
                      {position.tickLower === 0 && position.tickUpper === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Tick data unavailable. <a href={`https://wax.alcor.exchange/positions/${position.positionId}`} target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">Manage on Alcor</a>
                        </p>
                      )}
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
          // Delay refetch to allow blockchain indexer to update
          setTimeout(() => {
            refetch();
          }, 3000);
          onTransactionComplete?.();
        }}
      />
    </div>
  );
}
