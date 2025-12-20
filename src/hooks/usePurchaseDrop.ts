import { useState } from 'react';
import { useWax } from '@/context/WaxContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { WAX_EXPLORER } from '@/lib/waxConfig';
import type { NFTDrop } from '@/types/drop';

export function usePurchaseDrop() {
  const { isConnected, cheeseBalance, login, transferCheese, claimDrop } = useWax();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const purchaseDrops = async (items: (NFTDrop & { quantity: number })[]) => {
    if (!isConnected) {
      await login();
      return null;
    }

    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cheeseBalance < totalPrice) {
      toast({
        title: 'Insufficient Balance',
        description: `You need ${totalPrice.toLocaleString()} CHEESE but only have ${cheeseBalance.toLocaleString()}`,
        variant: 'destructive',
      });
      return null;
    }

    setIsPurchasing(true);

    try {
      let txId: string | null = null;

      for (const item of items) {
        if (item.dropSource === 'nfthive' && item.dropId) {
          txId = await claimDrop(item.dropId, item.quantity, item.price * item.quantity);
        } else {
          const itemIds = `${item.saleId || item.id}:${item.quantity}`;
          const memo = `purchase:${itemIds}`;
          txId = await transferCheese(item.price * item.quantity, memo);
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
