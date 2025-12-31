import { useState, useEffect, useCallback } from 'react';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { fetchAllTokenBalances, fetchSingleTokenBalance, HyperionToken } from '@/lib/waxRpcFallback';

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

// Critical tokens that must always be checked via fallback if missing
const CRITICAL_TOKENS = [
  { symbol: 'CHEESE', contract: 'cheeseburger', precision: 8, displayName: 'CHEESE' },
  { symbol: 'WAX', contract: 'eosio.token', precision: 8, displayName: 'WAX' },
];

function isLpToken(contract: string): boolean {
  return LP_TOKEN_CONTRACTS.includes(contract);
}

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
      
      // Sort: regular tokens first (by balance desc), then LP tokens (by balance desc)
      const sorted = results
        .filter(t => t.balance > 0)
        .sort((a, b) => {
          // LP tokens go to bottom
          if (a.isLpToken && !b.isLpToken) return 1;
          if (!a.isLpToken && b.isLpToken) return -1;
          // Within same category, sort by balance descending
          if (b.balance !== a.balance) return b.balance - a.balance;
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

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { tokens, isLoading, refetch: fetchBalances };
}
