import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { TokenLogo } from '@/components/TokenLogo';
import { RamManager } from '@/components/wallet/RamManager';
import { WalletResources, AccountResources } from '@/components/wallet/WalletResources';
import { Send, Check, X, Loader2, HardDrive } from 'lucide-react';

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
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [resourcesKey, setResourcesKey] = useState(0);

  const { tokens, isLoading: isLoadingBalances, refetch } = useAllTokenBalances(accountName);

  const selectedToken = useMemo(() => {
    return tokens.find(t => `${t.contract}-${t.symbol}` === selectedTokenKey) || null;
  }, [tokens, selectedTokenKey]);

  const balance = selectedToken?.balance ?? 0;

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const parsedAmount = parseFloat(amount) || 0;
  const hasEnoughBalance = parsedAmount > 0 && parsedAmount <= balance;
  const canSend = isValidRecipient && hasEnoughBalance && !isSending && selectedToken;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setRecipient('');
      setAmount('');
      setMemo('');
      // Select first token with balance, or first token
      const firstWithBalance = tokens.find(t => t.balance > 0);
      const defaultToken = firstWithBalance || tokens[0];
      if (defaultToken) {
        setSelectedTokenKey(`${defaultToken.contract}-${defaultToken.symbol}`);
      }
      refetch();
    }
  }, [open]);

  // Update selection when tokens load
  useEffect(() => {
    if (tokens.length > 0 && !selectedTokenKey) {
      const firstWithBalance = tokens.find(t => t.balance > 0);
      const defaultToken = firstWithBalance || tokens[0];
      setSelectedTokenKey(`${defaultToken.contract}-${defaultToken.symbol}`);
    }
  }, [tokens, selectedTokenKey]);

  const handleTokenChange = (key: string) => {
    setSelectedTokenKey(key);
    setAmount('');
  };

  const handleMaxClick = () => {
    setAmount(balance.toString());
  };

  const handleSend = async () => {
    if (!canSend || !selectedToken) return;

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

  const handleResourcesUpdate = useCallback((newResources: AccountResources | null) => {
    setResources(newResources);
  }, []);

  const handleRamTransactionComplete = useCallback(() => {
    // Force refresh resources by updating the key
    setResourcesKey(prev => prev + 1);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Wallet</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="send" className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              Send Tokens
            </TabsTrigger>
            <TabsTrigger value="ram" className="flex-1 gap-2">
              <HardDrive className="h-4 w-4" />
              RAM
            </TabsTrigger>
          </TabsList>
          
          {/* Resources display - always visible */}
          <WalletResources key={resourcesKey} onResourcesUpdate={handleResourcesUpdate} />

          <TabsContent value="send" className="space-y-4">
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

            {/* Token Select with Logos */}
            <div className="space-y-2">
              <Label>Token</Label>
              <Select value={selectedTokenKey} onValueChange={handleTokenChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select token">
                    {selectedToken && (
                      <div className="flex items-center gap-2">
                        <TokenLogo 
                          contract={selectedToken.contract} 
                          symbol={selectedToken.symbol} 
                          size="sm" 
                        />
                        <span className="font-medium">{selectedToken.symbol}</span>
                        <span className="text-muted-foreground text-xs">
                          ({balance.toLocaleString()})
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {isLoadingBalances ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading balances...</span>
                    </div>
                  ) : (
                    tokens.map((token) => (
                      <SelectItem 
                        key={`${token.contract}-${token.symbol}`} 
                        value={`${token.contract}-${token.symbol}`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <TokenLogo 
                            contract={token.contract} 
                            symbol={token.symbol} 
                            size="sm" 
                          />
                          <span className="font-medium">{token.symbol}</span>
                          <span className={`text-xs ml-auto ${token.balance > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {token.balance.toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  Balance: 
                  {selectedToken && (
                    <>
                      <TokenLogo 
                        contract={selectedToken.contract} 
                        symbol={selectedToken.symbol} 
                        size="sm" 
                        className="h-3 w-3"
                      />
                      {balance.toLocaleString()} {selectedToken.symbol}
                    </>
                  )}
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
                  step={selectedToken ? Math.pow(10, -selectedToken.precision) : 0.01}
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
                  Send {selectedToken?.symbol || 'Tokens'}
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="ram">
            <RamManager resources={resources} onTransactionComplete={handleRamTransactionComplete} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
