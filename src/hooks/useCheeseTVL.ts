import { useQuery } from '@tanstack/react-query';
import { fetchCheeseTotalTVL, TVLData } from '@/lib/tvl';

export function useCheeseTVL(waxUsdPrice: number | undefined) {
  return useQuery<TVLData>({
    queryKey: ['cheese-tvl', waxUsdPrice],
    queryFn: () => fetchCheeseTotalTVL(waxUsdPrice || 0),
    enabled: !!waxUsdPrice && waxUsdPrice > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    retry: 2,
  });
}
