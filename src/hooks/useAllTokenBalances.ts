import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
}

const BATCH_SIZE = 5;
const BATCH_DELAY = 200; // ms between batches to avoid rate limiting

// Prioritized RPC endpoints for balance fetching
const BALANCE_RPC_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
  "https://wax.pink.gg",
  "https://api.waxsweden.org",
];

async function fetchTokenBalance(
  contract: string,
  account: string,
  symbol: string,
  timeout: number = 5000
): Promise<number> {
  for (const baseUrl of BALANCE_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}/v1/chain/get_currency_balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: contract, account, symbol }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If we get a response (even 400/500), parse it
      if (response.ok) {
        const balances = await response.json() as string[];
        if (balances && balances.length > 0) {
          return parseFloat(balances[0].split(' ')[0]);
        }
        return 0;
      }
      
      // 400/500 typically means contract doesn't exist - return 0, don't retry
      if (response.status === 400 || response.status === 500) {
        return 0;
      }
    } catch {
      // Timeout or network error - try next endpoint
      continue;
    }
  }
  
  // All endpoints failed - return 0
  return 0;
}

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
            const balance = await fetchTokenBalance(
              token.contract,
              accountName,
              token.symbol
            );
            return { ...token, balance };
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

      const withBalance = sorted.filter(t => t.balance > 0);
      console.log('[Balance] Found', withBalance.length, 'tokens with balance:', withBalance.map(t => t.symbol).join(', '));
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
