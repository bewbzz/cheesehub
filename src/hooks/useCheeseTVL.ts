import { useQuery } from '@tanstack/react-query';
import { fetchCheeseTotalTVL, TVLData } from '@/lib/tvl';

export function useCheeseTVL(waxUsdPrice: number | undefined) {
  return useQuery<TVLData>({
    queryKey: ['cheese-tvl', waxUsdPrice],
    queryFn: () => fetchCheeseTotalTVL(waxUsdPrice || 0),
    enabled: !!waxUsdPrice && waxUsdPrice > 0,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 60 * 60 * 1000, // Refresh every hour
    retry: 2,
  });
}
