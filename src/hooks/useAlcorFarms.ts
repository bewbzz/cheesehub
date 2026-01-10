import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import {
  fetchUserStakedFarmsWithDetails,
  fetchUserPositions,
  fetchPoolIncentives,
  fetchPoolDetails,
  AlcorFarmPosition,
  AlcorApiPosition,
  UnstakedIncentive,
} from '@/lib/alcorFarms';
import { ensureTokenCacheLoaded } from '@/lib/tokenLogos';

// Map of positionId -> unstaked incentives for that position's pool
export type UnstakedIncentivesMap = Map<number, UnstakedIncentive[]>;

// Represents an LP position with available farm incentives (but not currently staked)
export interface UnstakedLPPosition {
  positionId: number;
  poolId: number;
  tokenA: { contract: string; symbol: string; amount: number };
  tokenB: { contract: string; symbol: string; amount: number };
  tickLower: number;
  tickUpper: number;
  isInRange: boolean;
  availableIncentives: UnstakedIncentive[];
}

interface UseAlcorFarmsResult {
  stakedFarms: AlcorFarmPosition[];
  unstakedIncentives: UnstakedIncentivesMap;
  unstakedPositions: UnstakedLPPosition[]; // LP positions with NO stakes but available incentives
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Parse WAX asset string (e.g., "123.45678901 WAX")
function parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } {
  if (!assetStr) return { amount: 0, symbol: '', precision: 0 };
  const parts = assetStr.trim().split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const decimalParts = parts[0].split('.');
  const precision = decimalParts[1]?.length || 0;
  return { amount, symbol, precision };
}

export function useAlcorFarms(): UseAlcorFarmsResult {
  const { accountName } = useWax();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alcor-farms-v3', accountName], // Force fresh fetch with new key
    queryFn: async () => {
      console.log('[useAlcorFarms] === STARTING FRESH FETCH for', accountName, '===');
      if (!accountName) return { stakedFarms: [], unstakedIncentives: new Map(), unstakedPositions: [] };
      
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
      
      // For each unique pool, fetch all active incentives AND pool details
      const uniquePoolIds = new Set<number>();
      stakedFarms.forEach(f => uniquePoolIds.add(f.poolId));
      allPositions.forEach(p => uniquePoolIds.add(p.pool));
      
      const poolIncentivesMap = new Map<number, any[]>();
      const poolDetailsMap = new Map<number, any>();
      
      await Promise.all(
        Array.from(uniquePoolIds).map(async (poolId) => {
          const [incentives, poolDetails] = await Promise.all([
            fetchPoolIncentives(poolId),
            fetchPoolDetails(poolId),
          ]);
          poolIncentivesMap.set(poolId, incentives);
          if (poolDetails) poolDetailsMap.set(poolId, poolDetails);
        })
      );
      
      // Build unstaked incentives map for each position
      const unstakedIncentives: UnstakedIncentivesMap = new Map();
      // Track fully unstaked positions (LP positions with 0 stakes but available incentives)
      const unstakedPositions: UnstakedLPPosition[] = [];
      
      console.log('[useAlcorFarms] Processing', allPositions.length, 'LP positions, stakedByPosition has', stakedByPosition.size, 'entries');
      
      // Check all LP positions (including those with no stakes yet)
      allPositions.forEach((position: AlcorApiPosition) => {
        const poolId = position.pool;
        const allPoolIncentives = poolIncentivesMap.get(poolId) || [];
        const stakedInfo = stakedByPosition.get(position.id);
        const stakedIncentiveIds = stakedInfo?.incentiveIds || [];
        const hasAnyStakes = stakedIncentiveIds.length > 0;
        
        // Find incentives not staked to
        const unstaked = allPoolIncentives
          .filter((incentive: any) => !stakedIncentiveIds.includes(incentive.id))
          .map((incentive: any) => {
            // Handle both API format and blockchain table format
            // Blockchain format: rewardToken: { contract, quantity }
            // API format: reward: { contract, quantity }
            const rewardData = incentive.rewardToken || incentive.reward || {};
            const rewardAsset = rewardData.quantity || '0.00000000 TOKEN';
            const rewardParts = rewardAsset.split(' ');
            const decimalParts = rewardParts[0].split('.');
            const precision = decimalParts[1]?.length || 8;
            
            return {
              incentiveId: incentive.id,
              poolId: incentive.poolId || incentive.pool || poolId,
              rewardToken: {
                contract: rewardData.contract || '',
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
        
        // Log each position's status for debugging
        console.log(`[useAlcorFarms] Position #${position.id}: pool=${poolId}, hasStakes=${hasAnyStakes}, poolIncentives=${allPoolIncentives.length}, unstaked=${unstaked.length}`);
        
        // If this position has NO stakes but has available incentives, add to unstakedPositions
        if (!hasAnyStakes && unstaked.length > 0) {
          const poolDetails = poolDetailsMap.get(poolId);
          const amountA = parseAsset(position.amountA);
          const amountB = parseAsset(position.amountB);
          
          console.log(`[useAlcorFarms] Adding position #${position.id} to unstakedPositions`);
          
          unstakedPositions.push({
            positionId: position.id,
            poolId,
            tokenA: {
              contract: poolDetails?.tokenA?.contract || '',
              symbol: amountA.symbol,
              amount: amountA.amount,
            },
            tokenB: {
              contract: poolDetails?.tokenB?.contract || '',
              symbol: amountB.symbol,
              amount: amountB.amount,
            },
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            isInRange: position.inRange,
            availableIncentives: unstaked,
          });
        }
      });
      
      console.log('[useAlcorFarms] Final: stakedFarms:', stakedFarms.length, 'unstakedPositions:', unstakedPositions.length, 'allPositions:', allPositions.length);
      
      return { stakedFarms, unstakedIncentives, unstakedPositions };
    },
    enabled: !!accountName,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 2,
  });

  return {
    stakedFarms: Array.isArray(data?.stakedFarms) ? data.stakedFarms : [],
    unstakedIncentives: data?.unstakedIncentives || new Map(),
    unstakedPositions: Array.isArray(data?.unstakedPositions) ? data.unstakedPositions : [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
