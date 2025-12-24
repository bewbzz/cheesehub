import { ShoppingCart, Coins } from "lucide-react";
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
  const mintedPercent = ((drop.totalSupply - drop.remaining) / drop.totalSupply) * 100;

  return (
    <Card className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover-cheese-glow">
      <Link to={`/drops/${drop.id}`}>
        <div className="relative aspect-square overflow-hidden">
          <img
            src={drop.image}
            alt={drop.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>
      </Link>

      <CardContent className="p-4">
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
