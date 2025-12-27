import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export interface PowerUpEstimate {
  cheesePriceInWax: number;
  cheeseUsdPrice: number;
  waxUsdPrice: number;
  cpuWaxAmount: number;
  netWaxAmount: number;
  estimatedCpuMs: number;
  estimatedNetBytes: number;
  cpuUtilization: number;
  netUtilization: number;
  powerupDays: number;
}

interface UsePowerupEstimateResult {
  estimate: PowerUpEstimate | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface PowerUpStateRow {
  version: number;
  net: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: number;
    decay_secs: number;
    min_price: string;
    max_price: string;
    utilization: string;
    adjusted_utilization: string;
    utilization_timestamp: string;
  };
  cpu: {
    weight: string;
    weight_ratio: string;
    assumed_stake_weight: string;
    initial_weight_ratio: string;
    target_weight_ratio: string;
    initial_timestamp: string;
    target_timestamp: string;
    exponent: number;
    decay_secs: number;
    min_price: string;
    max_price: string;
    utilization: string;
    adjusted_utilization: string;
    utilization_timestamp: string;
  };
  powerup_days: number;
  min_powerup_fee: string;
}

const WAX_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

const POWERUP_FRAC = 1e15;

// Constants for frac-to-resource conversion (from WAX chain analysis)
const CPU_MS_PER_FRAC = 78.45 / 3.45e9;  // ~22.7 microseconds per frac unit
const NET_BYTES_PER_FRAC = 1.4e9 / 4.2e9;  // Estimated from typical NET transactions

// Parse price values (WAX has 8 decimals, prices are in string format like "8750.00000000 WAX")
const parsePriceWax = (priceStr: string): number => {
  const match = priceStr.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) * 1e8 : 0; // Convert to 8-decimal units
};

async function fetchCheesePrice(): Promise<{ priceInWax: number; usdPrice: number; waxUsdPrice: number }> {
  try {
    // Fetch from Alcor DEX v2 API for accurate system_price
    const response = await fetch("https://wax.alcor.exchange/api/v2/tokens/cheese-cheeseburger");
    const data = await response.json();
    
    // Use system_price directly - it's already the CHEESE/WAX rate
    const cheeseUsdPrice = data.usd_price || 0;
    const priceInWax = data.system_price || 0;
    const waxUsdPrice = priceInWax > 0 ? cheeseUsdPrice / priceInWax : 0;
    
    return {
      priceInWax,
      usdPrice: cheeseUsdPrice,
      waxUsdPrice,
    };
  } catch (error) {
    console.error("Failed to fetch CHEESE price:", error);
    return { priceInWax: 0.0001, usdPrice: 0, waxUsdPrice: 0 };
  }
}

async function fetchPowerupState(): Promise<PowerUpStateRow | null> {
  for (const baseUrl of WAX_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "eosio",
          scope: "0",
          table: "powup.state",
          json: true,
          limit: 1,
        }),
      });

      if (!response.ok) continue;
      const data = await response.json();

      if (data.rows && data.rows.length > 0) {
        return data.rows[0] as PowerUpStateRow;
      }
    } catch (err) {
      console.error(`Failed to fetch powerup state from ${baseUrl}:`, err);
      continue;
    }
  }

  return null;
}

// Estimate PowerUp fee for a given frac (replicates eosio.system calc_powerup_fee)
const estimatePowerupFee = (
  frac: number,
  weight: number,
  adjustedUtil: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number => {
  if (frac <= 0) return 0;

  // Amount of resource weight being purchased
  const amount = (frac * weight) / POWERUP_FRAC;
  if (amount <= 0) return 0;

  // Normalize utilization to 0-1 range
  const startU = adjustedUtil / weight;
  const endU = (adjustedUtil + amount) / weight;

  // Coefficient for polynomial part
  const coefficient = (maxPrice - minPrice) / exponent;

  // Calculate fee using integral formula
  const fee = minPrice * (endU - startU) +
              coefficient * (Math.pow(endU, exponent) - Math.pow(startU, exponent));

  return Math.ceil(fee);
};

// Binary search to find frac that costs <= target_fee
const findFracForWax = (
  targetWax: number,  // WAX amount in regular units (not 8-decimal)
  weight: number,
  adjustedUtil: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number => {
  const targetFee = targetWax * 1e8; // Convert to 8-decimal units
  if (targetFee <= 0) return 0;

  let low = 0;
  let high = POWERUP_FRAC;

  while (low < high) {
    const mid = low + Math.floor((high - low + 1) / 2);
    const estimatedFee = estimatePowerupFee(mid, weight, adjustedUtil, minPrice, maxPrice, exponent);

    if (estimatedFee <= targetFee) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  // Apply 5% safety margin
  return Math.floor(low * 0.95);
};

export const usePowerupEstimate = (
  cpuCheeseAmount: number,
  netCheeseAmount: number
): UsePowerupEstimateResult => {
  const [estimate, setEstimate] = useState<PowerUpEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedCpu = useDebounce(cpuCheeseAmount, 500);
  const debouncedNet = useDebounce(netCheeseAmount, 500);

  const fetchEstimate = useCallback(async () => {
    if (debouncedCpu <= 0 && debouncedNet <= 0) {
      setEstimate(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [priceData, powerupState] = await Promise.all([
        fetchCheesePrice(),
        fetchPowerupState(),
      ]);

      if (!powerupState) {
        throw new Error("Failed to fetch PowerUp state");
      }

      // Calculate WAX equivalents
      const cpuWaxAmount = (debouncedCpu || 0) * priceData.priceInWax;
      const netWaxAmount = (debouncedNet || 0) * priceData.priceInWax;

      // Parse PowerUp state values
      const cpuWeight = parseFloat(powerupState.cpu.weight);
      const netWeight = parseFloat(powerupState.net.weight);
      const cpuAdjustedUtil = parseFloat(powerupState.cpu.adjusted_utilization);
      const netAdjustedUtil = parseFloat(powerupState.net.adjusted_utilization);

      // Parse price values with 8-decimal conversion
      const cpuMinPrice = parsePriceWax(powerupState.cpu.min_price);
      const cpuMaxPrice = parsePriceWax(powerupState.cpu.max_price);
      const netMinPrice = parsePriceWax(powerupState.net.min_price);
      const netMaxPrice = parsePriceWax(powerupState.net.max_price);
      const cpuExponent = powerupState.cpu.exponent;
      const netExponent = powerupState.net.exponent;

      // For display, utilization as percentage (0-100 scale)
      const cpuU0 = cpuWeight > 0 ? cpuAdjustedUtil / cpuWeight : 0;
      const netU0 = netWeight > 0 ? netAdjustedUtil / netWeight : 0;
      const cpuUtilization = cpuU0 * 100;
      const netUtilization = netU0 * 100;

      // Calculate frac for each resource using binary search
      const cpuFrac = findFracForWax(cpuWaxAmount, cpuWeight, cpuAdjustedUtil, cpuMinPrice, cpuMaxPrice, cpuExponent);
      const netFrac = findFracForWax(netWaxAmount, netWeight, netAdjustedUtil, netMinPrice, netMaxPrice, netExponent);

      // Convert frac to estimated resources
      const estimatedCpuMs = cpuFrac * CPU_MS_PER_FRAC;
      const estimatedNetBytes = netFrac * NET_BYTES_PER_FRAC;

      console.log(`CPU: ${cpuWaxAmount.toFixed(4)} WAX → ${cpuFrac.toExponential(2)} frac → ${estimatedCpuMs.toFixed(2)}ms`);
      console.log(`NET: ${netWaxAmount.toFixed(4)} WAX → ${netFrac.toExponential(2)} frac → ${estimatedNetBytes.toFixed(0)} bytes`);

      setEstimate({
        cheesePriceInWax: priceData.priceInWax,
        cheeseUsdPrice: priceData.usdPrice,
        waxUsdPrice: priceData.waxUsdPrice,
        cpuWaxAmount,
        netWaxAmount,
        estimatedCpuMs,
        estimatedNetBytes,
        cpuUtilization,
        netUtilization,
        powerupDays: powerupState.powerup_days,
      });
    } catch (err) {
      console.error("Error fetching estimate:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch estimate");
      setEstimate(null);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedCpu, debouncedNet]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  return {
    estimate,
    isLoading,
    error,
    refetch: fetchEstimate,
  };
};
