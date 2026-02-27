import { useQuery } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import { fetchWhitelist } from '@/lib/adminData';

export function useAdminAccess() {
  const { accountName, isConnected } = useWax();

  const { data: isWhitelisted, isLoading } = useQuery({
    queryKey: ['admin-whitelist', accountName],
    queryFn: () => fetchWhitelist(accountName!),
    enabled: isConnected && !!accountName,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isWhitelisted: isWhitelisted ?? false,
    isLoading,
    isConnected,
    accountName,
  };
}
