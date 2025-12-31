import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { fetchAllTokenBalances, HyperionToken } from '@/lib/waxRpcFallback';

export interface TokenWithBalance extends TokenConfig {
  balance: number;
}

// Create a lookup map for our known tokens
const TOKEN_REGISTRY_MAP = new Map<string, TokenConfig>();
WAX_TOKENS.forEach(token => {
  // Key by contract:symbol for exact matching
  TOKEN_REGISTRY_MAP.set(`${token.contract}:${token.symbol}`, token);
});

export function useAllTokenBalances(accountName: string | null) {
  const [tokens, setTokens] = useState<TokenWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
          // Use our registry info (has logo, display name, etc.)
          return {
            ...knownToken,
            balance: ht.amount,
          };
        } else {
          // Unknown token - create entry from Hyperion data
          return {
            symbol: ht.symbol,
            contract: ht.contract,
            precision: ht.precision || 8,
            displayName: ht.symbol,
            balance: ht.amount,
          };
        }
      });
      
      // Sort: tokens with balance first (by balance desc), then alphabetically
      const sorted = results
        .filter(t => t.balance > 0) // Only show tokens with balance
        .sort((a, b) => {
          // Sort by balance descending
          if (b.balance !== a.balance) return b.balance - a.balance;
          return a.symbol.localeCompare(b.symbol);
        });

      console.log('[Balance] Found', sorted.length, 'tokens with balance:', sorted.map(t => t.symbol).join(', '));
      setTokens(sorted);
    } catch (error) {
      console.error('[Balance] Hyperion failed:', error);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, isLoading, refetch: fetchBalances };
}
