import { Trash2, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useWax } from "@/context/WaxContext";
import { usePurchaseDrop } from "@/hooks/usePurchaseDrop";
import { Separator } from "@/components/ui/separator";
import cheeseLogo from "@/assets/cheese-logo.png";

export function CartDrawer() {
  const { items, removeFromCart, clearCart, totalPrice, isOpen, setIsOpen } = useCart();
  const { isConnected, cheeseBalance, login, isLoading: isWalletLoading } = useWax();
  const { purchaseDrops, isPurchasing } = usePurchaseDrop();

  const handlePurchase = async () => {
    if (!isConnected) {
      await login();
      return;
    }
    await purchaseDrops(items);
  };

  const insufficientBalance = isConnected && cheeseBalance < totalPrice;

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
                    key={item.id}
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
                        <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
                        <span className="font-medium text-primary">
                          {item.price.toLocaleString()}
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

              {isConnected && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your Balance</span>
                  <div className="flex items-center gap-1.5">
                    <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
                    <span className={`font-medium ${insufficientBalance ? 'text-destructive' : 'text-foreground'}`}>
                      {cheeseBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-foreground">
                  Total
                </span>
                <div className="flex items-center gap-1.5">
                  <img src={cheeseLogo} alt="CHEESE" className="h-6 w-6" />
                  <span className="font-display text-2xl font-bold text-primary">
                    {totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {insufficientBalance && (
                <p className="text-sm text-destructive text-center">
                  Insufficient CHEESE balance
                </p>
              )}

              <div className="space-y-2">
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handlePurchase}
                  disabled={isPurchasing || isWalletLoading || insufficientBalance}
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isConnected ? (
                    <>
                      <img src={cheeseLogo} alt="CHEESE" className="mr-2 h-4 w-4" />
                      Buy with CHEESE
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
