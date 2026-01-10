import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import {
  fetchUserStakedFarmsWithDetails,
  AlcorFarmPosition,
} from '@/lib/alcorFarms';

interface UseAlcorFarmsResult {
  stakedFarms: AlcorFarmPosition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAlcorFarms(): UseAlcorFarmsResult {
  const { accountName } = useWax();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alcor-farms', accountName],
    queryFn: async () => {
      if (!accountName) return [];
      return await fetchUserStakedFarmsWithDetails(accountName);
    },
    enabled: !!accountName,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 2,
  });

  return {
    stakedFarms: data || [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
