import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
}

export function useAllTokenBalances(accountName: string | null) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllBalances = useCallback(async () => {
    if (!accountName) {
      // Return tokens with 0 balance when not connected
      setTokens(WAX_TOKENS.map(t => ({ ...t, balance: 0 })));
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all balances in parallel using fallback RPC system
      const balancePromises = WAX_TOKENS.map(async (token) => {
        try {
          const balances = await waxRpcCall<string[]>(
            '/v1/chain/get_currency_balance',
            {
              code: token.contract,
              account: accountName,
              symbol: token.symbol,
            }
          );

          let balance = 0;
          if (balances && balances.length > 0) {
            balance = parseFloat(balances[0].split(' ')[0]);
          }
          return { ...token, balance };
        } catch (error) {
          console.error(`Failed to fetch ${token.symbol} balance:`, error);
          return { ...token, balance: 0 };
        }
      });

      const results = await Promise.all(balancePromises);
      
      // Sort: tokens with balance first (by balance desc), then 0 balance tokens alphabetically
      const sorted = results.sort((a, b) => {
        if (a.balance > 0 && b.balance === 0) return -1;
        if (a.balance === 0 && b.balance > 0) return 1;
        if (a.balance > 0 && b.balance > 0) return b.balance - a.balance;
        return a.symbol.localeCompare(b.symbol);
      });

      setTokens(sorted);
    } catch (error) {
      console.error('Failed to fetch token balances:', error);
      setTokens(WAX_TOKENS.map(t => ({ ...t, balance: 0 })));
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  return { tokens, isLoading, refetch: fetchAllBalances };
}
