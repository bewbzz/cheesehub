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
    const swapElement = swapRef.current;
    if (!swapElement) return;

    const handleConnect = async () => {
      try {
        await login();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    };

    const handleSign = async (event: CustomEvent) => {
      if (!session) {
        console.error('No session available for signing');
        return;
      }

      try {
        const { actions, resolve, reject } = event.detail;
        const result = await session.transact({ actions });
        resolve(result);
      } catch (error) {
        console.error('Transaction failed:', error);
        event.detail.reject(error);
      }
    };

    swapElement.addEventListener('connect', handleConnect);
    swapElement.addEventListener('sign', handleSign as EventListener);

    return () => {
      swapElement.removeEventListener('connect', handleConnect);
      swapElement.removeEventListener('sign', handleSign as EventListener);
    };
  }, [session, login]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cheese-swap-dialog sm:max-w-[480px] p-0 overflow-hidden bg-background border-cheese/30">
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
