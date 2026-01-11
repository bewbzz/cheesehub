import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWax } from '@/context/WaxContext';
import '@waxonedge/swap';
import './CheeseSwap.css';

type InputToken = 'WAX' | 'WAXUSDC';

interface CheeseSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputToken?: InputToken;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'waxonedge-swap': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        wallet?: string;
        lock?: string;
        default?: string;
      };
    }
  }
}

export function CheeseSwapDialog({ open, onOpenChange, inputToken = 'WAX' }: CheeseSwapDialogProps) {
  const { session, login } = useWax();
  const swapRef = useRef<HTMLElement>(null);

  const walletInfo = session ? JSON.stringify({
    accountName: String(session.actor),
    permission: String(session.permission),
  }) : undefined;

  // Set default tokens based on inputToken prop
  const inputTokenConfig = inputToken === 'WAXUSDC' 
    ? 'alclorstable_WAXUSDC' 
    : 'eosio.token_WAX';
  
  const defaultTokens = JSON.stringify({
    in: inputTokenConfig,
    out: 'cheeseburger_CHEESE'
  });

  useEffect(() => {
    if (!open) return;
    
    // Small delay to ensure DOM element is ready
    const timer = setTimeout(() => {
      const swapElement = swapRef.current;
      if (!swapElement) {
        console.error('[CheeseSwap] Swap element not found');
        return;
      }

      console.log('[CheeseSwap] Attaching event listeners to swap element');

      const handleConnect = async () => {
        console.log('[CheeseSwap] Connect event received');
        try {
          await login();
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      };

      const handleSign = async (event: CustomEvent) => {
        console.log('[CheeseSwap] Sign event received:', event.detail);
        
        if (!session) {
          console.error('No session available for signing');
          return;
        }

        try {
          // Per README: actions are in detail[0]
          const actions = event.detail[0];
          
          if (!actions || !Array.isArray(actions)) {
            console.error('Invalid actions format:', event.detail);
            return;
          }

          // Set signing state
          swapElement.setAttribute('signing', 'true');
          
          console.log('[CheeseSwap] Signing transaction with actions:', actions);
          await session.transact({ actions });
          
          // Remove signing state
          swapElement.removeAttribute('signing');
        } catch (error) {
          console.error('Transaction failed:', error);
          swapElement.removeAttribute('signing');
        }
      };

      swapElement.addEventListener('connect', handleConnect);
      swapElement.addEventListener('sign', handleSign as EventListener);

      // Store cleanup function
      (swapElement as any)._cleanup = () => {
        swapElement.removeEventListener('connect', handleConnect);
        swapElement.removeEventListener('sign', handleSign as EventListener);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
      const swapElement = swapRef.current;
      if (swapElement && (swapElement as any)._cleanup) {
        (swapElement as any)._cleanup();
      }
    };
  }, [open, session, login]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="cheese-swap-dialog sm:max-w-[480px] p-0 overflow-hidden bg-background border-cheese/30"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-bold">
            <span className="text-cheese">CHEESE</span>
            <span className="text-foreground">Swap</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Swap tokens with best rates across all WAX DEXs
          </DialogDescription>
        </DialogHeader>
        <div className="cheese-swap-container p-4">
          <waxonedge-swap
            ref={swapRef}
            wallet={walletInfo}
            default={defaultTokens}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
