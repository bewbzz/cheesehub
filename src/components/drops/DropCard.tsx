import { useState, useCallback, useEffect, useRef } from "react";
import { ShoppingCart, Coins, ImageOff, Lock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { NFTDrop } from "@/types/drop";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";
import { markDropAsFailed } from "@/hooks/useEnrichDrops";
import cheeseLogo from "@/assets/cheese-logo.png";

const CURRENCY_LOGOS: Record<string, string> = {
  CHEESE: cheeseLogo,
};

// IPFS gateway fallbacks for image loading
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

const IMAGE_LOAD_TIMEOUT = 8000; // 8 seconds

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '').split('/')[0];
  }
  // Handle /ipfs/ paths - capture hash and any path after it
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
  if (ipfsMatch) return ipfsMatch[1];
  // Handle bare CID (Qm... or bafy...)
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  // Original patterns for URLs
  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getCurrencyDisplay(drop: NFTDrop): { logo: string | null; symbol: string } {
  const currency = drop.currency || (drop.listingPrice?.split(' ')[1]) || 'WAX';
  return {
    logo: CURRENCY_LOGOS[currency] || null,
    symbol: currency,
  };
}

interface DropCardProps {
  drop: NFTDrop;
  isImageCached?: boolean;
  onImageLoaded?: (dropId: string) => void;
}

export function DropCard({ drop, isImageCached, onImageLoaded }: DropCardProps) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(isImageCached ?? false);
  const [currentImageUrl, setCurrentImageUrl] = useState(drop.image);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mintedPercent = ((drop.totalSupply - drop.remaining) / drop.totalSupply) * 100;

  // Reset state when drop image changes
  useEffect(() => {
    // If image is still a placeholder after enrichment, show error immediately
    const isPlaceholder = !drop.image || drop.image === '/placeholder.svg' || drop.image.includes('placeholder');
    if (isPlaceholder) {
      setImageError(true);
      markDropAsFailed(drop.id);
      return;
    }
    
    setImageError(false);
    setImageLoaded(isImageCached ?? false);
    setCurrentImageUrl(drop.image);
    setGatewayIndex(0);
    setRetryCount(0);
  }, [drop.image, drop.id, isImageCached]);

  // Timeout fallback - if image doesn't load in time, try next gateway
  // Skip timeout if already cached
  useEffect(() => {
    if (imageError || imageLoaded || isImageCached) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = setTimeout(() => {
      if (!imageLoaded && !imageError) {
        handleImageError();
      }
    }, IMAGE_LOAD_TIMEOUT);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [currentImageUrl, imageLoaded, imageError, isImageCached]);

  const handleImageError = useCallback(() => {
    const hash = extractIpfsHash(currentImageUrl);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setCurrentImageUrl(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
      setImageLoaded(false);
    } else {
      setImageError(true);
      // Mark this drop as failed so refresh button can retry it
      markDropAsFailed(drop.id);
    }
  }, [currentImageUrl, gatewayIndex, drop.id]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Check for blank/transparent images that "loaded" but have no content
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      handleImageError();
    } else {
      setImageLoaded(true);
      onImageLoaded?.(drop.id);
    }
  }, [handleImageError, drop.id, onImageLoaded]);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageError(false);
    setImageLoaded(false);
    setGatewayIndex(0);
    setRetryCount(prev => prev + 1);
    setCurrentImageUrl(drop.image);
  }, [drop.image]);

  // Add cache-busting param on retry
  const displayImageUrl = retryCount > 0 
    ? `${currentImageUrl}${currentImageUrl.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : currentImageUrl;

  // Determine if this is a free auth-required drop
  const isFreeAuthDrop = drop.authRequired && (drop.isFree || drop.price === 0);

  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover-cheese-glow">
      <Link to={`/drops/${drop.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted/50">
          {imageError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <ImageOff className="h-12 w-12 text-muted-foreground/50" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              <img
                src={displayImageUrl}
                alt={drop.name}
                className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onError={handleImageError}
                onLoad={handleImageLoad}
                loading="lazy"
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          
          {/* Auth required indicator */}
          {drop.authRequired && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-sm px-2 py-1 text-xs font-medium text-black">
              <Lock className="h-3 w-3" />
              {isFreeAuthDrop ? 'Holders Only' : 'Auth Required'}
            </div>
          )}
          
          {/* Price overlay badge */}
          <div className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full backdrop-blur-sm px-2.5 py-1 border shadow-lg ${
            isFreeAuthDrop 
              ? 'bg-green-500/90 border-green-400/50' 
              : 'bg-background/90 border-border/50'
          }`}>
            {isFreeAuthDrop ? (
              <span className="font-display text-sm font-bold text-white">
                FREE
              </span>
            ) : (
              <>
                {(() => {
                  const { logo, symbol } = getCurrencyDisplay(drop);
                  return logo ? (
                    <img src={logo} alt={symbol} className="h-4 w-4" />
                  ) : (
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  );
                })()}
                <span className="font-display text-sm font-bold text-primary">
                  {drop.price.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getCurrencyDisplay(drop).symbol}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      <CardContent className="p-4">
        {drop.collectionName && (
          <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {drop.collectionName}
          </span>
        )}
        <Link to={`/drops/${drop.id}`}>
          <h3 className="font-display text-lg font-semibold text-foreground transition-colors hover:text-primary">
            {drop.name}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {drop.description}
        </p>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Minted</span>
            <span className="font-medium text-foreground">
              {drop.totalSupply - drop.remaining} / {drop.totalSupply}
            </span>
          </div>
          <Progress value={mintedPercent} className="h-2 bg-muted" />
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/50 p-4">
        <div className="flex items-center gap-1.5">
          {(() => {
            const { logo, symbol } = getCurrencyDisplay(drop);
            return logo ? (
              <img src={logo} alt={symbol} className="h-6 w-6" />
            ) : (
              <Coins className="h-5 w-5 text-muted-foreground" />
            );
          })()}
          <span className="font-display text-xl font-bold text-primary">
            {drop.price.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            {getCurrencyDisplay(drop).symbol}
          </span>
        </div>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={(e) => {
            e.preventDefault();
            // Use primary price from prices array or fallback to drop.price
            const primaryPrice = drop.prices?.[0];
            const selectedPrice = {
              price: primaryPrice?.price ?? drop.price,
              currency: primaryPrice?.currency ?? drop.currency ?? 'WAX',
              tokenContract: primaryPrice?.tokenContract ?? drop.tokenContract ?? 'eosio.token',
              precision: primaryPrice?.precision ?? 8,
              listingPrice: primaryPrice?.listingPrice ?? drop.listingPrice ?? `${drop.price} WAX`,
            };
            addToCart(drop, selectedPrice);
          }}
          disabled={drop.remaining === 0}
        >
          {drop.remaining === 0 ? (
            "Sold Out"
          ) : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
