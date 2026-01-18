import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, ImageOff, Coins, Lock, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchDropById } from "@/services/atomicApi";
import { mockDrops } from "@/data/mockDrops";
import { useCart } from "@/context/CartContext";
import { useWax } from "@/context/WaxContext";
import { useDropEligibility, fetchDropAuthRequirements } from "@/hooks/useDropEligibility";
import cheeseLogo from "@/assets/cheese-logo.png";
import type { NFTDrop, DropAuthRequirement } from "@/types/drop";

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

const DropDetail = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isConnected, accountName, login } = useWax();
  const [imageError, setImageError] = useState(false);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [authRequirements, setAuthRequirements] = useState<DropAuthRequirement[]>([]);

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

  // Fetch auth requirements when drop is loaded and auth is required
  useEffect(() => {
    async function loadAuthRequirements() {
      if (drop?.authRequired && drop.dropId) {
        const reqs = await fetchDropAuthRequirements(drop.dropId);
        setAuthRequirements(reqs);
      }
    }
    loadAuthRequirements();
  }, [drop?.authRequired, drop?.dropId]);

  // Check user eligibility
  const eligibility = useDropEligibility(
    drop?.dropId,
    drop?.authRequired,
    authRequirements,
    accountName
  );

  // Initialize currentImageUrl when drop loads
  const imageUrl = currentImageUrl ?? drop?.image;

  const handleImageError = useCallback(() => {
    if (!imageUrl) return;
    const hash = extractIpfsHash(imageUrl);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setCurrentImageUrl(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setImageError(true);
    }
  }, [imageUrl, gatewayIndex]);

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
  const isFreeAuthDrop = drop.authRequired && (drop.isFree || drop.price === 0);
  const isSoldOut = drop.remaining === 0;

  // Determine if user can add to cart
  const canAddToCart = !isSoldOut && (!drop.authRequired || eligibility.isEligible);

  const handleAddToCart = () => {
    if (!isConnected && drop.authRequired) {
      login();
      return;
    }
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
                src={imageUrl}
                alt={drop.name}
                className="max-w-full max-h-[600px] w-auto h-auto object-contain"
                onError={handleImageError}
              />
            )}
            
            {/* Auth required badge */}
            {drop.authRequired && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-amber-500/90 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-black">
                <Lock className="h-4 w-4" />
                {isFreeAuthDrop ? 'Holders Only' : 'Auth Required'}
              </div>
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

            {/* Auth Requirements Section */}
            {drop.authRequired && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-5 w-5 text-amber-500" />
                  <h3 className="font-display font-semibold text-foreground">
                    Eligibility Requirements
                  </h3>
                </div>
                
                {eligibility.requirementsSummary.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {eligibility.requirementsSummary.map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    This drop requires holding specific NFTs to claim.
                  </p>
                )}

                {/* Eligibility Status */}
                {!isConnected ? (
                  <Alert className="border-muted bg-muted/50">
                    <AlertDescription className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4" />
                      Connect your wallet to check eligibility
                    </AlertDescription>
                  </Alert>
                ) : eligibility.isChecking ? (
                  <Alert className="border-muted bg-muted/50">
                    <AlertDescription className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking your eligibility...
                    </AlertDescription>
                  </Alert>
                ) : eligibility.isEligible ? (
                  <Alert className="border-green-500/30 bg-green-500/10">
                    <AlertDescription className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="h-4 w-4" />
                      You are eligible! You own {eligibility.matchingAssetIds.length} qualifying NFT(s).
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    <Alert className="border-destructive/30 bg-destructive/10">
                      <AlertDescription className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        You don't own the required NFTs
                      </AlertDescription>
                    </Alert>
                    {authRequirements.length > 0 && (
                      <a
                        href={`https://atomichub.io/market/wax?collection_name=${authRequirements[0].collectionName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        Buy required NFTs on AtomicHub
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-border/50 bg-card/50 p-6">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price</span>
                <div className="flex items-center gap-2">
                  {isFreeAuthDrop ? (
                    <span className="font-display text-3xl font-bold text-green-500">
                      FREE
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
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

              {/* Add to Cart Button */}
              {!isConnected && drop.authRequired ? (
                <Button
                  size="lg"
                  className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => login()}
                >
                  Connect Wallet to Check Eligibility
                </Button>
              ) : (
                <Button
                  size="lg"
                  className={`mt-6 w-full ${
                    canAddToCart 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                >
                  {isSoldOut ? (
                    "Sold Out"
                  ) : !drop.authRequired ? (
                    <>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Add to Cart
                    </>
                  ) : eligibility.isChecking ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking...
                    </>
                  ) : eligibility.isEligible ? (
                    <>
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {isFreeAuthDrop ? 'Claim Free' : 'Add to Cart'}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-5 w-5" />
                      Not Eligible
                    </>
                  )}
                </Button>
              )}
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
