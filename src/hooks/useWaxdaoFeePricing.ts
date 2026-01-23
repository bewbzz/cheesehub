import { useMemo } from "react";
import { useAlcorTokenPrices } from "./useAlcorTokenPrices";
import { CHEESE_TOKEN_CONTRACT, CHEESE_TOKEN_SYMBOL } from "@/lib/cheeseFees";

// WAXDAO token configuration
const WAXDAO_CONTRACT = "token.waxdao";
const WAXDAO_SYMBOL = "WAXDAO";
const WAXDAO_PRECISION = 8;

// Fee configuration - contract calculates based on CHEESE sent
// No buffer needed here - contract handles its own buffer (2%)
const WAXDAO_BUFFER = 0.02; // 2% buffer to match contract tolerance

export interface WaxdaoFeePricing {
  /** Raw WAXDAO amount with buffer */
  waxdaoAmount: number;
  /** Formatted for transactions (e.g., "6350.12345678 WAXDAO") */
  formattedForTx: string;
  /** Formatted for display (e.g., "6,351 WAXDAO") */
  displayAmount: string;
  /** Price of 1 WAXDAO in WAX */
  waxdaoWaxPrice: number;
  /** Price of 1 CHEESE in WAXDAO (derived) */
  cheeseWaxdaoPrice: number;
  /** Is price data loading */
  isLoading: boolean;
  /** Is price data available */
  isAvailable: boolean;
  /** Refetch prices */
  refetch: () => void;
}

/**
 * Hook to calculate WAXDAO amount that contract will return for given CHEESE
 * Uses same calculation as contract: CHEESE amount × (CHEESE/WAX ÷ WAXDAO/WAX)
 * 
 * This matches the contract's Pool 8017 direct conversion
 */
export function useWaxdaoFeePricing(cheeseAmount?: number): WaxdaoFeePricing {
  const { data: prices, isLoading, refetch } = useAlcorTokenPrices();

  return useMemo(() => {
    // Get both prices from Alcor
    const cheeseKey = `${CHEESE_TOKEN_CONTRACT}:${CHEESE_TOKEN_SYMBOL}`;
    const waxdaoKey = `${WAXDAO_CONTRACT}:${WAXDAO_SYMBOL}`;
    
    const cheeseWaxPrice = prices?.get(cheeseKey) ?? 0; // WAX per CHEESE
    const waxdaoWaxPrice = prices?.get(waxdaoKey) ?? 0; // WAX per WAXDAO

    if (cheeseWaxPrice <= 0 || waxdaoWaxPrice <= 0) {
      return {
        waxdaoAmount: 0,
        formattedForTx: "",
        displayAmount: "",
        waxdaoWaxPrice: 0,
        cheeseWaxdaoPrice: 0,
        isLoading,
        isAvailable: false,
        refetch,
      };
    }

    // Calculate CHEESE/WAXDAO price (how many WAXDAO per 1 CHEESE)
    // If 1 CHEESE = 1.47 WAX and 1 WAXDAO = 0.035 WAX
    // Then 1 CHEESE = 1.47 / 0.035 = 42 WAXDAO
    const cheeseWaxdaoPrice = cheeseWaxPrice / waxdaoWaxPrice;
    
    // Calculate WAXDAO amount if cheeseAmount provided
    // Otherwise just return the rates
    let waxdaoAmount = 0;
    if (cheeseAmount && cheeseAmount > 0) {
      // Match contract calculation: cheese_value * waxdao_per_cheese
      waxdaoAmount = cheeseAmount * cheeseWaxdaoPrice;
      // Add buffer for slippage tolerance
      waxdaoAmount = waxdaoAmount * (1 + WAXDAO_BUFFER);
    }

    return {
      waxdaoAmount,
      formattedForTx: waxdaoAmount > 0 ? `${waxdaoAmount.toFixed(WAXDAO_PRECISION)} WAXDAO` : "",
      displayAmount: waxdaoAmount > 0 ? `${Math.ceil(waxdaoAmount).toLocaleString()} WAXDAO` : "",
      waxdaoWaxPrice,
      cheeseWaxdaoPrice,
      isLoading,
      isAvailable: true,
      refetch,
    };
  }, [prices, cheeseAmount, isLoading, refetch]);
}
