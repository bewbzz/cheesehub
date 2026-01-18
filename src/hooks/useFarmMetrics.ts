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
  stakingSlotsAvailable: number | null;
  maxCapacity: number | null;
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
    let minCapacity: number | null = null;
    let totalDailyEmissionsUsd: number | null = null;

    // Calculate payouts remaining until expiration
    const payoutsRemaining = farm.payout_interval > 0 
      ? Math.ceil((farm.expiration - now) / farm.payout_interval)
      : 0;

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

      // Calculate staking capacity based on reward per payout
      // Capacity = pool_balance / (reward_per_payout * payouts_remaining)
      if (hourlyAmount > 0 && payoutsRemaining > 0 && farm.payout_interval > 0) {
        const rewardPerPayout = hourlyAmount * (farm.payout_interval / 3600);
        const capacity = Math.floor(balance / (rewardPerPayout * payoutsRemaining));
        if (minCapacity === null || capacity < minCapacity) {
          minCapacity = capacity;
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

    // Staking slots available = capacity - currently staked
    const stakingSlotsAvailable = minCapacity !== null 
      ? Math.max(0, minCapacity - stakedCount) 
      : null;

    return {
      rewardsPerNft,
      totalDailyEmissions,
      totalDailyEmissionsUsd,
      stakingSlotsAvailable,
      maxCapacity: minCapacity,
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
