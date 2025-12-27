import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { fetchWithFallback } from "@/lib/fetchWithFallback";
import { WAX_CHAIN, CHEESE_CONFIG } from "@/lib/waxConfig";

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

const WAX_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

const parseAsset = (assetStr: string): number => {
  if (!assetStr) return 0;
  const parts = assetStr.split(" ");
  return parseFloat(parts[0]) || 0;
};

async function fetchCheesePrice(): Promise<{ priceInWax: number; usdPrice: number; waxUsdPrice: number }> {
  try {
    // Fetch from Alcor DEX
    const response = await fetch("https://wax.alcor.exchange/api/markets/193");
    const data = await response.json();
    const priceInWax = data.last_price || 0;
    
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

async function fetchPowerupState(): Promise<{
  cpuFrac: number;
  netFrac: number;
  cpuWeight: number;
  netWeight: number;
}> {
  for (const baseUrl of WAX_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "eosio",
          scope: "",
          table: "powup.state",
          json: true,
          limit: 1,
        }),
      });

      if (!response.ok) continue;
      const data = await response.json();

      if (data.rows && data.rows.length > 0) {
        const state = data.rows[0];
        return {
          cpuFrac: parseFloat(state.cpu?.utilization || 0),
          netFrac: parseFloat(state.net?.utilization || 0),
          cpuWeight: parseFloat(state.cpu?.weight || 1),
          netWeight: parseFloat(state.net?.weight || 1),
        };
      }
    } catch (err) {
      console.error(`Failed to fetch powerup state from ${baseUrl}:`, err);
      continue;
    }
  }

  return { cpuFrac: 0.5, netFrac: 0.1, cpuWeight: 1, netWeight: 1 };
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

      const cpuWaxAmount = debouncedCpu * priceData.priceInWax;
      const netWaxAmount = debouncedNet * priceData.priceInWax;

      // Estimate resources based on WAX amounts and network utilization
      // These are rough estimates - actual values depend on network conditions
      const cpuMsPerWax = 10 / (1 + powerupState.cpuFrac); // Base ~10ms per WAX, decreases with utilization
      const netBytesPerWax = 50000 / (1 + powerupState.netFrac); // Base ~50KB per WAX

      const estimatedCpuMs = cpuWaxAmount * cpuMsPerWax;
      const estimatedNetBytes = netWaxAmount * netBytesPerWax;

      setEstimate({
        cheesePriceInWax: priceData.priceInWax,
        cheeseUsdPrice: priceData.usdPrice,
        waxUsdPrice: priceData.waxUsdPrice,
        cpuWaxAmount,
        netWaxAmount,
        estimatedCpuMs,
        estimatedNetBytes,
        cpuUtilization: powerupState.cpuFrac * 100,
        netUtilization: powerupState.netFrac * 100,
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
