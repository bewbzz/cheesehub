import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ExternalLink, TrendingUp, Percent, Coins, ChevronDown, ChevronUp, Plus, RefreshCw, Zap, Wifi, Database, Clock, LogOut } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAlcorFarms, UnstakedIncentivesMap, UnstakedLPPosition } from '@/hooks/useAlcorFarms';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { buildClaimRewardsAction, buildUnstakeAction, buildStakeAction, AlcorFarmPosition, UnstakedIncentive } from '@/lib/alcorFarms';
import { TokenLogo } from '@/components/TokenLogo';
import { toast } from 'sonner';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { IncreaseLiquidityDialog } from './IncreaseLiquidityDialog';
import { CreateAlcorFarmDialog } from './CreateAlcorFarmDialog';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

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

// Check if an incentive has expired
function isIncentiveExpired(endTimestamp: number): boolean {
  if (endTimestamp <= 0) return false; // Unknown = not expired
  return endTimestamp <= Math.floor(Date.now() / 1000);
}

// Format remaining time for main row (compact: "45d", "3d 12h", "2h")
function formatRemainingDays(endTimestamp: number): { 
  label: string; 
  isUrgent: boolean; 
  isExpired: boolean 
} {
  const now = Math.floor(Date.now() / 1000);
  
  if (endTimestamp <= 0) {
    return { label: '—', isUrgent: false, isExpired: false };
  }
  
  if (endTimestamp <= now) {
    return { label: 'Ended', isUrgent: false, isExpired: true };
  }
  
  const secondsLeft = endTimestamp - now;
  const daysLeft = Math.floor(secondsLeft / 86400);
  const hoursLeft = Math.floor((secondsLeft % 86400) / 3600);
  
  if (daysLeft > 30) {
    return { label: `${daysLeft}d`, isUrgent: false, isExpired: false };
  } else if (daysLeft > 7) {
    return { label: `${daysLeft}d`, isUrgent: false, isExpired: false };
  } else if (daysLeft > 0) {
    return { label: `${daysLeft}d ${hoursLeft}h`, isUrgent: true, isExpired: false };
  } else {
    return { label: `${hoursLeft}h`, isUrgent: true, isExpired: false };
  }
}

// Format detailed countdown for dropdown
function formatDetailedCountdown(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  
  if (endTimestamp <= 0) return 'Unknown end time';
  if (endTimestamp <= now) return 'Farm has ended';
  
  const secondsLeft = endTimestamp - now;
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  
  // Format end date
  const endDate = new Date(endTimestamp * 1000);
  const dateStr = endDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const timeStr = endDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m (${dateStr} ${timeStr})`;
  } else {
    return `${minutes}m (${dateStr} ${timeStr})`;
  }
}

export function AlcorFarmManager({ onTransactionComplete, onTransactionSuccess }: AlcorFarmManagerProps) {
  const { session, accountName } = useWax();
  const { stakedFarms, unstakedIncentives, unstakedPositions, isLoading, refetch, dataSource } = useAlcorFarms();
  const { refetch: refetchTokenBalances } = useAllTokenBalances(accountName);
  const { data: tokenPrices } = useAlcorTokenPrices();
  const { data: waxUsdPrice = 0 } = useWaxPrice();
  const [isTransacting, setIsTransacting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);
  const [liveRewards, setLiveRewards] = useState<Map<string, number>>(new Map());
  const [increaseLiquidityPosition, setIncreaseLiquidityPosition] = useState<AlcorFarmPosition | null>(null);
  const [createFarmOpen, setCreateFarmOpen] = useState(false);
  
  // Track optimistically removed incentives (after unstaking) to prevent stale UI
  const [optimisticallyRemovedIds, setOptimisticallyRemovedIds] = useState<Set<string>>(new Set());

  // Guard against non-array stakedFarms
  const farmsList = Array.isArray(stakedFarms) ? stakedFarms : [];
  const unstakedList = Array.isArray(unstakedPositions) ? unstakedPositions : [];

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

  // Group farms by position ID and calculate USD value, filtering out optimistically removed incentives
  const groupedPositions = useMemo(() => {
    const groups = new Map<number, GroupedFarmPosition>();
    
    // Filter out optimistically removed incentives
    const filteredFarms = farmsList.filter(farm => {
      const key = `${farm.positionId}-${farm.incentiveId}`;
      return !optimisticallyRemovedIds.has(key);
    });
    
    filteredFarms.forEach(farm => {
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
    
    return groups;
  }, [farmsList, unstakedIncentives, getTokenUsdValue, optimisticallyRemovedIds]);
  
  // Create a unified list combining staked and unstaked positions, sorted by USD value
  const allPositionsSorted = useMemo(() => {
    type UnifiedPosition = 
      | { type: 'staked'; data: GroupedFarmPosition; usdValue: number }
      | { type: 'unstaked'; data: UnstakedLPPosition; usdValue: number };
    
    const unified: UnifiedPosition[] = [];
    
    // Add staked positions
    groupedPositions.forEach((pos) => {
      unified.push({ type: 'staked', data: pos, usdValue: pos.usdValue });
    });
    
    // Add unstaked positions with their calculated USD value
    unstakedList.forEach((pos) => {
      const tokenAValue = getTokenUsdValue(pos.tokenA.contract, pos.tokenA.symbol, pos.tokenA.amount);
      const tokenBValue = getTokenUsdValue(pos.tokenB.contract, pos.tokenB.symbol, pos.tokenB.amount);
      const usdValue = tokenAValue + tokenBValue;
      unified.push({ type: 'unstaked', data: pos, usdValue });
    });
    
    // Sort by USD value descending
    unified.sort((a, b) => b.usdValue - a.usdValue);
    
    return unified;
  }, [groupedPositions, unstakedList, getTokenUsdValue]);

  // Gather ALL expired incentives across all positions for batch unstake
  const allExpiredIncentives = useMemo(() => {
    const expired: AlcorFarmPosition[] = [];
    groupedPositions.forEach((position) => {
      position.incentives.forEach((incentive) => {
        if (isIncentiveExpired(incentive.incentiveEndsAt)) {
          expired.push(incentive);
        }
      });
    });
    return expired;
  }, [groupedPositions]);

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
      // Delayed refetch to allow indexer to update
      setTimeout(() => refetchTokenBalances(), 2000);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error(error?.message || 'Failed to claim rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, onTransactionSuccess, refetch, refetchTokenBalances, onTransactionComplete]);

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
      // Delayed refetch to allow indexer to update
      setTimeout(() => refetchTokenBalances(), 2000);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim all error:', error);
      toast.error(error?.message || 'Failed to claim all rewards');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }, [session, accountName, farmsList, onTransactionSuccess, refetch, refetchTokenBalances, onTransactionComplete]);

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

      // Optimistically remove the unstaked incentives from UI immediately
      const removedIds = new Set(
        incentives.map(i => `${i.positionId}-${i.incentiveId}`)
      );
      setOptimisticallyRemovedIds(prev => new Set([...prev, ...removedIds]));

      const firstIncentive = incentives[0];
      onTransactionSuccess?.(
        'Unstaked & Claimed!',
        `Claimed rewards and removed ${firstIncentive.tokenA.symbol}/${firstIncentive.tokenB.symbol} position from ${incentives.length} farm(s). Your LP tokens are still in the pool.`,
        txId
      );
      
      // Delay refetch to allow indexer to update, then clear optimistic state
      setTimeout(() => {
        refetch();
        setOptimisticallyRemovedIds(new Set());
      }, 3000);
      
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

  // Handle unstaking a single incentive (for expired incentives cleanup)
  const handleUnstakeSingle = useCallback(async (incentive: AlcorFarmPosition) => {
    await handleUnstake([incentive]);
  }, [handleUnstake]);

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

  // Handle batch unstake of all expired/ended incentives
  const handleClaimUnstakeAllExpired = useCallback(async (expiredIncentives: AlcorFarmPosition[]) => {
    if (!session || !accountName || expiredIncentives.length === 0) return;

    setIsTransacting(true);
    try {
      const actions = expiredIncentives.map(incentive => 
        buildUnstakeAction(accountName, incentive.incentiveId, incentive.positionId)
      );
      
      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      // Optimistically remove the unstaked incentives from UI immediately
      const removedIds = new Set(
        expiredIncentives.map(i => `${i.positionId}-${i.incentiveId}`)
      );
      setOptimisticallyRemovedIds(prev => new Set([...prev, ...removedIds]));

      onTransactionSuccess?.(
        'Ended Farms Cleaned Up!',
        `Claimed rewards and unstaked from ${expiredIncentives.length} ended farm(s). Active farms were not affected.`,
        txId
      );
      
      // Delay refetch to allow indexer to update, then clear optimistic state
      setTimeout(() => {
        refetch();
        setOptimisticallyRemovedIds(new Set());
      }, 3000);
      
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Unstake all expired error:', error);
      toast.error(error?.message || 'Failed to unstake expired farms');
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

  // Calculate total positions (staked + unstaked with available incentives)
  const totalPositionsWithFarms = allPositionsSorted.length;
  const totalEarningRewards = farmsList.length;
  
  // Count finished farms (positions where all incentives have expired)
  const finishedFarmsCount = Array.from(groupedPositions.values()).filter(
    pos => pos.incentives.every(i => isIncentiveExpired(i.incentiveEndsAt))
  ).length;

  
  // Debug logging
  console.log('[AlcorFarmManager] farmsList:', farmsList.length, 'unstakedList:', unstakedList.length, 'allPositionsSorted:', allPositionsSorted.length, 'finishedFarms:', finishedFarmsCount, 'expiredIncentives:', allExpiredIncentives.length);

  if (farmsList.length === 0 && unstakedList.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>You have no LP positions with available farm rewards</p>
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
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-medium">Your Farm Positions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalPositionsWithFarms} position{totalPositionsWithFarms !== 1 ? 's' : ''} with farms
              {totalEarningRewards > 0 && ` • ${totalEarningRewards} earning`}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {dataSource === 'api' ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs h-5">
                    <Wifi className="h-3 w-3 mr-1" />
                    API
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs h-5">
                    <Database className="h-3 w-3 mr-1" />
                    On-Chain
                  </Badge>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {dataSource === 'api' 
                  ? 'Connected to Alcor API' 
                  : 'Using blockchain fallback (Alcor API unavailable)'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreateFarmOpen(true)}
            className="h-6 px-2 text-xs gap-1 border-cheese/50 text-cheese hover:bg-cheese/10"
          >
            <Plus className="h-3 w-3" />
            Create Farm
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {allExpiredIncentives.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => handleClaimUnstakeAllExpired(allExpiredIncentives)}
                    disabled={isTransacting}
                    className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    {isTransacting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="h-3.5 w-3.5" />
                        Claim & Unstake Ended ({allExpiredIncentives.length})
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p className="text-sm">
                    Claims rewards and removes positions from <strong>{allExpiredIncentives.length} ended</strong> farm(s).
                    <span className="text-green-400 block mt-1">Active farms will NOT be affected.</span>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {unstakedList.length > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs animate-pulse">
              <Zap className="h-3 w-3 mr-1" />
              {unstakedList.length} unstaked
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsRefreshing(true);
              refetch();
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
            disabled={isTransacting || isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4 transition-transform", isRefreshing && "animate-spin")} />
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

      {/* Farm position cards - unified list sorted by USD value */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-2">
          {allPositionsSorted.map((item) => {
            if (item.type === 'staked') {
              const position = item.data;
              const isExpanded = expandedPosition === position.positionId;
              const positionClaims = position.incentives.map(i => ({ incentiveId: i.incentiveId, posId: i.positionId }));
              
              // Check if all incentives for this position have expired
              const allIncentivesExpired = position.incentives.every(i => isIncentiveExpired(i.incentiveEndsAt));
              const someIncentivesExpired = position.incentives.some(i => isIncentiveExpired(i.incentiveEndsAt));

              return (
                <Card 
                  key={position.positionId} 
                  className={cn(
                    "border-border/50",
                    allIncentivesExpired 
                      ? "bg-amber-500/5 border-l-4 border-l-amber-500/70" 
                      : "bg-muted/30"
                  )}
                >
                    <CardContent className="p-4">
                    {/* Header row - raised to top */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex -space-x-2">
                        <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
                        <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {position.tokenA.symbol}/{position.tokenB.symbol}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Pool #{position.positionId}
                          {position.usdValue > 0 && (
                            <span className="text-cheese ml-1">${position.usdValue.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Data rows - stake amounts aligned with incentive data */}
                    <div className="flex items-start justify-between gap-4">
                      {/* Stake amounts column */}
                      <div className="w-[140px] shrink-0">
                        <div className="text-xs text-muted-foreground mb-1">Stake</div>
                        <div 
                          className="font-mono text-xs space-y-0.5 text-muted-foreground"
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            height: position.incentives.length > 2 
                              ? `${position.incentives.length * 1.25}rem` 
                              : 'auto',
                            justifyContent: position.incentives.length > 2 ? 'space-evenly' : 'flex-start'
                          }}
                        >
                          <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                          <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                        </div>
                      </div>

                      {/* APR - stacked */}
                      <div className="w-[60px] shrink-0 text-center">
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                          <Percent className="h-3 w-3" />
                          APR
                        </div>
                        <div className="space-y-0.5">
                          {position.incentives.map((incentive) => {
                            const key = getIncentiveKey(incentive);
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

                      {/* Daily earn - stacked */}
                      <div className="w-[120px] shrink-0 text-center">
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

                      {/* Remaining Time - stacked */}
                      <div className="w-[70px] shrink-0 text-center">
                        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                          <Clock className="h-3 w-3" />
                          Remaining
                        </div>
                        <div className="space-y-0.5">
                          {position.incentives.map((incentive) => {
                            const key = getIncentiveKey(incentive);
                            const { label, isUrgent, isExpired } = formatRemainingDays(incentive.incentiveEndsAt);
                            return (
                              <div 
                                key={key} 
                                className={cn(
                                  "font-mono text-xs",
                                  isExpired ? "text-amber-500" : isUrgent ? "text-red-400" : "text-muted-foreground"
                                )}
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* All rewards for this position */}
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
                        {allIncentivesExpired ? (
                          <Button
                            size="sm"
                            onClick={() => handleUnstake(position.incentives)}
                            disabled={isTransacting}
                            className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <LogOut className="h-3 w-3 mr-1" />
                            Claim & Unstake
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleClaimRewards(positionClaims)}
                            disabled={isTransacting}
                            className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                          >
                            Claim
                          </Button>
                        )}
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
                        {/* Range Status & Stake buttons */}
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <Badge 
                            variant={position.isInRange ? "default" : "secondary"}
                            className={cn(
                              "text-xs",
                              position.isInRange ? "bg-green-500/20 text-green-400 border-green-500/50" : ""
                            )}
                          >
                            {position.isInRange ? 'In Range' : 'Out of Range'}
                          </Badge>
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

                        {/* All incentive rewards breakdown */}
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-medium">Reward Breakdown:</span>
                          <div className="grid gap-2">
                            {position.incentives.map((incentive) => {
                              const key = getIncentiveKey(incentive);
                              const liveReward = liveRewards.get(key) || incentive.pendingReward;
                              const detailedTime = formatDetailedCountdown(incentive.incentiveEndsAt);
                              const isExpired = isIncentiveExpired(incentive.incentiveEndsAt);
                              return (
                                <div 
                                  key={key}
                                  className={cn(
                                    "flex items-center justify-between p-2 rounded text-sm",
                                    isExpired 
                                      ? "bg-amber-500/10 border border-amber-500/30" 
                                      : "bg-background/50"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <TokenLogo 
                                      contract={incentive.rewardToken.contract} 
                                      symbol={incentive.rewardToken.symbol} 
                                      size="sm" 
                                    />
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium">{incentive.rewardToken.symbol}</span>
                                        <span className="text-xs text-muted-foreground">
                                          #{incentive.incentiveId}
                                        </span>
                                        {isExpired && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-500/20 text-amber-400 border-amber-500/50">
                                            ENDED
                                          </Badge>
                                        )}
                                      </div>
                                      {/* Detailed countdown */}
                                      <div className={cn(
                                        "text-xs mt-0.5 flex items-center gap-1",
                                        isExpired ? "text-amber-500" : "text-muted-foreground"
                                      )}>
                                        <Clock className="h-3 w-3" />
                                        {detailedTime}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className="font-mono text-cheese">
                                        {liveReward.toFixed(incentive.rewardToken.precision)}
                                      </div>
                                      {!isExpired && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <TrendingUp className="h-3 w-3" />
                                          {incentive.dailyEarnRate.toFixed(Math.min(4, incentive.rewardToken.precision))}/day
                                          <span className="ml-1">
                                            <Percent className="h-3 w-3 inline" />
                                            {incentive.rewardShare.toFixed(2)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {isExpired && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleUnstakeSingle(incentive)}
                                        disabled={isTransacting}
                                        variant="outline"
                                        className="h-7 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                      >
                                        <LogOut className="h-3 w-3 mr-1" />
                                        Claim & Unstake
                                      </Button>
                                    )}
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
            } else {
              // Unstaked position
              const position = item.data;
              const usdValue = item.usdValue;
              const isExpanded = expandedPosition === position.positionId;
              
              return (
                <Card 
                  key={`unstaked-${position.positionId}`} 
                  className="bg-muted/30 border-border/50 border-l-4 border-l-green-500/70"
                >
                  <CardContent className="p-4">
                    {/* Main row - Position info with prominent stake button */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Pair & Metadata */}
                      <div className="flex items-center gap-2 w-[130px] shrink-0">
                        <div className="flex -space-x-2">
                          <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
                          <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {position.tokenA.symbol}/{position.tokenB.symbol}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Pool #{position.positionId}
                            {usdValue > 0 && (
                              <span className="text-cheese ml-1">${usdValue.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Your Stake */}
                      <div className="w-[120px] shrink-0">
                        <div className="text-xs text-muted-foreground mb-1">Stake</div>
                        <div className="font-mono text-xs space-y-0.5">
                          <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                          <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                        </div>
                      </div>

                      {/* Status - Not earning */}
                      <div className="flex-1 text-center">
                        <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/50">
                          Not Earning Rewards
                        </Badge>
                      </div>

                      {/* Available incentives count */}
                      <div className="text-sm text-muted-foreground">
                        {position.availableIncentives.length} farm{position.availableIncentives.length !== 1 ? 's' : ''} available
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {position.availableIncentives.length === 1 ? (
                          <Button
                            size="sm"
                            onClick={() => handleStakeToIncentive(position.positionId, position.availableIncentives[0])}
                            disabled={isTransacting}
                            className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse"
                          >
                            <Zap className="h-4 w-4 mr-1" />
                            Stake Position
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleStakeAllIncentives(position.positionId, position.availableIncentives)}
                            disabled={isTransacting}
                            className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 text-white animate-pulse"
                          >
                            <Zap className="h-4 w-4 mr-1" />
                            Stake All ({position.availableIncentives.length})
                          </Button>
                        )}
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
                        <div className="flex items-start justify-between gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Your LP Tokens:</span>
                            <div className="font-mono mt-1">
                              <div>{position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}</div>
                              <div>{position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}</div>
                            </div>
                          </div>
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

                        {/* Available farms to stake to */}
                        <div className="space-y-2">
                          <span className="text-xs text-muted-foreground font-medium">Available Farms:</span>
                          <div className="grid gap-2">
                            {position.availableIncentives.map((incentive) => (
                              <div 
                                key={incentive.incentiveId}
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStakeToIncentive(position.positionId, incentive)}
                                  disabled={isTransacting}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Zap className="h-3 w-3 mr-1" />
                                  Stake
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(`https://wax.alcor.exchange/positions/${position.positionId}`, '_blank')}
                            className="flex-1 gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Manage on Alcor
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }
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

      {/* Create Farm Dialog */}
      <CreateAlcorFarmDialog
        open={createFarmOpen}
        onOpenChange={setCreateFarmOpen}
        onTransactionSuccess={(title, description, txId) => {
          onTransactionSuccess?.(title, description, txId);
          setTimeout(() => refetch(), 3000);
        }}
        onTransactionComplete={onTransactionComplete}
      />
    </div>
  );
}
