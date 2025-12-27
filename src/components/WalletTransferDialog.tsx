import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WAX_TOKENS, TokenConfig } from '@/lib/tokenRegistry';
import { useWax } from '@/context/WaxContext';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { Send, Check, X, Loader2 } from 'lucide-react';

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName, transferToken } = useWax();
  const [recipient, setRecipient] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenConfig>(WAX_TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { balance, isLoading: isLoadingBalance, refetch } = useTokenBalance(accountName, selectedToken);

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const parsedAmount = parseFloat(amount) || 0;
  const hasEnoughBalance = parsedAmount > 0 && parsedAmount <= balance;
  const canSend = isValidRecipient && hasEnoughBalance && !isSending;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setRecipient('');
      setAmount('');
      setMemo('');
      setSelectedToken(WAX_TOKENS[0]);
    }
  }, [open]);

  // Refetch balance when token changes
  useEffect(() => {
    refetch();
  }, [selectedToken, refetch]);

  const handleTokenChange = (symbol: string) => {
    const token = WAX_TOKENS.find(t => t.symbol === symbol);
    if (token) {
      setSelectedToken(token);
      setAmount('');
    }
  };

  const handleMaxClick = () => {
    setAmount(balance.toString());
  };

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const txId = await transferToken(
        selectedToken.contract,
        selectedToken.symbol,
        selectedToken.precision,
        recipient,
        parsedAmount,
        memo
      );
      if (txId) {
        onOpenChange(false);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Send Tokens</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient</Label>
            <div className="relative">
              <Input
                id="recipient"
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
            {recipient.length > 0 && !isValidRecipient && (
              <p className="text-xs text-destructive">
                Invalid account name (1-12 chars, a-z, 1-5, periods)
              </p>
            )}
          </div>

          {/* Token Select */}
          <div className="space-y-2">
            <Label>Token</Label>
            <Select value={selectedToken.symbol} onValueChange={handleTokenChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {WAX_TOKENS.map((token) => (
                  <SelectItem key={`${token.contract}-${token.symbol}`} value={token.symbol}>
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-muted-foreground ml-2 text-xs">({token.contract})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <div className="text-xs text-muted-foreground">
                Balance: {isLoadingBalance ? '...' : balance.toLocaleString()} {selectedToken.symbol}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={Math.pow(10, -selectedToken.precision)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMaxClick}
                className="shrink-0"
              >
                Max
              </Button>
            </div>
            {parsedAmount > balance && (
              <p className="text-xs text-destructive">Insufficient balance</p>
            )}
          </div>

          {/* Memo */}
          <div className="space-y-2">
            <Label htmlFor="memo">Memo (optional)</Label>
            <Input
              id="memo"
              placeholder="Enter memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send {selectedToken.symbol}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
