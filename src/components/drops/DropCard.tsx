import { useState, useCallback } from "react";
import { ShoppingCart, Coins, ImageOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { NFTDrop } from "@/types/drop";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";
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

function extractIpfsHash(url: string): string | null {
  // Extract hash from various IPFS URL formats
  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+)/,
    /\/ipfs\/([a-zA-Z0-9]+)/,
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
}

export function DropCard({ drop }: DropCardProps) {
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(drop.image);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const mintedPercent = ((drop.totalSupply - drop.remaining) / drop.totalSupply) * 100;

  const handleImageError = useCallback(() => {
    // Try to extract IPFS hash and use next gateway
    const hash = extractIpfsHash(currentImageUrl);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setCurrentImageUrl(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setImageError(true);
    }
  }, [currentImageUrl, gatewayIndex]);

  // Determine if this is a free auth-required drop
  const isFreeAuthDrop = drop.authRequired && (drop.isFree || drop.price === 0);

  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover-cheese-glow">
      <Link to={`/drops/${drop.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted/50">
          {imageError ? (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff className="h-12 w-12 text-muted-foreground/50" />
            </div>
          ) : (
            <img
              src={currentImageUrl}
              alt={drop.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={handleImageError}
              loading="lazy"
            />
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
            addToCart(drop);
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
