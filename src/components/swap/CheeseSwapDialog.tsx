import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWax } from '@/context/WaxContext';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { toast } from 'sonner';
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
  const sessionRef = useRef(session);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  // Keep sessionRef updated to avoid stale closures
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Update widget wallet attribute when session changes
  useEffect(() => {
    if (open && swapRef.current && session) {
      const walletData = JSON.stringify({
        accountName: String(session.actor),
        permission: String(session.permission),
      });
      swapRef.current.setAttribute('wallet', walletData);
    }
  }, [open, session]);

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
      // Use querySelector to find the element (more reliable for web components)
      const swapElement = document.querySelector('waxonedge-swap') as HTMLElement;
      if (!swapElement) {
        console.error('[CheeseSwap] Swap element not found via querySelector');
        return;
      }

      console.log('[CheeseSwap] Attaching event listeners to swap element', swapElement);

      const handleConnect = async () => {
        console.log('[CheeseSwap] Connect event received');
        try {
          await login();
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      };

      const handleSign = async (event: Event) => {
        const customEvent = event as CustomEvent;
        console.log('[CheeseSwap] Sign event received:', customEvent.detail);
        
        // Use ref to get current session (avoids stale closure)
        const currentSession = sessionRef.current;
        
        if (!currentSession) {
          console.error('No session available for signing');
          toast.error('Wallet Not Connected', {
            description: 'Please connect your wallet first',
          });
          return;
        }

        try {
          // Per README: actions are in detail[0]
          const rawActions = customEvent.detail[0];
          
          console.log('[CheeseSwap] Raw actions from widget:', JSON.stringify(rawActions, null, 2));
          
          if (!rawActions || !Array.isArray(rawActions)) {
            console.error('Invalid actions format:', customEvent.detail);
            return;
          }

          // Validate transfer actions have required 'to' field
          for (const action of rawActions) {
            if (action.name === 'transfer' && action.data) {
              // Check if this is a standard transfer (needs 'to') vs inline action format
              const hasTo = action.data.to !== undefined && action.data.to !== null;
              const hasActionAccount = action.data.action_account !== undefined;
              
              if (!hasTo && !hasActionAccount) {
                console.error('[CheeseSwap] Transfer action missing "to" field:', action);
                toast.error('Swap Route Error', {
                  description: 'Unable to find a valid swap route. Please try a different amount or token pair.',
                });
                return;
              }
            }
          }

          // Prepare actions with proper authorization
          const actions = rawActions.map((action: any) => ({
            account: action.account,
            name: action.name,
            authorization: action.authorization || [currentSession.permissionLevel],
            data: action.data,
          }));

          // Set signing state
          swapElement.setAttribute('signing', 'true');
          
          console.log('[CheeseSwap] Signing transaction with actions:', JSON.stringify(actions, null, 2));
          const result = await currentSession.transact({ actions });
          
          // Extract transaction ID
          const txId = result?.response?.transaction_id || null;
          setLastTxId(txId);
          setSuccessDialogOpen(true);
          
          // Remove signing state
          swapElement.removeAttribute('signing');
        } catch (error: any) {
          console.error('Transaction failed:', error);
          swapElement.removeAttribute('signing');
          
          // Show error toast
          const errorMessage = error?.message || 'Transaction was cancelled or failed';
          toast.error('Swap Failed', {
            description: errorMessage.length > 100 
              ? errorMessage.substring(0, 100) + '...' 
              : errorMessage,
          });
        }
      };

      swapElement.addEventListener('connect', handleConnect);
      swapElement.addEventListener('sign', handleSign);

      // Store cleanup function on window to ensure we can clean up
      (window as any).__cheeseSwapCleanup = () => {
        console.log('[CheeseSwap] Cleaning up event listeners');
        swapElement.removeEventListener('connect', handleConnect);
        swapElement.removeEventListener('sign', handleSign);
      };
    }, 200);

    return () => {
      clearTimeout(timer);
      if ((window as any).__cheeseSwapCleanup) {
        (window as any).__cheeseSwapCleanup();
        delete (window as any).__cheeseSwapCleanup;
      }
    };
  }, [open, login]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="cheese-swap-dialog sm:max-w-[480px] p-0 overflow-hidden bg-background border-cheese/30"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
        <DialogHeader className="p-4 pb-0 pr-10">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Swap</span>
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              powered by <a href="https://waxonedge.app" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">WaxOnEdge</a>
            </span>
          </div>
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

      <TransactionSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Swap Successful!"
        description="Your token swap has been completed successfully."
        txId={lastTxId}
      />
    </>
  );
}
