import { useQuery } from '@tanstack/react-query';
import {
  fetchBurnerConfig,
  fetchBurnerStats,
  fetchFeeFeeConfig,
  fetchBannadConfig,
  fetchBannadAdmins,
  fetchPowerzStats,
  fetchPoolReserves,
  calcPriceFromReserves,
  calcDeviation,
  parseAssetAmount,
  type BurnerConfig,
  type BurnerStats,
  type FeeFeeConfig,
  type BannadConfig,
  type BannadAdmin,
  type PowerzStats,
} from '@/lib/adminData';

export interface PoolPriceData {
  pool1252: {
    waxPerCheese: number; // WAX per 1 CHEESE
    cheesePerWax: number;
  } | null;
  pool1236: {
    waxdaoPerWax: number; // WAXDAO per 1 WAX
    waxPerWaxdao: number;
  } | null;
}

export interface ContractConfigsData {
  burnerConfig: BurnerConfig | null;
  burnerStats: BurnerStats | null;
  feefeeConfig: FeeFeeConfig | null;
  bannadConfig: BannadConfig | null;
  bannadAdmins: BannadAdmin[];
  powerzStats: PowerzStats | null;
  poolPrices: PoolPriceData;
  deviations: {
    cheeseWax: number | null; // % deviation
    waxdaoWax: number | null;
    bannadCheese: number | null;
  };
}

async function fetchAllConfigs(): Promise<ContractConfigsData> {
  const [
    burnerConfig,
    burnerStats,
    feefeeConfig,
    bannadConfig,
    bannadAdmins,
    powerzStats,
    pool1252,
    pool1236,
  ] = await Promise.all([
    fetchBurnerConfig(),
    fetchBurnerStats(),
    fetchFeeFeeConfig(),
    fetchBannadConfig(),
    fetchBannadAdmins(),
    fetchPowerzStats(),
    fetchPoolReserves(1252),
    fetchPoolReserves(1236),
  ]);

  // Pool 1252: CHEESE/WAX — need to figure out which token is which
  let pool1252Prices: PoolPriceData['pool1252'] = null;
  if (pool1252) {
    const prices = calcPriceFromReserves(pool1252);
    // tokenA is WAX (eosio.token), tokenB is CHEESE (cheeseburger) typically
    const aIsWax = pool1252.tokenA.contract === 'eosio.token';
    if (aIsWax) {
      // priceAinB = CHEESE per WAX, priceBinA = WAX per CHEESE
      pool1252Prices = { waxPerCheese: prices.priceBinA, cheesePerWax: prices.priceAinB };
    } else {
      pool1252Prices = { waxPerCheese: prices.priceAinB, cheesePerWax: prices.priceBinA };
    }
  }

  // Pool 1236: WAX/WAXDAO
  let pool1236Prices: PoolPriceData['pool1236'] = null;
  if (pool1236) {
    const prices = calcPriceFromReserves(pool1236);
    const aIsWax = pool1236.tokenA.contract === 'eosio.token';
    if (aIsWax) {
      // priceAinB = WAXDAO per WAX
      pool1236Prices = { waxdaoPerWax: prices.priceAinB, waxPerWaxdao: prices.priceBinA };
    } else {
      pool1236Prices = { waxdaoPerWax: prices.priceBinA, waxPerWaxdao: prices.priceAinB };
    }
  }

  // Calculate deviations
  const cheeseWaxDev = feefeeConfig && pool1252Prices
    ? calcDeviation(pool1252Prices.waxPerCheese, feefeeConfig.wax_per_cheese_baseline)
    : null;
  const waxdaoWaxDev = feefeeConfig && pool1236Prices
    ? calcDeviation(pool1236Prices.waxdaoPerWax, feefeeConfig.waxdao_per_wax_baseline)
    : null;
  const bannadDev = bannadConfig && pool1252Prices
    ? calcDeviation(pool1252Prices.waxPerCheese, bannadConfig.wax_per_cheese_baseline)
    : null;

  return {
    burnerConfig,
    burnerStats,
    feefeeConfig,
    bannadConfig,
    bannadAdmins,
    powerzStats,
    poolPrices: { pool1252: pool1252Prices, pool1236: pool1236Prices },
    deviations: {
      cheeseWax: cheeseWaxDev,
      waxdaoWax: waxdaoWaxDev,
      bannadCheese: bannadDev,
    },
  };
}

export function useContractConfigs(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-contract-configs'],
    queryFn: fetchAllConfigs,
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
