import { useState, useEffect, useCallback } from 'react';
import { WAX_CHAIN } from '@/lib/waxConfig';
import { TokenConfig } from '@/lib/tokenRegistry';

export function useTokenBalance(
  accountName: string | null,
  token: TokenConfig | null
) {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!accountName || !token) {
      setBalance(0);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${WAX_CHAIN.url}/v1/chain/get_currency_balance`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: token.contract,
            account: accountName,
            symbol: token.symbol,
          }),
        }
      );

      const balances = await response.json();
      if (balances && balances.length > 0) {
        const bal = parseFloat(balances[0].split(' ')[0]);
        setBalance(bal);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error('Failed to fetch token balance:', error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [accountName, token]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, refetch: fetchBalance };
}
