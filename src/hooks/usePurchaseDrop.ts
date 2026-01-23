import { useState } from 'react';
import { useWax } from '@/context/WaxContext';
import { useCart, CartItem } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { WAX_EXPLORER } from '@/lib/waxConfig';

export function usePurchaseDrop() {
  const { isConnected, login, claimDrop, claimFreeDrop } = useWax();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const purchaseDrops = async (items: CartItem[]) => {
    if (!isConnected) {
      await login();
      return null;
    }

    // Separate free and paid drops
    const freeDrops = items.filter(item => item.isFree || item.selectedPrice.price === 0);
    const paidDrops = items.filter(item => !item.isFree && item.selectedPrice.price > 0);

    setIsPurchasing(true);

    try {
      let txId: string | null = null;

      // Process free drops first
      for (const item of freeDrops) {
        if (item.dropSource === 'nfthive' && item.dropId) {
          txId = await claimFreeDrop(item.dropId, item.quantity);
        }

        if (!txId) {
          throw new Error(`Failed to claim free drop: ${item.name}`);
        }
      }

      // Process paid drops - use the selected price for each item
      for (const item of paidDrops) {
        if (item.dropSource === 'nfthive' && item.dropId) {
          const { selectedPrice } = item;
          txId = await claimDrop(
            item.dropId,
            item.quantity,
            selectedPrice.listingPrice,
            selectedPrice.tokenContract,
            selectedPrice.currency,
            selectedPrice.precision
          );
        } else {
          throw new Error(`Unsupported drop source for: ${item.name}`);
        }

        if (!txId) {
          throw new Error(`Failed to process item: ${item.name}`);
        }
      }

      if (txId) {
        toast({
          title: 'Purchase Successful! 🧀',
          description: `Your NFT is being minted! View transaction: ${WAX_EXPLORER}${txId}`,
        });

        clearCart();
        return txId;
      }

      return null;
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: 'Purchase Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsPurchasing(false);
    }
  };

  return {
    purchaseDrops,
    isPurchasing,
  };
}