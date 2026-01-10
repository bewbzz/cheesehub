import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import {
  fetchUserStakedFarmsWithDetails,
  fetchUserPositions,
  fetchPoolIncentives,
  AlcorFarmPosition,
  UnstakedIncentive,
} from '@/lib/alcorFarms';
import { ensureTokenCacheLoaded } from '@/lib/tokenLogos';

// Map of positionId -> unstaked incentives for that position's pool
export type UnstakedIncentivesMap = Map<number, UnstakedIncentive[]>;

interface UseAlcorFarmsResult {
  stakedFarms: AlcorFarmPosition[];
  unstakedIncentives: UnstakedIncentivesMap;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAlcorFarms(): UseAlcorFarmsResult {
  const { accountName } = useWax();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alcor-farms', accountName],
    queryFn: async () => {
      if (!accountName) return { stakedFarms: [], unstakedIncentives: new Map() };
      
      // Ensure token cache is loaded before fetching farms
      await ensureTokenCacheLoaded();
      
      // Fetch staked farms and all LP positions
      const [stakedFarms, allPositions] = await Promise.all([
        fetchUserStakedFarmsWithDetails(accountName),
        fetchUserPositions(accountName),
      ]);
      
      // Build map of positionId -> staked incentive IDs
      const stakedByPosition = new Map<number, { poolId: number; incentiveIds: number[] }>();
      stakedFarms.forEach(farm => {
        const existing = stakedByPosition.get(farm.positionId);
        if (existing) {
          existing.incentiveIds.push(farm.incentiveId);
        } else {
          stakedByPosition.set(farm.positionId, {
            poolId: farm.poolId,
            incentiveIds: [farm.incentiveId],
          });
        }
      });
      
      // For each unique pool, fetch all active incentives
      const uniquePoolIds = new Set<number>();
      stakedFarms.forEach(f => uniquePoolIds.add(f.poolId));
      allPositions.forEach(p => uniquePoolIds.add(p.pool));
      
      const poolIncentivesMap = new Map<number, any[]>();
      await Promise.all(
        Array.from(uniquePoolIds).map(async (poolId) => {
          const incentives = await fetchPoolIncentives(poolId);
          poolIncentivesMap.set(poolId, incentives);
        })
      );
      
      // Build unstaked incentives map for each position
      const unstakedIncentives: UnstakedIncentivesMap = new Map();
      
      // Check all LP positions (including those with no stakes yet)
      allPositions.forEach(position => {
        const poolId = position.pool;
        const allPoolIncentives = poolIncentivesMap.get(poolId) || [];
        const stakedInfo = stakedByPosition.get(position.id);
        const stakedIncentiveIds = stakedInfo?.incentiveIds || [];
        
        // Find incentives not staked to
        const unstaked = allPoolIncentives
          .filter((incentive: any) => !stakedIncentiveIds.includes(incentive.id))
          .map((incentive: any) => {
            const rewardAsset = incentive.reward?.quantity || '0.00000000 TOKEN';
            const rewardParts = rewardAsset.split(' ');
            const decimalParts = rewardParts[0].split('.');
            const precision = decimalParts[1]?.length || 8;
            
            return {
              incentiveId: incentive.id,
              poolId: incentive.pool || poolId,
              rewardToken: {
                contract: incentive.reward?.contract || '',
                symbol: rewardParts[1] || 'TOKEN',
                precision,
              },
              totalReward: parseFloat(rewardParts[0]) || 0,
              rewardPerDay: incentive.rewardPerDay || 0,
            } as UnstakedIncentive;
          });
        
        if (unstaked.length > 0) {
          unstakedIncentives.set(position.id, unstaked);
        }
      });
      
      return { stakedFarms, unstakedIncentives };
    },
    enabled: !!accountName,
    staleTime: 5 * 1000, // 5 seconds - allow faster refresh after transactions
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 2,
  });

  return {
    stakedFarms: Array.isArray(data?.stakedFarms) ? data.stakedFarms : [],
    unstakedIncentives: data?.unstakedIncentives || new Map(),
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
