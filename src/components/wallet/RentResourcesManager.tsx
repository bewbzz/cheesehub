import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { usePowerupEstimate, fetchPowerupState, findFracForWax, parsePriceWax } from '@/hooks/usePowerupEstimate';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { Zap, Cpu, Wifi, Loader2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import cheeseLogo from '@/assets/cheese-logo.png';
import waxLogo from '@/assets/wax-token.png';

interface RentResourcesManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes.toFixed(0)} bytes`;
};

export function RentResourcesManager({ 
  onTransactionComplete,
  onTransactionSuccess 
}: RentResourcesManagerProps) {
  const { accountName, session } = useWax();
  const { tokens, refetch: refetchBalances } = useAllTokenBalances(accountName);
  
  const [paymentMode, setPaymentMode] = useState<'cheese' | 'wax'>('cheese');
  const [recipient, setRecipient] = useState(accountName || '');
  const [cpuAmount, setCpuAmount] = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [isTransacting, setIsTransacting] = useState(false);

  // Get balances
  const cheeseToken = tokens.find(t => t.symbol === 'CHEESE' && t.contract === 'cheeseburger');
  const waxToken = tokens.find(t => t.symbol === 'WAX' && t.contract === 'eosio.token');
  const cheeseBalance = cheeseToken?.balance || 0;
  const waxBalance = waxToken?.balance || 0;

  const cpuNumeric = parseFloat(cpuAmount) || 0;
  const netNumeric = parseFloat(netAmount) || 0;
  const totalAmount = cpuNumeric + netNumeric;

  // Powerup estimate - works for both CHEESE and WAX modes
  const { estimate, isLoading: isEstimateLoading, error: estimateError, refetch: refetchEstimate } = 
    usePowerupEstimate(cpuNumeric, netNumeric, paymentMode === 'wax');

  // Sync recipient when account changes
  useEffect(() => {
    if (accountName) {
      setRecipient(accountName);
    }
  }, [accountName]);

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const currentBalance = paymentMode === 'cheese' ? cheeseBalance : waxBalance;
  const hasEnoughBalance = totalAmount > 0 && totalAmount <= currentBalance;
  const canRent = isValidRecipient && hasEnoughBalance && !isTransacting && session;

  const handleRent = async () => {
    if (!session || !canRent) return;

    setIsTransacting(true);

    try {
      if (paymentMode === 'cheese') {
        // CHEESE payment via cheesepowerz contract
        let memo: string;
        if (cpuNumeric > 0 && netNumeric > 0) {
          const cpuPercent = Math.round((cpuNumeric / totalAmount) * 100);
          const netPercent = 100 - cpuPercent;
          memo = `cpu:${cpuPercent},net:${netPercent}:${recipient}`;
        } else if (netNumeric > 0) {
          memo = `net:${recipient}`;
        } else {
          memo = recipient;
        }

        const action = {
          account: 'cheeseburger',
          name: 'transfer',
          authorization: [session.permissionLevel],
          data: {
            from: String(session.actor),
            to: 'cheesepowerz',
            quantity: `${totalAmount.toFixed(4)} CHEESE`,
            memo,
          },
        };

        const result = await session.transact({ actions: [action] });
        const txId = result.resolved?.transaction?.id?.toString() || null;

        onTransactionSuccess?.(
          'PowerUp Successful!',
          `Rented resources for ${recipient} using ${totalAmount.toLocaleString()} CHEESE`,
          txId
        );
      } else {
        // WAX payment via native eosio::powerup
        // Fetch current powerup pool state to calculate correct frac values
        const powerupState = await fetchPowerupState();
        if (!powerupState) {
          throw new Error('Failed to fetch PowerUp pool state. Please try again.');
        }

        // Parse CPU pool parameters
        const cpuWeight = parseFloat(powerupState.cpu.weight);
        const cpuAdjustedUtil = parseFloat(powerupState.cpu.adjusted_utilization);
        const cpuMinPrice = parsePriceWax(powerupState.cpu.min_price);
        const cpuMaxPrice = parsePriceWax(powerupState.cpu.max_price);
        const cpuExponent = powerupState.cpu.exponent;

        // Parse NET pool parameters
        const netWeight = parseFloat(powerupState.net.weight);
        const netAdjustedUtil = parseFloat(powerupState.net.adjusted_utilization);
        const netMinPrice = parsePriceWax(powerupState.net.min_price);
        const netMaxPrice = parsePriceWax(powerupState.net.max_price);
        const netExponent = powerupState.net.exponent;

        // Calculate correct frac values using binary search
        const cpuFrac = cpuNumeric > 0 
          ? findFracForWax(cpuNumeric, cpuWeight, cpuAdjustedUtil, cpuMinPrice, cpuMaxPrice, cpuExponent)
          : 0;
        const netFrac = netNumeric > 0 
          ? findFracForWax(netNumeric, netWeight, netAdjustedUtil, netMinPrice, netMaxPrice, netExponent)
          : 0;

        // Add 5% buffer to max_payment
        const maxPayment = (totalAmount * 1.05).toFixed(8);

        const action = {
          account: 'eosio',
          name: 'powerup',
          authorization: [session.permissionLevel],
          data: {
            payer: String(session.actor),
            receiver: recipient,
            days: 1,
            net_frac: netFrac,
            cpu_frac: cpuFrac,
            max_payment: `${maxPayment} WAX`,
          },
        };

        const result = await session.transact({ actions: [action] });
        const txId = result.resolved?.transaction?.id?.toString() || null;

        onTransactionSuccess?.(
          'PowerUp Successful!',
          `Rented resources for ${recipient} using ${totalAmount.toFixed(8)} WAX`,
          txId
        );
      }

      // Reset form
      setCpuAmount('');
      setNetAmount('');
      refetchBalances();
      onTransactionComplete?.();

    } catch (error) {
      console.error('Rent transaction failed:', error);
      closeWharfkitModals();
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';

      const isCpuError = errorMessage.toLowerCase().includes('cpu') ||
                         errorMessage.toLowerCase().includes('billed') ||
                         errorMessage.toLowerCase().includes('net usage') ||
                         errorMessage.toLowerCase().includes('deadline exceeded');

      if (isCpuError) {
        toast.error('Transaction failed - insufficient resources', {
          description: 'Enable Greymass Fuel in Anchor settings or use WAX Cloud Wallet for free CPU.',
          duration: 8000,
        });
      } else {
        toast.error('PowerUp failed', {
          description: errorMessage,
        });
      }
    } finally {
      setIsTransacting(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Rent CPU & NET</h3>
        <p className="text-sm text-muted-foreground">
          Rent resources for 24 hours using CHEESE or WAX
        </p>
      </div>

      <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'cheese' | 'wax')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cheese" className="flex items-center gap-2">
            <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
            Pay with CHEESE
          </TabsTrigger>
          <TabsTrigger value="wax" className="flex items-center gap-2">
            <img src={waxLogo} alt="WAX" className="h-4 w-4" />
            Pay with WAX
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cheese" className="mt-4 space-y-4">
          <div className="text-xs text-muted-foreground text-center">
            Powered by the CHEESEPOWERZ Smart Contract
          </div>
        </TabsContent>

        <TabsContent value="wax" className="mt-4 space-y-4">
          <div className="text-xs text-muted-foreground text-center">
            Direct PowerUp using native WAX tokens
          </div>
        </TabsContent>
      </Tabs>

      {/* Recipient */}
      <div className="space-y-2">
        <Label htmlFor="rent-recipient">Recipient Account</Label>
        <div className="relative">
          <Input
            id="rent-recipient"
            placeholder="Enter WAX account"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.toLowerCase())}
            className="pr-10"
          />
          {recipient.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValidRecipient ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-destructive" />
              )}
            </div>
          )}
        </div>
        {recipient !== accountName && recipient.length > 0 && isValidRecipient && (
          <p className="text-xs text-muted-foreground">
            Powering up a different account
          </p>
        )}
      </div>

      {/* CPU Amount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cpu-amount" className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-500" />
            CPU Amount
          </Label>
          <span className="text-xs text-muted-foreground">
            Balance: {currentBalance.toLocaleString()} {paymentMode === 'cheese' ? 'CHEESE' : 'WAX'}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="cpu-amount"
            type="number"
            placeholder="0"
            value={cpuAmount}
            onChange={(e) => setCpuAmount(e.target.value)}
            min={0}
            step={paymentMode === 'cheese' ? 1 : 0.00000001}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCpuAmount(currentBalance.toString())}
            className="shrink-0"
          >
            Max
          </Button>
        </div>
      </div>

      {/* NET Amount */}
      <div className="space-y-2">
        <Label htmlFor="net-amount" className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-orange-400" />
          NET Amount
        </Label>
        <div className="flex gap-2">
          <Input
            id="net-amount"
            type="number"
            placeholder="0"
            value={netAmount}
            onChange={(e) => setNetAmount(e.target.value)}
            min={0}
            step={paymentMode === 'cheese' ? 1 : 0.00000001}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNetAmount(currentBalance.toString())}
            className="shrink-0"
          >
            Max
          </Button>
        </div>
      </div>

      {/* Estimate Display (both modes) */}
      {(cpuNumeric > 0 || netNumeric > 0) && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Estimated Resources</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetchEstimate}
              disabled={isEstimateLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isEstimateLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {isEstimateLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating...
            </div>
          ) : estimateError ? (
            <p className="text-sm text-destructive">{estimateError}</p>
          ) : estimate ? (
            <div className="space-y-1 text-sm">
              {cpuNumeric > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU:</span>
                  <span>~{estimate.estimatedCpuMs.toFixed(2)} ms</span>
                </div>
              )}
              {netNumeric > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NET:</span>
                  <span>~{formatBytes(estimate.estimatedNetBytes)}</span>
                </div>
              )}
              {paymentMode === 'cheese' && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>CHEESE/WAX:</span>
                  <span>{estimate.cheesePriceInWax.toFixed(6)}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Total & Balance Check */}
      {totalAmount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className={totalAmount > currentBalance ? 'text-destructive' : 'text-foreground'}>
            {totalAmount.toLocaleString()} {paymentMode === 'cheese' ? 'CHEESE' : 'WAX'}
          </span>
        </div>
      )}

      {totalAmount > currentBalance && (
        <p className="text-xs text-destructive text-center">
          Insufficient {paymentMode === 'cheese' ? 'CHEESE' : 'WAX'} balance
        </p>
      )}

      {/* Rent Button */}
      <Button
        onClick={handleRent}
        disabled={!canRent}
        className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
      >
        {isTransacting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Rent Resources
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Resources are rented for 24 hours from the PowerUp pool
      </p>
    </div>
  );
}
