import { useMemo } from 'react';
import { FarmInfo, RewardPool } from '@/lib/farm';
import { TokenPriceMap } from './useAlcorTokenPrices';
import { useWaxPrice } from './useWaxPrice';

export interface RewardMetric {
  symbol: string;
  contract: string;
  amountPerHour: number;
  amountPerDay: number;
  usdPerDay: number | null;
  precision: number;
}

export interface FarmMetrics {
  rewardsPerNft: RewardMetric[];
  totalDailyEmissions: RewardMetric[];
  totalDailyEmissionsUsd: number | null;
  poolRunwayDays: number | null;
  stakedCount: number;
  isActive: boolean;
}

function parseTokenAmount(amountStr: string): { amount: number; symbol: string; precision: number } {
  // Format: "123.4567 TOKEN"
  const parts = amountStr.trim().split(' ');
  if (parts.length !== 2) {
    return { amount: 0, symbol: '', precision: 0 };
  }
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1];
  const decimalPart = parts[0].split('.')[1];
  const precision = decimalPart ? decimalPart.length : 0;
  return { amount, symbol, precision };
}

function getTokenPrice(contract: string, symbol: string, tokenPrices: TokenPriceMap | undefined, waxPrice: number | undefined): number | null {
  if (!tokenPrices || !waxPrice) return null;
  
  // WAX is always 1 WAX
  if (symbol === 'WAX' && contract === 'eosio.token') {
    return waxPrice;
  }
  
  // Look up in Alcor prices (prices are in WAX)
  const key = `${contract}:${symbol}`;
  const priceInWax = tokenPrices.get(key);
  
  if (priceInWax !== undefined) {
    return priceInWax * waxPrice;
  }
  
  return null;
}

export function useFarmMetrics(
  farm: FarmInfo | undefined,
  tokenPrices: TokenPriceMap | undefined
): FarmMetrics | null {
  const { data: waxPrice } = useWaxPrice();

  return useMemo(() => {
    if (!farm) return null;

    const now = Math.floor(Date.now() / 1000);
    const isActive = farm.status !== 0 && farm.expiration > now;
    const stakedCount = farm.staked_count || 0;

    // Calculate total hourly emissions from reward pools
    const totalDailyEmissions: RewardMetric[] = [];
    const rewardsPerNft: RewardMetric[] = [];
    let minRunwayDays: number | null = null;
    let totalDailyEmissionsUsd: number | null = null;

    for (const pool of farm.reward_pools) {
      // Parse total_hourly_reward if available
      let hourlyAmount = 0;
      let precision = pool.precision || 4;

      if (pool.total_hourly_reward) {
        const parsed = parseTokenAmount(pool.total_hourly_reward);
        hourlyAmount = parsed.amount;
        precision = parsed.precision || precision;
      }

      const dailyAmount = hourlyAmount * 24;
      const balance = parseFloat(pool.balance) || 0;

      // Calculate runway
      if (hourlyAmount > 0) {
        const runwayHours = balance / hourlyAmount;
        const runwayDays = runwayHours / 24;
        if (minRunwayDays === null || runwayDays < minRunwayDays) {
          minRunwayDays = runwayDays;
        }
      }

      // Get USD price
      const usdPrice = getTokenPrice(pool.contract, pool.symbol, tokenPrices, waxPrice);
      const dailyUsd = usdPrice !== null ? dailyAmount * usdPrice : null;

      if (dailyUsd !== null) {
        totalDailyEmissionsUsd = (totalDailyEmissionsUsd || 0) + dailyUsd;
      }

      totalDailyEmissions.push({
        symbol: pool.symbol,
        contract: pool.contract,
        amountPerHour: hourlyAmount,
        amountPerDay: dailyAmount,
        usdPerDay: dailyUsd,
        precision,
      });

      // Calculate per-NFT rewards
      if (stakedCount > 0) {
        const perNftHourly = hourlyAmount / stakedCount;
        const perNftDaily = dailyAmount / stakedCount;
        const perNftUsd = dailyUsd !== null ? dailyUsd / stakedCount : null;

        rewardsPerNft.push({
          symbol: pool.symbol,
          contract: pool.contract,
          amountPerHour: perNftHourly,
          amountPerDay: perNftDaily,
          usdPerDay: perNftUsd,
          precision,
        });
      }
    }

    return {
      rewardsPerNft,
      totalDailyEmissions,
      totalDailyEmissionsUsd,
      poolRunwayDays: minRunwayDays,
      stakedCount,
      isActive,
    };
  }, [farm, tokenPrices, waxPrice]);
}

export function formatMetricAmount(amount: number, precision: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K`;
  } else if (amount < 0.0001 && amount > 0) {
    return amount.toExponential(2);
  }
  return amount.toFixed(Math.min(precision, 4));
}

export function formatUsdValue(usd: number | null): string {
  if (usd === null) return '';
  if (usd < 0.01) {
    return `≈ $${usd.toFixed(6)}`;
  } else if (usd < 1) {
    return `≈ $${usd.toFixed(4)}`;
  }
  return `≈ $${usd.toFixed(2)}`;
}
