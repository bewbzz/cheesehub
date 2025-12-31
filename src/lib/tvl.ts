import { fetchTableRows } from './waxRpcFallback';

const CHEESE_CONTRACT = 'cheeseburger';
const CHEESE_SYMBOL = 'CHEESE';

interface AlcorPool {
  id: number;
  tokenA: { contract: string; symbol: string; quantity: string };
  tokenB: { contract: string; symbol: string; quantity: string };
  tvlUSD: number;
}

interface DefiboxPair {
  id: number;
  token0: { contract: string; symbol: string };
  token1: { contract: string; symbol: string };
  reserve0: string;
  reserve1: string;
  liquidity_token: number;
  price0_last: string;
  price1_last: string;
}

interface TacoPair {
  id: number;
  pool1: { contract: string; quantity: string };
  pool2: { contract: string; quantity: string };
}

export interface TVLData {
  alcor: number;
  defibox: number;
  taco: number;
  nefty: number;
  totalUSD: number;
  totalWAX: number;
}

function parseQuantity(quantity: string): { amount: number; symbol: string } {
  const parts = quantity.split(' ');
  return {
    amount: parseFloat(parts[0]) || 0,
    symbol: parts[1] || '',
  };
}

export async function fetchAlcorCheeseTVL(): Promise<number> {
  try {
    const response = await fetch('https://wax.alcor.exchange/api/v2/swap/pools');
    if (!response.ok) throw new Error('Failed to fetch Alcor pools');
    
    const pools: AlcorPool[] = await response.json();
    
    // Filter for CHEESE pools (tokenA or tokenB is CHEESE)
    const cheesePools = pools.filter(pool => 
      (pool.tokenA.contract === CHEESE_CONTRACT && pool.tokenA.symbol.includes(CHEESE_SYMBOL)) ||
      (pool.tokenB.contract === CHEESE_CONTRACT && pool.tokenB.symbol.includes(CHEESE_SYMBOL))
    );
    
    // Sum up TVL from all CHEESE pools
    return cheesePools.reduce((sum, pool) => sum + (pool.tvlUSD || 0), 0);
  } catch (error) {
    console.warn('Failed to fetch Alcor CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchDefiboxCheeseTVL(waxUsdPrice: number): Promise<number> {
  try {
    const response = await fetchTableRows<DefiboxPair>({
      code: 'swap.box',
      scope: 'swap.box',
      table: 'pairs',
      limit: 500,
    });
    
    // Filter for CHEESE pairs
    const cheesePairs = response.rows.filter(pair =>
      pair.token0.contract === CHEESE_CONTRACT || pair.token1.contract === CHEESE_CONTRACT
    );
    
    let totalTVL = 0;
    
    for (const pair of cheesePairs) {
      const reserve0 = parseQuantity(pair.reserve0);
      const reserve1 = parseQuantity(pair.reserve1);
      
      // Calculate TVL - both sides of the pair
      // If one side is WAX, use WAX price to get USD value
      if (pair.token0.contract === 'eosio.token' && pair.token0.symbol === '8,WAX') {
        totalTVL += reserve0.amount * waxUsdPrice * 2; // Multiply by 2 for both sides
      } else if (pair.token1.contract === 'eosio.token' && pair.token1.symbol === '8,WAX') {
        totalTVL += reserve1.amount * waxUsdPrice * 2;
      }
    }
    
    return totalTVL;
  } catch (error) {
    console.warn('Failed to fetch Defibox CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchTacoCheeseTVL(waxUsdPrice: number): Promise<number> {
  try {
    const response = await fetchTableRows<TacoPair>({
      code: 'swap.taco',
      scope: 'swap.taco',
      table: 'pairs',
      limit: 500,
    });
    
    // Filter for CHEESE pairs
    const cheesePairs = response.rows.filter(pair =>
      pair.pool1.contract === CHEESE_CONTRACT || pair.pool2.contract === CHEESE_CONTRACT
    );
    
    let totalTVL = 0;
    
    for (const pair of cheesePairs) {
      const pool1 = parseQuantity(pair.pool1.quantity);
      const pool2 = parseQuantity(pair.pool2.quantity);
      
      // If one side is WAX, use WAX price to get USD value
      if (pair.pool1.contract === 'eosio.token' && pool1.symbol === 'WAX') {
        totalTVL += pool1.amount * waxUsdPrice * 2;
      } else if (pair.pool2.contract === 'eosio.token' && pool2.symbol === 'WAX') {
        totalTVL += pool2.amount * waxUsdPrice * 2;
      }
    }
    
    return totalTVL;
  } catch (error) {
    console.warn('Failed to fetch Taco CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchNeftyCheeseTVL(cheeseUsdPrice: number): Promise<number> {
  try {
    // Query CHEESE balance held by swap.nefty directly
    const response = await fetch('https://api.wax.alohaeos.com/v1/chain/get_currency_balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: CHEESE_CONTRACT,
        account: 'swap.nefty',
        symbol: CHEESE_SYMBOL,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to fetch Nefty CHEESE balance');
    
    const balances: string[] = await response.json();
    if (!balances || balances.length === 0) return 0;
    
    const { amount } = parseQuantity(balances[0]);
    // TVL = CHEESE amount × price × 2 (for the paired asset)
    return amount * cheeseUsdPrice * 2;
  } catch (error) {
    console.warn('Failed to fetch Nefty CHEESE TVL:', error);
    return 0;
  }
}

export async function fetchCheeseTotalTVL(waxUsdPrice: number, cheeseUsdPrice: number): Promise<TVLData> {
  const [alcor, defibox, taco, nefty] = await Promise.all([
    fetchAlcorCheeseTVL(),
    fetchDefiboxCheeseTVL(waxUsdPrice),
    fetchTacoCheeseTVL(waxUsdPrice),
    fetchNeftyCheeseTVL(cheeseUsdPrice),
  ]);
  
  const totalUSD = alcor + defibox + taco + nefty;
  const totalWAX = waxUsdPrice > 0 ? totalUSD / waxUsdPrice : 0;
  
  return {
    alcor,
    defibox,
    taco,
    nefty,
    totalUSD,
    totalWAX,
  };
}
