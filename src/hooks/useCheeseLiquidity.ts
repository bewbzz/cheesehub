import { useQuery } from '@tanstack/react-query';
import { useCheesePriceData } from './useCheesePriceData';

const WAX_ENDPOINTS = [
  'https://wax.greymass.com',
  'https://api.wax.alohaeos.com',
  'https://wax.eosrio.io',
  'https://api.waxsweden.org',
];

export interface CheeseLiquidityData {
  totalLiquidityUsd: number;
  alcorLiquidityUsd: number;
  tacoLiquidityUsd: number;
  defiboxLiquidityUsd: number;
}

interface AlcorPool {
  id: string;
  tokenA: { id: string; quantity: string; contract: string; symbol: string };
  tokenB: { id: string; quantity: string; contract: string; symbol: string };
  tvlUSD: number;
}

function parseTokenAmount(amountStr: string): number {
  const match = amountStr.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

async function fetchWithFallback<T>(
  fetchFn: (endpoint: string) => Promise<T>
): Promise<T> {
  let lastError: Error | null = null;
  
  for (const endpoint of WAX_ENDPOINTS) {
    try {
      return await fetchFn(endpoint);
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }
  
  throw lastError || new Error('All endpoints failed');
}

async function fetchAlcorLiquidity(): Promise<number> {
  const response = await fetch('https://wax.alcor.exchange/api/v2/swap/pools');
  
  if (!response.ok) {
    throw new Error('Failed to fetch Alcor pools');
  }
  
  const pools: AlcorPool[] = await response.json();
  
  // Filter pools containing CHEESE token
  const cheesePools = pools.filter(
    pool =>
      pool.tokenA.id === 'cheese-cheeseburger' ||
      pool.tokenB.id === 'cheese-cheeseburger'
  );
  
  // Sum up CHEESE-side liquidity (half of TVL since TVL includes both tokens)
  let totalCheeseLiquidity = 0;
  for (const pool of cheesePools) {
    totalCheeseLiquidity += pool.tvlUSD / 2;
  }
  
  return totalCheeseLiquidity;
}

async function fetchTacoLiquidity(cheeseUsdPrice: number): Promise<number> {
  return fetchWithFallback(async (endpoint) => {
    const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'swap.taco',
        scope: 'swap.taco',
        table: 'pairs',
        json: true,
        limit: 1000,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Taco pairs');
    }
    
    const data = await response.json();
    const pairs = data.rows || [];
    
    let totalCheeseLiquidity = 0;
    
    for (const pair of pairs) {
      // Check if either token is CHEESE
      const reserve1 = pair.reserve0 || pair.pool1?.quantity || '';
      const reserve2 = pair.reserve1 || pair.pool2?.quantity || '';
      const token1Contract = pair.token0?.contract || pair.pool1?.contract || '';
      const token2Contract = pair.token1?.contract || pair.pool2?.contract || '';
      
      if (token1Contract === 'cheeseburger' && reserve1.includes('CHEESE')) {
        totalCheeseLiquidity += parseTokenAmount(reserve1) * cheeseUsdPrice;
      } else if (token2Contract === 'cheeseburger' && reserve2.includes('CHEESE')) {
        totalCheeseLiquidity += parseTokenAmount(reserve2) * cheeseUsdPrice;
      }
    }
    
    return totalCheeseLiquidity;
  });
}

async function fetchDefiboxLiquidity(cheeseUsdPrice: number): Promise<number> {
  return fetchWithFallback(async (endpoint) => {
    const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'swap.box',
        scope: 'swap.box',
        table: 'pairs',
        json: true,
        limit: 1000,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch Defibox pairs');
    }
    
    const data = await response.json();
    const pairs = data.rows || [];
    
    let totalCheeseLiquidity = 0;
    
    for (const pair of pairs) {
      // Defibox uses reserve0/reserve1 with token0/token1 contracts
      const reserve0 = pair.reserve0 || '';
      const reserve1 = pair.reserve1 || '';
      const token0 = pair.token0 || {};
      const token1 = pair.token1 || {};
      
      if (token0.contract === 'cheeseburger' && reserve0.includes('CHEESE')) {
        totalCheeseLiquidity += parseTokenAmount(reserve0) * cheeseUsdPrice;
      } else if (token1.contract === 'cheeseburger' && reserve1.includes('CHEESE')) {
        totalCheeseLiquidity += parseTokenAmount(reserve1) * cheeseUsdPrice;
      }
    }
    
    return totalCheeseLiquidity;
  });
}

async function fetchAllLiquidity(cheeseUsdPrice: number): Promise<CheeseLiquidityData> {
  const results = await Promise.allSettled([
    fetchAlcorLiquidity(),
    fetchTacoLiquidity(cheeseUsdPrice),
    fetchDefiboxLiquidity(cheeseUsdPrice),
  ]);
  
  const alcorLiquidityUsd = results[0].status === 'fulfilled' ? results[0].value : 0;
  const tacoLiquidityUsd = results[1].status === 'fulfilled' ? results[1].value : 0;
  const defiboxLiquidityUsd = results[2].status === 'fulfilled' ? results[2].value : 0;
  
  return {
    totalLiquidityUsd: alcorLiquidityUsd + tacoLiquidityUsd + defiboxLiquidityUsd,
    alcorLiquidityUsd,
    tacoLiquidityUsd,
    defiboxLiquidityUsd,
  };
}

export function useCheeseLiquidity() {
  const { data: priceData } = useCheesePriceData();
  const cheeseUsdPrice = priceData?.usdPrice ?? 0;
  
  return useQuery<CheeseLiquidityData>({
    queryKey: ['cheese-liquidity', cheeseUsdPrice],
    queryFn: () => fetchAllLiquidity(cheeseUsdPrice),
    enabled: cheeseUsdPrice > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
  });
}
