import { useState, useEffect, useCallback, useRef } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { WAX_RPC_ENDPOINTS } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
}

// Fetch a single token balance with endpoint fallback
async function fetchTokenBalance(
  token: TokenConfig,
  accountName: string,
  signal: AbortSignal
): Promise<number> {
  for (const endpoint of WAX_RPC_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1/chain/get_currency_balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: token.contract,
          account: accountName,
          symbol: token.symbol,
        }),
        signal,
      });

      if (response.ok) {
        const balances = await response.json();
        if (balances && balances.length > 0) {
          return parseFloat(balances[0].split(' ')[0]);
        }
        return 0;
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error; // Re-throw abort errors to stop processing
      }
      // Try next endpoint
      continue;
    }
  }
  return 0;
}

// Batch fetch with concurrency limit to avoid rate limiting
async function fetchBalancesInBatches(
  tokens: TokenConfig[],
  accountName: string,
  signal: AbortSignal,
  batchSize: number = 10
): Promise<TokenWithBalance[]> {
  const results: TokenWithBalance[] = [];
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    if (signal.aborted) break;
    
    const batch = tokens.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (token) => {
        try {
          const balance = await fetchTokenBalance(token, accountName, signal);
          return { ...token, balance };
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            throw error;
          }
          return { ...token, balance: 0 };
        }
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}

export function useAllTokenBalances(accountName: string | null) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>(() => 
    WAX_TOKENS.map(t => ({ ...t, balance: 0 }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAllBalances = useCallback(async () => {
    if (!accountName) {
      setTokens(WAX_TOKENS.map(t => ({ ...t, balance: 0 })));
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const results = await fetchBalancesInBatches(
        WAX_TOKENS,
        accountName,
        controller.signal,
        10 // Fetch 10 tokens at a time
      );
      
      if (!controller.signal.aborted) {
        // Sort: tokens with balance first (by balance desc), then 0 balance tokens alphabetically
        const sorted = results.sort((a, b) => {
          if (a.balance > 0 && b.balance === 0) return -1;
          if (a.balance === 0 && b.balance > 0) return 1;
          if (a.balance > 0 && b.balance > 0) return b.balance - a.balance;
          return a.symbol.localeCompare(b.symbol);
        });
        setTokens(sorted);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch token balances:', error);
        setTokens(WAX_TOKENS.map(t => ({ ...t, balance: 0 })));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [accountName]);

  useEffect(() => {
    fetchAllBalances();
    
    // Cleanup: abort on unmount or accountName change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAllBalances]);

  return { tokens, isLoading, refetch: fetchAllBalances };
}
