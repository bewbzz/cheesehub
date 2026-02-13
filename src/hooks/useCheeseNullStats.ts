import { useQuery } from '@tanstack/react-query';
import { fetchContractStats, parseAssetAmount } from '@/lib/cheeseNullApi';

const CONTRACT_ACCOUNT = 'cheeseburner';

export interface CheeseNullStatsData {
  totalBurns: number;
  totalCheeseNulled: number;
  totalCheeseRewards: number;
  totalCheeseLiquidity: number;
  totalWaxCompounded: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCheeseNullStats(): CheeseNullStatsData {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cheeseNull', 'contractStats', CONTRACT_ACCOUNT],
    queryFn: () => fetchContractStats(CONTRACT_ACCOUNT),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return {
    totalBurns: data?.total_burns ?? 0,
    totalCheeseNulled: parseAssetAmount(data?.total_cheese_burned ?? ''),
    totalCheeseRewards: parseAssetAmount(data?.total_cheese_rewards ?? ''),
    totalCheeseLiquidity: parseAssetAmount(data?.total_cheese_liquidity ?? ''),
    totalWaxCompounded: parseAssetAmount(data?.total_wax_staked ?? ''),
    isLoading,
    isError,
    refetch,
  };
}
