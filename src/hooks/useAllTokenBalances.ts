import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
}

const BATCH_SIZE = 5;
const BATCH_DELAY = 150; // ms between batches to avoid rate limiting

export function useAllTokenBalances(accountName: string | null) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAllBalances = useCallback(async () => {
    if (!accountName) {
      setTokens(WAX_TOKENS.map(t => ({ ...t, balance: 0 })));
      return;
    }

    console.log('[Balance] Fetching balances for:', accountName);
    setIsLoading(true);
    
    try {
      const results: TokenWithBalance[] = [];
      
      // Process tokens in batches to avoid rate limiting
      for (let i = 0; i < WAX_TOKENS.length; i += BATCH_SIZE) {
        const batch = WAX_TOKENS.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(async (token) => {
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
              console.error(`[Balance] Failed ${token.symbol}:`, error);
              return { ...token, balance: 0 };
            }
          })
        );
        
        results.push(...batchResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < WAX_TOKENS.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // Sort: tokens with balance first (by balance desc), then 0 balance tokens alphabetically
      const sorted = results.sort((a, b) => {
        if (a.balance > 0 && b.balance === 0) return -1;
        if (a.balance === 0 && b.balance > 0) return 1;
        if (a.balance > 0 && b.balance > 0) return b.balance - a.balance;
        return a.symbol.localeCompare(b.symbol);
      });

      console.log('[Balance] Fetched', sorted.filter(t => t.balance > 0).length, 'tokens with balance');
      setTokens(sorted);
    } catch (error) {
      console.error('[Balance] Failed to fetch token balances:', error);
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
