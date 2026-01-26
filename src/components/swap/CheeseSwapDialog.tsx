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
import { getTransactPlugins } from '@/lib/wharfKit';
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
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

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

      // Token symbol to contract mapping
      const tokenContractMap: Record<string, string> = {
        'LSWAX': 'token.fusion',
        'SWAX': 'token.fusion',
        'WAX': 'eosio.token',
        'CHEESE': 'cheeseburger',
        'NWO': 'cointreasure',
        'WAXUSDC': 'alclorstable',
        'WAXUSDT': 'alclorstable',
      };

      // Normalize actions from WaxOnEdge/NeftyBlocks to WharfKit format
      const normalizeActions = (actions: any[], accountName: string, permission: string) => {
        console.log('[CheeseSwap] Raw actions to normalize:', JSON.stringify(actions, null, 2));
        
        return actions.map((action, index) => {
          console.log(`[CheeseSwap] Processing action ${index}:`, JSON.stringify(action));
          
          // Check if it's WharfKit format but with nested action data inside 'data'
          // This happens with WaxFusion routes where data contains action_account/action_name/action_data
          if (action.account && action.name && action.data?.action_account && action.data?.action_name) {
            console.log(`[CheeseSwap] Action ${index}: Nested action format - extracting ${action.data.action_account}::${action.data.action_name}`);
            
            // Extract the real action from the nested structure
            const nestedData = action.data.action_data || {};
            
            // Ensure 'from' is set for transfers
            if (action.data.action_name === 'transfer' && !nestedData.from) {
              nestedData.from = accountName;
            }
            
            return {
              account: action.data.action_account,
              name: action.data.action_name,
              authorization: [{ actor: accountName, permission }],
              data: nestedData
            };
          }
          
          // Already in proper WharfKit format (has 'account', 'name', and proper data with to/quantity for transfers)
          if (action.account && action.name) {
            // Verify transfer actions have required fields
            if (action.name === 'transfer' && action.data) {
              const hasProperTransferData = action.data.to && action.data.quantity;
              if (!hasProperTransferData) {
                console.warn(`[CheeseSwap] Action ${index}: Transfer missing to/quantity, skipping`);
                // This shouldn't happen with proper actions, but log it
              }
            }
            
            console.log(`[CheeseSwap] Action ${index}: Already in WharfKit format`);
            // Ensure authorization is present
            if (!action.authorization) {
              action.authorization = [{ actor: accountName, permission }];
            }
            return action;
          }
          
          // NeftyBlocks format with action_account/action_name at top level
          if (action.action_account && action.action_name) {
            console.log(`[CheeseSwap] Action ${index}: NeftyBlocks format (${action.action_account}::${action.action_name})`);
            
            let data = action.action_data || {};
            if (action.action_name === 'transfer' && !data.from) {
              data = { ...data, from: accountName };
            }
            
            return {
              account: action.action_account,
              name: action.action_name,
              authorization: [{ actor: accountName, permission }],
              data
            };
          }
          
          // Simplified transfer format (just to/quantity/memo - no account info)
          if (action.to && action.quantity) {
            const tokenSymbol = action.quantity.split(' ')[1];
            const tokenContract = tokenContractMap[tokenSymbol] || 'eosio.token';
            console.log(`[CheeseSwap] Action ${index}: Simplified transfer format (${tokenSymbol} -> ${tokenContract})`);
            
            return {
              account: tokenContract,
              name: 'transfer',
              authorization: [{ actor: accountName, permission }],
              data: {
                from: accountName,
                to: action.to,
                quantity: action.quantity,
                memo: action.memo || ''
              }
            };
          }
          
          // Unknown format - log details and return as-is
          console.warn('[CheeseSwap] Unknown action format:', JSON.stringify(action));
          return action;
        });
      };

      const handleSign = async (event: CustomEvent) => {
        console.log('[CheeseSwap] Sign event received:', event.detail);
        
        if (!session) {
          console.error('No session available for signing');
          return;
        }

        try {
          const rawActions = event.detail[0];
          
          if (!rawActions || !Array.isArray(rawActions)) {
            console.error('Invalid actions format:', event.detail);
            return;
          }

          // Normalize actions to WharfKit-compatible format
          const actions = normalizeActions(
            rawActions,
            String(session.actor),
            String(session.permission)
          );

          swapElement.setAttribute('signing', 'true');
          
          console.log('[CheeseSwap] Signing normalized actions:', actions);
          const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
          
          // Extract transaction ID
          const txId = result?.response?.transaction_id || null;
          setLastTxId(txId);
          setSuccessDialogOpen(true);
          
          swapElement.removeAttribute('signing');
        } catch (error: any) {
          console.error('Transaction failed:', error);
          swapElement.removeAttribute('signing');
          
          const errorMessage = error?.message || 'Transaction was cancelled or failed';
          toast.error('Swap Failed', {
            description: errorMessage.length > 100 
              ? errorMessage.substring(0, 100) + '...' 
              : errorMessage,
          });
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
