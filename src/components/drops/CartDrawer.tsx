import { Trash2, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart, CartItem } from "@/context/CartContext";
import { useWax } from "@/context/WaxContext";
import { usePurchaseDrop } from "@/hooks/usePurchaseDrop";
import { Separator } from "@/components/ui/separator";
import { TokenLogo } from "@/components/TokenLogo";
import cheeseLogo from "@/assets/cheese-logo.png";

export function CartDrawer() {
  const { items, removeFromCart, clearCart, isOpen, setIsOpen } = useCart();
  const { isConnected, login, isLoading: isWalletLoading } = useWax();
  const { purchaseDrops, isPurchasing } = usePurchaseDrop();

  const handlePurchase = async () => {
    if (!isConnected) {
      await login();
      return;
    }
    await purchaseDrops(items);
  };

  // Group items by currency for display
  const itemsByCurrency = items.reduce((acc, item) => {
    const currency = item.selectedPrice.currency;
    if (!acc[currency]) acc[currency] = [];
    acc[currency].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const currencyTotals = Object.entries(itemsByCurrency).map(([currency, currencyItems]) => ({
    currency,
    total: currencyItems.reduce((sum, item) => sum + item.selectedPrice.price * item.quantity, 0),
    tokenContract: currencyItems[0].selectedPrice.tokenContract,
  }));

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex w-full flex-col border-border/50 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display text-xl text-foreground">
            <span className="text-2xl">🛒</span>
            Your Cart
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <img src={cheeseLogo} alt="Cheese" className="h-16 w-16" />
            <p className="text-lg font-medium text-muted-foreground">
              Your cart is empty
            </p>
            <p className="text-sm text-muted-foreground">
              Add some cheesy NFTs to get started!
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto py-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.id}-${item.selectedPrice.currency}`}
                    className="flex gap-4 rounded-lg border border-border/50 bg-background/50 p-3"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <h4 className="font-display font-semibold text-foreground">
                        {item.name}
                      </h4>
                      <div className="mt-1 flex items-center gap-1.5 text-sm">
                        <TokenLogo 
                          contract={item.selectedPrice.tokenContract} 
                          symbol={item.selectedPrice.currency} 
                          size="sm" 
                        />
                        <span className="font-medium text-primary">
                          {item.selectedPrice.price.toLocaleString()} {item.selectedPrice.currency}
                        </span>
                        <span className="text-muted-foreground">× {item.quantity}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Separator className="bg-border/50" />

              {/* Display totals per currency */}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Totals</span>
                {currencyTotals.map(({ currency, total, tokenContract }) => (
                  <div key={currency} className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold text-foreground">
                      {currency}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <TokenLogo contract={tokenContract} symbol={currency} size="md" />
                      <span className="font-display text-2xl font-bold text-primary">
                        {total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handlePurchase}
                  disabled={isPurchasing || isWalletLoading}
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isConnected ? (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      {currencyTotals.length === 1 
                        ? `Buy with ${currencyTotals[0].currency}` 
                        : 'Complete Purchase'}
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet & Buy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-border/50 text-muted-foreground hover:text-foreground"
                  onClick={clearCart}
                >
                  Clear Cart
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}