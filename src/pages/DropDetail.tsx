import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, ImageOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDropById } from "@/services/atomicApi";
import { mockDrops } from "@/data/mockDrops";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";
import type { NFTDrop } from "@/types/drop";
import { Coins } from "lucide-react";

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

const DropDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const [imageError, setImageError] = useState(false);

  const { data: drop, isLoading } = useQuery({
    queryKey: ['drop', id],
    queryFn: async () => {
      const apiDrop = await fetchDropById(id!);
      if (apiDrop) return apiDrop;

      const mockDrop = mockDrops.find((d) => d.id === id);
      if (mockDrop) return mockDrop as NFTDrop;

      return null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <main className="container py-10">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="grid gap-10 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <CartDrawer />
      </Layout>
    );
  }

  if (!drop) {
    return (
      <Layout>
        <div className="container flex flex-col items-center justify-center py-20">
          <img src={cheeseLogo} alt="Cheese" className="h-16 w-16" />
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            Drop not found
          </h1>
          <Link to="/drops">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Drops
            </Button>
          </Link>
        </div>
        <CartDrawer />
      </Layout>
    );
  }

  const mintedPercent = ((drop.totalSupply - drop.remaining) / drop.totalSupply) * 100;

  const handleAddToCart = () => {
    addToCart(drop);
  };

  return (
    <Layout>

      <main className="container py-10">
        <Link to="/drops">
          <Button variant="ghost" className="mb-6 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Drops
          </Button>
        </Link>

        <div className="grid gap-10 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 flex items-center justify-center min-h-[400px]">
            {imageError ? (
              <div className="flex h-full w-full items-center justify-center bg-muted/50">
                <ImageOff className="h-16 w-16 text-muted-foreground/50" />
              </div>
            ) : (
              <img
                src={drop.image}
                alt={drop.name}
                className="max-w-full max-h-[600px] w-auto h-auto object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          <div className="flex flex-col">
            {drop.collectionName && (
              <span className="inline-block self-start rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {drop.collectionName}
              </span>
            )}
            <h1 className="mt-4 font-display text-4xl font-bold text-foreground lg:text-5xl">
              {drop.name}
            </h1>

            <p className="mt-4 text-lg text-muted-foreground">{drop.description}</p>

            {drop.templateDescription && (
              <div className="mt-4 rounded-lg border border-border/30 bg-card/30 p-4">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
                  About the NFT
                </p>
                <p className="text-muted-foreground">{drop.templateDescription}</p>
              </div>
            )}

            <div className="mt-8 rounded-xl border border-border/50 bg-card/50 p-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const { logo, symbol } = getCurrencyDisplay(drop);
                    return logo ? (
                      <img src={logo} alt={symbol} className="h-8 w-8" />
                    ) : (
                      <Coins className="h-7 w-7 text-muted-foreground" />
                    );
                  })()}
                  <span className="font-display text-3xl font-bold text-primary">
                    {drop.price.toLocaleString()} {getCurrencyDisplay(drop).symbol}
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minting Progress</span>
                  <span className="font-medium text-foreground">
                    {drop.totalSupply - drop.remaining} / {drop.totalSupply} minted
                  </span>
                </div>
                <Progress value={mintedPercent} className="h-3 bg-muted" />
                <p className="text-sm text-muted-foreground">
                  {drop.remaining} remaining
                </p>
              </div>

              <Button
                size="lg"
                className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAddToCart}
                disabled={drop.remaining === 0}
              >
                {drop.remaining === 0 ? (
                  "Sold Out"
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add to Cart
                  </>
                )}
              </Button>
            </div>

            <div className="mt-8">
              <h3 className="font-display text-xl font-semibold text-foreground">
                Attributes
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {drop.attributes.map((attr) => (
                  <div
                    key={attr.trait}
                    className="rounded-lg border border-border/50 bg-card/50 p-3 text-center"
                  >
                    <p className="text-xs text-muted-foreground">{attr.trait}</p>
                    <p className="mt-1 font-medium text-foreground">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <CartDrawer />
    </Layout>
  );
};

export default DropDetail;
