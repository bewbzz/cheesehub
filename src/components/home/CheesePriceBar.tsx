import { useCheesePriceData } from '@/hooks/useCheesePriceData';
import { useCheeseStats } from '@/hooks/useCheeseStats';
import { useCheeseTVL } from '@/hooks/useCheeseTVL';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import waxToken from '@/assets/wax-token.png';

function formatPrice(price: number, decimals: number = 8): string {
  return price.toFixed(decimals);
}

function formatUsdPrice(price: number): string {
  if (price < 0.0001) {
    return price.toFixed(8);
  } else if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

function formatLargeValue(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatWaxValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M WAX`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K WAX`;
  }
  return `${value.toFixed(2)} WAX`;
}

export function CheesePriceBar() {
  const { data: priceData, isLoading: priceLoading, error: priceError } = useCheesePriceData();
  const { data: stats, isLoading: statsLoading } = useCheeseStats();
  
  // Need WAX/USD price for TVL calculation - derive from CHEESE prices
  const waxUsdPrice = priceData && priceData.waxPrice > 0 
    ? priceData.usdPrice / priceData.waxPrice 
    : undefined;
  const cheeseUsdPrice = priceData?.usdPrice;
  const { data: tvlData, isLoading: tvlLoading } = useCheeseTVL(waxUsdPrice, cheeseUsdPrice);

  const isLoading = priceLoading || statsLoading;

  const marketCap = priceData && stats 
    ? stats.circulatingSupply * priceData.usdPrice 
    : 0;

  if (priceError) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-6 mb-2">
      {/* CHEESE/WAX Price */}
      <a
        href="https://alcor.exchange/swap?output=CHEESE-cheeseburger"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2 hover:from-cheese/20 hover:to-cheese-dark/20 transition-colors group"
      >
        <img src={waxToken} alt="WAX" className="w-6 h-6 rounded-full" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">CHEESE/WAX</span>
          {isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="font-semibold text-foreground">
              {formatPrice(priceData?.waxPrice ?? 0, 4)} WAX
            </span>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {/* CHEESE/USD Price */}
      <a
        href="https://wax.alcor.exchange/swap?output=WAXUSDC-eth.token"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2 hover:from-cheese/20 hover:to-cheese-dark/20 transition-colors group"
      >
        <span className="text-lg font-bold text-green-500">$</span>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">CHEESE/USD</span>
          {isLoading ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="font-semibold text-foreground">
              ${formatUsdPrice(priceData?.usdPrice ?? 0)}
            </span>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>

      {/* Market Cap */}
      <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
        <span className="text-lg">📊</span>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Market Cap</span>
          {isLoading ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="font-semibold text-foreground">
              {formatLargeValue(marketCap)}
            </span>
          )}
        </div>
      </div>

      {/* TVL */}
      <div className="flex items-center gap-2 bg-gradient-to-br from-cheese/10 via-background to-cheese-dark/10 border border-cheese/20 rounded-lg px-4 py-2">
        <span className="text-lg">💰</span>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">TVL (All DEXs)</span>
          {tvlLoading || !tvlData ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {formatLargeValue(tvlData.totalUSD)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatWaxValue(tvlData.totalWAX)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
