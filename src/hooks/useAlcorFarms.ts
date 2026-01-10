import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import {
  fetchIncentives,
  fetchUserStakedPositions,
  fetchStakeState,
  fetchPosition,
  fetchPool,
  calculateLiveReward,
  isPositionInRange,
  AlcorFarmPosition,
  AlcorIncentive,
} from '@/lib/alcorFarms';

interface UseAlcorFarmsResult {
  stakedFarms: AlcorFarmPosition[];
  incentivesMap: Map<number, AlcorIncentive>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAlcorFarms(): UseAlcorFarmsResult {
  const { accountName } = useWax();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alcor-farms', accountName],
    queryFn: async () => {
      if (!accountName) return { stakedFarms: [], incentivesMap: new Map() };

      // Fetch user's staked positions
      const stakedPositions = await fetchUserStakedPositions(accountName);
      
      if (stakedPositions.length === 0) {
        return { stakedFarms: [], incentivesMap: new Map() };
      }

      // Fetch all incentives (we need them for reward calculations)
      const incentives = await fetchIncentives(200);
      const incentivesMap = new Map<number, AlcorIncentive>();
      incentives.forEach(inc => incentivesMap.set(inc.id, inc));

      // For each staked position, fetch detailed info
      const farmPositions: AlcorFarmPosition[] = [];

      for (const stakedPos of stakedPositions) {
        const incentive = incentivesMap.get(stakedPos.incentiveId);
        if (!incentive) continue;

        // Fetch stake state (contains pending rewards)
        const stakeState = await fetchStakeState(stakedPos.incentiveId, stakedPos.positionId);
        if (!stakeState) continue;

        // Fetch LP position details
        const position = await fetchPosition(stakedPos.positionId);
        if (!position) continue;

        // Fetch pool details
        const pool = await fetchPool(incentive.poolId);
        if (!pool) continue;

        // Calculate user's reward share
        const totalStaked = BigInt(incentive.totalStakedLiquidity || '1');
        const userLiquidity = BigInt(stakeState.liquidity || '0');
        const rewardShare = totalStaked > BigInt(0) 
          ? Number(userLiquidity) / Number(totalStaked) * 100 
          : 0;

        // Calculate daily earn rate
        const dailyEarnRate = incentive.rewardPerSecond * 86400 * (rewardShare / 100);

        // Parse pool token amounts
        const tokenAAmount = parseFloat(pool.tokenA.quantity.split(' ')[0]) || 0;
        const tokenBAmount = parseFloat(pool.tokenB.quantity.split(' ')[0]) || 0;

        // Estimate user's token amounts based on liquidity share
        // This is a simplified calculation
        const poolTotalLiquidity = BigInt(pool.liquidity || '1');
        const positionLiquidity = BigInt(position.liquidity || '0');
        const liquidityShare = poolTotalLiquidity > BigInt(0)
          ? Number(positionLiquidity) / Number(poolTotalLiquidity)
          : 0;

        farmPositions.push({
          positionId: stakedPos.positionId,
          incentiveId: stakedPos.incentiveId,
          poolId: incentive.poolId,
          liquidity: stakeState.liquidity,
          tokenA: {
            contract: pool.tokenA.contract,
            symbol: pool.tokenA.symbol,
            amount: tokenAAmount * liquidityShare,
          },
          tokenB: {
            contract: pool.tokenB.contract,
            symbol: pool.tokenB.symbol,
            amount: tokenBAmount * liquidityShare,
          },
          rewardToken: {
            contract: incentive.rewardToken.contract,
            symbol: incentive.rewardToken.symbol,
            precision: incentive.rewardToken.precision,
          },
          pendingReward: stakeState.pendingReward,
          rewardPerSecond: incentive.rewardPerSecond * (rewardShare / 100),
          rewardShare,
          dailyEarnRate,
          incentiveEndsAt: incentive.endTime,
          isInRange: isPositionInRange(position, pool),
          fee: pool.fee / 10000, // Convert from basis points to percentage
          lastUpdate: stakeState.lastUpdate,
        });
      }

      return { stakedFarms: farmPositions, incentivesMap };
    },
    enabled: !!accountName,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 2,
  });

  return {
    stakedFarms: data?.stakedFarms || [],
    incentivesMap: data?.incentivesMap || new Map(),
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
