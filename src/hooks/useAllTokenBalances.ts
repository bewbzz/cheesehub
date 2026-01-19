import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { fetchAllTokenBalances, fetchSingleTokenBalance, fetchCriticalTokenBalancesDirect, REALTIME_TOKENS, HyperionToken } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
  isLpToken: boolean;
}

// Create a lookup map for our known tokens
const TOKEN_REGISTRY_MAP = new Map<string, TokenConfig>();
WAX_TOKENS.forEach(token => {
  TOKEN_REGISTRY_MAP.set(`${token.contract}:${token.symbol}`, token);
});

// LP token contracts
const LP_TOKEN_CONTRACTS = ['lptoken.box', 'swap.taco'];

// Critical tokens that must always be checked via fallback if missing from Hyperion
// Only CHEESE is critical - WAX and other tokens are reliably returned by Hyperion
const CRITICAL_TOKENS = [
  { symbol: 'CHEESE', contract: 'cheeseburger', precision: 4, displayName: 'CHEESE' },
];

function isLpToken(contract: string): boolean {
  return LP_TOKEN_CONTRACTS.includes(contract);
}

export function useAllTokenBalances(accountName: string | null) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Standard fetch using Hyperion (fast, all tokens, but may lag)
  const fetchBalances = useCallback(async () => {
    if (!accountName) {
      setTokens([]);
      return;
    }

    console.log('[Balance] Fetching balances via Hyperion for:', accountName);
    setIsLoading(true);
    
    try {
      // Single API call to get ALL token balances
      const hyperionTokens = await fetchAllTokenBalances(accountName);
      
      // Map Hyperion response to our TokenWithBalance format
      const results: TokenWithBalance[] = hyperionTokens.map((ht: HyperionToken) => {
        const key = `${ht.contract}:${ht.symbol}`;
        const knownToken = TOKEN_REGISTRY_MAP.get(key);
        
        if (knownToken) {
          return {
            ...knownToken,
            balance: ht.amount,
            isLpToken: isLpToken(ht.contract),
          };
        } else {
          return {
            symbol: ht.symbol,
            contract: ht.contract,
            precision: ht.precision || 8,
            displayName: ht.symbol,
            balance: ht.amount,
            isLpToken: isLpToken(ht.contract),
          };
        }
      });
      
      // Fallback: Check for missing critical tokens
      for (const critical of CRITICAL_TOKENS) {
        const found = results.find(t => 
          t.symbol === critical.symbol && t.contract === critical.contract
        );
        if (!found) {
          console.log(`[Balance] ${critical.symbol} missing from Hyperion, fetching directly...`);
          const balance = await fetchSingleTokenBalance(
            accountName,
            critical.contract,
            critical.symbol
          );
          if (balance > 0) {
            const knownToken = TOKEN_REGISTRY_MAP.get(`${critical.contract}:${critical.symbol}`);
            results.push({
              ...(knownToken || critical),
              balance,
              isLpToken: false,
            });
          }
        }
      }
      
      // Sort: alphabetically, with LP tokens at bottom
      const sorted = results
        .filter(t => t.balance > 0)
        .sort((a, b) => {
          // LP tokens go to bottom
          if (a.isLpToken && !b.isLpToken) return 1;
          if (!a.isLpToken && b.isLpToken) return -1;
          // Within same category, sort alphabetically
          return a.symbol.localeCompare(b.symbol);
        });

      console.log('[Balance] Found', sorted.length, 'tokens:', 
        sorted.filter(t => !t.isLpToken).map(t => t.symbol).join(', '),
        '| LP:', sorted.filter(t => t.isLpToken).map(t => t.symbol).join(', ')
      );
      setTokens(sorted);
    } catch (error) {
      console.error('[Balance] Hyperion failed:', error);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  // Real-time fetch for critical tokens using direct RPC (bypasses indexer lag)
  const refetchRealTime = useCallback(async () => {
    if (!accountName) return;
    
    console.log('[Balance] Fetching real-time balances via direct RPC...');
    
    try {
      // Fetch critical tokens via direct RPC
      const directBalances = await fetchCriticalTokenBalancesDirect(accountName, REALTIME_TOKENS);
      
      // Update tokens with real-time balances
      setTokens(prev => {
        const updated = [...prev];
        
        for (const [key, balance] of directBalances) {
          const [contract, symbol] = key.split(':');
          const existingIndex = updated.findIndex(t => t.contract === contract && t.symbol === symbol);
          
          if (existingIndex >= 0) {
            // Update existing token
            updated[existingIndex] = { ...updated[existingIndex], balance };
          } else if (balance > 0) {
            // Add new token if it has balance
            const knownToken = TOKEN_REGISTRY_MAP.get(key);
            updated.push({
              symbol,
              contract,
              precision: knownToken?.precision || 8,
              displayName: knownToken?.displayName || symbol,
              balance,
              isLpToken: false,
            });
          }
        }
        
        // Re-sort and filter
        return updated
          .filter(t => t.balance > 0)
          .sort((a, b) => {
            if (a.isLpToken && !b.isLpToken) return 1;
            if (!a.isLpToken && b.isLpToken) return -1;
            return a.symbol.localeCompare(b.symbol);
          });
      });
      
      console.log('[Balance] Real-time refresh complete');
    } catch (error) {
      console.error('[Balance] Real-time fetch failed:', error);
      // Fall back to standard fetch
      await fetchBalances();
    }
  }, [accountName, fetchBalances]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, isLoading, refetch: fetchBalances, refetchRealTime };
}
