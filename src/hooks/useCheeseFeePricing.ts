import { useMemo } from "react";
import { useAlcorTokenPrices } from "./useAlcorTokenPrices";
import {
  CHEESE_TOKEN_CONTRACT,
  CHEESE_TOKEN_SYMBOL,
  CHEESE_DISCOUNT,
  WAX_FEE_AMOUNT,
  calculateDiscountedCheeseAmount,
  formatCheeseAmount,
  formatCheeseDisplay,
} from "@/lib/cheeseFees";

export interface CheeseFeePricing {
  /** Raw discounted CHEESE amount */
  cheeseAmount: number;
  /** Formatted for transactions (e.g., "41840.50000000 CHEESE") */
  formattedForTx: string;
  /** Formatted for display (e.g., "41,841 CHEESE") */
  displayAmount: string;
  /** Savings percentage display (e.g., "Save 20%!") */
  savingsDisplay: string;
  /** Price of 1 CHEESE in WAX */
  cheeseWaxPrice: number;
  /** WAX equivalent (250 WAX) */
  waxEquivalent: number;
  /** Is price data loading */
  isLoading: boolean;
  /** Is price data available */
  isAvailable: boolean;
  /** Refetch prices */
  refetch: () => void;
}

/**
 * Hook to calculate CHEESE fee pricing with 20% discount
 * Uses Alcor exchange prices for real-time CHEESE/WAX rate
 */
export function useCheeseFeePricing(waxFee: number = WAX_FEE_AMOUNT): CheeseFeePricing {
  const { data: prices, isLoading, refetch } = useAlcorTokenPrices();

  const pricing = useMemo(() => {
    // Get CHEESE price from Alcor
    const priceKey = `${CHEESE_TOKEN_CONTRACT}:${CHEESE_TOKEN_SYMBOL}`;
    const cheeseWaxPrice = prices?.get(priceKey) ?? 0;

    // Calculate discounted amount
    const cheeseAmount = calculateDiscountedCheeseAmount(waxFee, cheeseWaxPrice);

    // Format for transaction (full precision)
    const formattedForTx = formatCheeseAmount(cheeseAmount);

    // Format for display (rounded, with commas)
    const displayAmount = `${formatCheeseDisplay(cheeseAmount)} CHEESE`;

    // Savings display
    const savingsPercent = Math.round(CHEESE_DISCOUNT * 100);
    const savingsDisplay = `Save ${savingsPercent}%!`;

    return {
      cheeseAmount,
      formattedForTx,
      displayAmount,
      savingsDisplay,
      cheeseWaxPrice,
      waxEquivalent: waxFee,
      isLoading,
      isAvailable: cheeseWaxPrice > 0,
      refetch,
    };
  }, [prices, waxFee, isLoading, refetch]);

  return pricing;
}
