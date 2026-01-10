import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { buildIncreaseLiquidityAction, AlcorFarmPosition } from '@/lib/alcorFarms';
import { TokenLogo } from '@/components/TokenLogo';
import { toast } from 'sonner';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IncreaseLiquidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: AlcorFarmPosition | null;
  onSuccess: (title: string, description: string, txId: string | null) => void;
}

export function IncreaseLiquidityDialog({
  open,
  onOpenChange,
  position,
  onSuccess,
}: IncreaseLiquidityDialogProps) {
  const { session, accountName } = useWax();
  const { tokens } = useAllTokenBalances(accountName);
  const [tokenAAmount, setTokenAAmount] = useState('');
  const [tokenBAmount, setTokenBAmount] = useState('');
  const [isTransacting, setIsTransacting] = useState(false);

  // Find user's balances for the position tokens
  const tokenABalance = useMemo(() => {
    if (!position) return null;
    return tokens.find(t => 
      t.contract === position.tokenA.contract && 
      t.symbol === position.tokenA.symbol
    );
  }, [tokens, position]);

  const tokenBBalance = useMemo(() => {
    if (!position) return null;
    return tokens.find(t => 
      t.contract === position.tokenB.contract && 
      t.symbol === position.tokenB.symbol
    );
  }, [tokens, position]);

  // Calculate ratio from current position
  const positionRatio = useMemo(() => {
    if (!position || position.tokenA.amount === 0) return 1;
    return position.tokenB.amount / position.tokenA.amount;
  }, [position]);

  // Auto-calculate token B when token A changes
  useEffect(() => {
    if (!tokenAAmount || isNaN(parseFloat(tokenAAmount))) {
      setTokenBAmount('');
      return;
    }
    const amountA = parseFloat(tokenAAmount);
    const amountB = amountA * positionRatio;
    setTokenBAmount(amountB.toFixed(tokenBBalance?.precision || 8));
  }, [tokenAAmount, positionRatio, tokenBBalance]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTokenAAmount('');
      setTokenBAmount('');
    }
  }, [open]);

  const handleMaxA = () => {
    if (!tokenABalance) return;
    
    const balanceA = tokenABalance.balance;
    const balanceB = tokenBBalance?.balance || 0;
    const precisionB = tokenBBalance?.precision || 8;
    
    // Calculate max token A based on token B balance and ratio
    // If user has X of token B, they can deposit at most X/ratio of token A
    let maxAFromB = positionRatio > 0 ? balanceB / positionRatio : Infinity;
    
    // Apply a small reduction (0.01%) to avoid floating-point precision issues
    // when the value is multiplied back by ratio
    maxAFromB = maxAFromB * 0.9999;
    
    // Use the lesser of actual balance or what token B allows
    const maxA = Math.min(balanceA, maxAFromB);
    
    if (maxA > 0) {
      setTokenAAmount(maxA.toFixed(tokenABalance.precision));
    }
  };

  const handleSubmit = async () => {
    if (!session || !accountName || !position) return;

    const amountA = parseFloat(tokenAAmount);
    const amountB = parseFloat(tokenBAmount);

    if (!amountA || !amountB || amountA <= 0 || amountB <= 0) {
      toast.error('Enter valid amounts for both tokens');
      return;
    }

    if (tokenABalance && amountA > tokenABalance.balance) {
      toast.error(`Insufficient ${position.tokenA.symbol} balance`);
      return;
    }

    if (tokenBBalance && amountB > tokenBBalance.balance) {
      toast.error(`Insufficient ${position.tokenB.symbol} balance`);
      return;
    }

    const precisionA = tokenABalance?.precision || 8;
    const precisionB = tokenBBalance?.precision || 8;

    const quantityA = `${amountA.toFixed(precisionA)} ${position.tokenA.symbol}`;
    const quantityB = `${amountB.toFixed(precisionB)} ${position.tokenB.symbol}`;

    setIsTransacting(true);
    try {
      const actions = buildIncreaseLiquidityAction(
        accountName,
        position.positionId,
        position.tokenA.contract,
        quantityA,
        position.tokenB.contract,
        quantityB,
        0.5 // Fixed slippage
      );

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      onSuccess(
        'Liquidity Added!',
        `Added ${quantityA} and ${quantityB} to your ${position.tokenA.symbol}/${position.tokenB.symbol} position`,
        txId
      );
    } catch (error: any) {
      console.error('Add liquidity error:', error);
      toast.error(error?.message || 'Failed to add liquidity');
    } finally {
      setIsTransacting(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  };

  if (!position) return null;

  const canSubmit = 
    parseFloat(tokenAAmount) > 0 && 
    parseFloat(tokenBAmount) > 0 &&
    (!tokenABalance || parseFloat(tokenAAmount) <= tokenABalance.balance) &&
    (!tokenBBalance || parseFloat(tokenBAmount) <= tokenBBalance.balance) &&
    !isTransacting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex -space-x-1">
              <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" />
              <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" />
            </div>
            Increase Stake
          </DialogTitle>
          <DialogDescription>
            Add more liquidity to your {position.tokenA.symbol}/{position.tokenB.symbol} position
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Position Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Stake:</span>
              <span className="font-mono">
                {position.tokenA.amount.toFixed(4)} {position.tokenA.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"></span>
              <span className="font-mono">
                {position.tokenB.amount.toFixed(4)} {position.tokenB.symbol}
              </span>
            </div>
          </div>

          {/* Token A Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <TokenLogo contract={position.tokenA.contract} symbol={position.tokenA.symbol} size="sm" className="h-4 w-4" />
                {position.tokenA.symbol}
              </Label>
              <span className="text-xs text-muted-foreground">
                Balance: {tokenABalance?.balance.toFixed(tokenABalance.precision) || '0'}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={tokenAAmount}
                onChange={(e) => setTokenAAmount(e.target.value)}
                min={0}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMaxA}
                className="shrink-0"
              >
                Max
              </Button>
            </div>
          </div>

          {/* Token B Input (auto-calculated) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <TokenLogo contract={position.tokenB.contract} symbol={position.tokenB.symbol} size="sm" className="h-4 w-4" />
                {position.tokenB.symbol}
              </Label>
              <span className="text-xs text-muted-foreground">
                Balance: {tokenBBalance?.balance.toFixed(tokenBBalance.precision) || '0'}
              </span>
            </div>
            <Input
              type="number"
              placeholder="0.0"
              value={tokenBAmount}
              readOnly
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Auto-calculated based on position ratio
            </p>
          </div>


          {/* Insufficient balance warning */}
          {tokenBBalance && parseFloat(tokenBAmount) > tokenBBalance.balance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient {position.tokenB.symbol} balance
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isTransacting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Liquidity...
              </>
            ) : (
              'Add Liquidity'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
