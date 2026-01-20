import { useMemo } from "react";
import { useAlcorTokenPrices } from "./useAlcorTokenPrices";

// WAXDAO token configuration
const WAXDAO_CONTRACT = "token.waxdao";
const WAXDAO_SYMBOL = "WAXDAO";
const WAXDAO_PRECISION = 8;

// Fee configuration
const WAX_FEE = 250; // Standard fee in WAX
const WAXDAO_DISCOUNT = 0.20; // 20% discount when paying with WAXDAO
const SAFETY_BUFFER = 0.005; // 0.5% buffer for price drift

export interface WaxdaoFeePricing {
  /** Raw WAXDAO amount with buffer */
  waxdaoAmount: number;
  /** Formatted for transactions (e.g., "6350.12345678 WAXDAO") */
  formattedForTx: string;
  /** Formatted for display (e.g., "6,351 WAXDAO") */
  displayAmount: string;
  /** Price of 1 WAXDAO in WAX */
  waxdaoWaxPrice: number;
  /** Is price data loading */
  isLoading: boolean;
  /** Is price data available */
  isAvailable: boolean;
  /** Refetch prices */
  refetch: () => void;
}

/**
 * Hook to calculate WAXDAO fee pricing using WaxDAO's formula
 * Uses Alcor exchange prices for real-time WAXDAO/WAX rate
 * 
 * Formula: (250 WAX / WAXDAO_price) * 0.80 + 0.5% buffer
 */
export function useWaxdaoFeePricing(): WaxdaoFeePricing {
  const { data: prices, isLoading, refetch } = useAlcorTokenPrices();

  return useMemo(() => {
    // Get WAXDAO price from Alcor
    const priceKey = `${WAXDAO_CONTRACT}:${WAXDAO_SYMBOL}`;
    const waxdaoWaxPrice = prices?.get(priceKey) ?? 0;

    if (waxdaoWaxPrice <= 0) {
      return {
        waxdaoAmount: 0,
        formattedForTx: "",
        displayAmount: "",
        waxdaoWaxPrice: 0,
        isLoading,
        isAvailable: false,
        refetch,
      };
    }

    // WaxDAO formula: (250 WAX / price) * 0.80
    const baseAmount = WAX_FEE / waxdaoWaxPrice;
    const discountedAmount = baseAmount * (1 - WAXDAO_DISCOUNT);
    
    // Add safety buffer to prevent failures from price drift
    const finalAmount = discountedAmount * (1 + SAFETY_BUFFER);

    return {
      waxdaoAmount: finalAmount,
      formattedForTx: `${finalAmount.toFixed(WAXDAO_PRECISION)} WAXDAO`,
      displayAmount: `${Math.ceil(finalAmount).toLocaleString()} WAXDAO`,
      waxdaoWaxPrice,
      isLoading,
      isAvailable: true,
      refetch,
    };
  }, [prices, isLoading, refetch]);
}
