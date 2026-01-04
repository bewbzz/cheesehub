import { useQuery } from '@tanstack/react-query';

interface AlcorTokenResponse {
  id: string;
  contract: string;
  symbol: string;
  system_price: number;
  usd_price: number;
}

async function fetchWaxPrice(): Promise<number> {
  // Fetch WAX/USD price from Alcor Exchange
  const response = await fetch('https://wax.alcor.exchange/api/v2/tokens');
  
  if (!response.ok) {
    throw new Error('Failed to fetch WAX price data');
  }
  
  const tokens: AlcorTokenResponse[] = await response.json();
  
  // Find WAX token (system token has usd_price directly)
  // WAX is the base currency, so we need to get the USD rate from another source
  // Use a stablecoin pair or the API's reported price
  
  // Alcor reports USD prices relative to WAX, so we need to find the WAX/USD rate
  // USDT or USDC token will give us the inverse rate
  const usdt = tokens.find(t => t.symbol === 'WAXUSDT' || t.symbol === 'USDT');
  if (usdt && usdt.system_price > 0) {
    // system_price is how much WAX per USDT, so 1/price = WAX in USD
    return 1 / usdt.system_price;
  }
  
  // Fallback: try to get from a different endpoint
  try {
    const waxResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=wax&vs_currencies=usd');
    if (waxResponse.ok) {
      const data = await waxResponse.json();
      return data.wax?.usd || 0.03; // Fallback to approximate
    }
  } catch {
    // Ignore and use fallback
  }
  
  return 0.03; // Approximate fallback
}

export function useWaxPrice() {
  return useQuery<number>({
    queryKey: ['wax-usd-price'],
    queryFn: fetchWaxPrice,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute
    retry: 2,
  });
}
