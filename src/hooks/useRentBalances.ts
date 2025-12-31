import { useState, useEffect, useCallback } from 'react';
import { waxRpcCall } from '@/lib/waxRpcFallback';

interface RentBalances {
  cheese: number;
  wax: number;
}

export function useRentBalances(accountName: string | null) {
  const [balances, setBalances] = useState<RentBalances>({ cheese: 0, wax: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!accountName) {
      setBalances({ cheese: 0, wax: 0 });
      return;
    }

    setIsLoading(true);
    try {
      // Fetch only CHEESE and WAX balances in parallel
      const [cheeseResult, waxResult] = await Promise.all([
        waxRpcCall<string[]>('/v1/chain/get_currency_balance', {
          code: 'cheeseburger',
          account: accountName,
          symbol: 'CHEESE',
        }).catch(() => []),
        waxRpcCall<string[]>('/v1/chain/get_currency_balance', {
          code: 'eosio.token',
          account: accountName,
          symbol: 'WAX',
        }).catch(() => []),
      ]);

      const cheese = cheeseResult?.length > 0 ? parseFloat(cheeseResult[0].split(' ')[0]) : 0;
      const wax = waxResult?.length > 0 ? parseFloat(waxResult[0].split(' ')[0]) : 0;

      setBalances({ cheese, wax });
    } catch (error) {
      console.error('Failed to fetch rent balances:', error);
      setBalances({ cheese: 0, wax: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, isLoading, refetch: fetchBalances };
}
