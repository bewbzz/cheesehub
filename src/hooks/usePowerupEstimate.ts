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

interface PowerUpResourceState {
  weight: number;
  adjusted_utilization: number;
  min_price: number;
  max_price: number;
  exponent: number;
  utilization: number;
}

interface PowerUpState {
  cpu: PowerUpResourceState;
  net: PowerUpResourceState;
}

const WAX_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

// Constants for frac-to-resource conversion (from WAX chain analysis)
const CPU_MS_PER_FRAC = 78.45 / 3.45e9;
const NET_BYTES_PER_FRAC = 1.4e9 / 4.2e9;
const POWERUP_FRAC = 1e15; // 10^15 = 100% of resources

async function fetchCheesePrice(): Promise<{ priceInWax: number; usdPrice: number; waxUsdPrice: number }> {
  try {
    // Fetch from Alcor DEX v2 API for accurate system_price
    const response = await fetch("https://wax.alcor.exchange/api/v2/tokens/cheese-cheeseburger");
    const data = await response.json();
    const priceInWax = data.system_price || 0;
    
    // Fetch WAX USD price from CoinGecko
    const waxResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=wax&vs_currencies=usd");
    const waxData = await waxResponse.json();
    const waxUsdPrice = waxData.wax?.usd || 0;
    
    return {
      priceInWax,
      usdPrice: priceInWax * waxUsdPrice,
      waxUsdPrice,
    };
  } catch (error) {
    console.error("Failed to fetch CHEESE price:", error);
    return { priceInWax: 0.0001, usdPrice: 0, waxUsdPrice: 0 };
  }
}

function parseAssetToNumber(assetStr: string): number {
  if (!assetStr) return 0;
  const parts = assetStr.split(" ");
  return parseFloat(parts[0]) || 0;
}

async function fetchPowerupState(): Promise<PowerUpState | null> {
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
        const state = data.rows[0];
        
        const parseResource = (resource: any): PowerUpResourceState => ({
          weight: parseFloat(resource?.weight || "0"),
          adjusted_utilization: parseFloat(resource?.adjusted_utilization || "0"),
          min_price: parseAssetToNumber(resource?.min_price || "0"),
          max_price: parseAssetToNumber(resource?.max_price || "0"),
          exponent: parseFloat(resource?.exponent || "2"),
          utilization: parseFloat(resource?.utilization || "0"),
        });

        return {
          cpu: parseResource(state.cpu),
          net: parseResource(state.net),
        };
      }
    } catch (err) {
      console.error(`Failed to fetch powerup state from ${baseUrl}:`, err);
      continue;
    }
  }

  return null;
}

// Calculate the fee for a given frac using the PowerUp pricing curve
function estimatePowerupFee(
  frac: number,
  weight: number,
  adjustedUtilization: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number {
  if (frac <= 0 || weight <= 0) return 0;
  
  const utilizationIncrease = frac / weight;
  const startUtilization = adjustedUtilization / weight;
  const endUtilization = startUtilization + utilizationIncrease;
  
  // Price curve integration: fee = integral of price(u) du from start to end
  // price(u) = min_price + (max_price - min_price) * u^exponent
  const priceDelta = maxPrice - minPrice;
  
  // Integral of u^exponent = u^(exponent+1) / (exponent+1)
  const exp1 = exponent + 1;
  const startIntegral = Math.pow(startUtilization, exp1) / exp1;
  const endIntegral = Math.pow(endUtilization, exp1) / exp1;
  
  const baseFee = minPrice * utilizationIncrease;
  const curveFee = priceDelta * (endIntegral - startIntegral);
  
  return (baseFee + curveFee) * weight;
}

// Binary search to find the frac that costs a given WAX amount
function findFracForWax(
  waxAmount: number,
  weight: number,
  adjustedUtilization: number,
  minPrice: number,
  maxPrice: number,
  exponent: number
): number {
  if (waxAmount <= 0) return 0;
  
  let low = 0;
  let high = POWERUP_FRAC * 0.1; // Max 10% of total resources per transaction
  let result = 0;
  
  // Binary search for the frac that results in <= waxAmount fee
  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    const fee = estimatePowerupFee(mid, weight, adjustedUtilization, minPrice, maxPrice, exponent);
    
    if (fee <= waxAmount) {
      result = mid;
      low = mid;
    } else {
      high = mid;
    }
    
    // Stop if we've converged
    if (high - low < 1) break;
  }
  
  return result;
}

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

      // Convert CHEESE to WAX
      const cpuWaxAmount = debouncedCpu * priceData.priceInWax;
      const netWaxAmount = debouncedNet * priceData.priceInWax;

      // Find frac for each resource using binary search
      const cpuFrac = findFracForWax(
        cpuWaxAmount,
        powerupState.cpu.weight,
        powerupState.cpu.adjusted_utilization,
        powerupState.cpu.min_price,
        powerupState.cpu.max_price,
        powerupState.cpu.exponent
      );

      const netFrac = findFracForWax(
        netWaxAmount,
        powerupState.net.weight,
        powerupState.net.adjusted_utilization,
        powerupState.net.min_price,
        powerupState.net.max_price,
        powerupState.net.exponent
      );

      // Convert frac to actual resources
      const estimatedCpuMs = cpuFrac * CPU_MS_PER_FRAC;
      const estimatedNetBytes = netFrac * NET_BYTES_PER_FRAC;

      // Calculate utilization percentages
      const cpuUtilization = (powerupState.cpu.adjusted_utilization / powerupState.cpu.weight) * 100;
      const netUtilization = (powerupState.net.adjusted_utilization / powerupState.net.weight) * 100;

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
        powerupDays: 1,
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
