import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWax } from '@/context/WaxContext';
import { useAllTokenBalances } from '@/hooks/useAllTokenBalances';
import { TokenLogo } from '@/components/TokenLogo';
import { RamManager } from '@/components/wallet/RamManager';
import { StakeManager } from '@/components/wallet/StakeManager';
import { VoteManager } from '@/components/wallet/VoteManager';
import { VoteRewardsManager } from '@/components/wallet/VoteRewardsManager';
import { WalletResources, AccountResources, StakedResourcesSection, AccountDetailsSection } from '@/components/wallet/WalletResources';
import { useWaxPrice } from '@/hooks/useWaxPrice';
import { useAlcorTokenPrices } from '@/hooks/useAlcorTokenPrices';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { Send, Check, X, Loader2, HardDrive, Cpu, Gift, Vote, Image, Zap, Wallet, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NFTSendManager } from '@/components/wallet/NFTSendManager';
import { RentResourcesManager } from '@/components/wallet/RentResourcesManager';
import { AlcorFarmManager } from '@/components/wallet/AlcorFarmManager';
import { closeWharfkitModals } from '@/lib/wharfKit';
import cheeseLogo from '@/assets/cheese-logo.png';

interface WalletTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WalletSection = 'account' | 'send' | 'send-nfts' | 'stake' | 'rent' | 'ram' | 'vote' | 'rewards' | 'alcor-farms';

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

const mainMenuItems: { id: WalletSection; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <Wallet className="h-4 w-4" /> },
  { id: 'send', label: 'Send Tokens', icon: <Send className="h-4 w-4" /> },
  { id: 'send-nfts', label: 'Send NFTs', icon: <Image className="h-4 w-4" /> },
  { id: 'stake', label: 'Stake CPU/NET', icon: <Cpu className="h-4 w-4" /> },
  { id: 'rent', label: 'Rent CPU/NET', icon: <Zap className="h-4 w-4" /> },
  { id: 'ram', label: 'Trade RAM', icon: <HardDrive className="h-4 w-4" /> },
  { id: 'vote', label: 'Governance', icon: <Vote className="h-4 w-4" /> },
  { id: 'rewards', label: 'Vote Rewards', icon: <Gift className="h-4 w-4" /> },
];

const bottomMenuItems: { id: WalletSection; label: string; icon: React.ReactNode }[] = [
  { id: 'alcor-farms', label: 'Manage Alcor Farms', icon: <Sprout className="h-4 w-4" /> },
];

export function WalletTransferDialog({ open, onOpenChange }: WalletTransferDialogProps) {
  const { accountName, transferToken } = useWax();
  const [activeSection, setActiveSection] = useState<WalletSection>('send');
  const [recipient, setRecipient] = useState('');
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [resources, setResources] = useState<AccountResources | null>(null);
  const [resourcesKey, setResourcesKey] = useState(0);
  const [tokenSearch, setTokenSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Success dialog state
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successDescription, setSuccessDescription] = useState('');
  const [successTxId, setSuccessTxId] = useState<string | null>(null);

  const { tokens, isLoading: isLoadingBalances, refetch } = useAllTokenBalances(accountName);
  const { data: waxUsdPrice = 0 } = useWaxPrice();
  const { data: tokenPrices } = useAlcorTokenPrices();

  // Calculate total portfolio value in WAX and USD
  const portfolioValue = useMemo(() => {
    if (!tokens.length) return { wax: 0, usd: 0 };
    
    let totalWax = 0;
    
    tokens.forEach(token => {
      if (token.symbol === 'WAX' && token.contract === 'eosio.token') {
        // WAX is 1:1
        totalWax += token.balance;
      } else if (tokenPrices) {
        // Look up price in Alcor price map
        const key = `${token.contract}:${token.symbol}`;
        const priceInWax = tokenPrices.get(key);
        if (priceInWax) {
          totalWax += token.balance * priceInWax;
        }
      }
    });
    
    return {
      wax: totalWax,
      usd: totalWax * waxUsdPrice,
    };
  }, [tokens, waxUsdPrice, tokenPrices]);

  const filteredTokens = useMemo(() => {
    if (!tokenSearch.trim()) return tokens;
    const search = tokenSearch.toLowerCase();
    const filtered = tokens.filter(t => 
      t.symbol.toLowerCase().includes(search) || 
      t.contract.toLowerCase().includes(search)
    );
    // Sort: tokens starting with search first, then alphabetically
    return filtered.sort((a, b) => {
      const aStartsWithSymbol = a.symbol.toLowerCase().startsWith(search);
      const bStartsWithSymbol = b.symbol.toLowerCase().startsWith(search);
      if (aStartsWithSymbol && !bStartsWithSymbol) return -1;
      if (!aStartsWithSymbol && bStartsWithSymbol) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [tokens, tokenSearch]);

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
      setTokenSearch('');
      setActiveSection('account');
    }
  }, [open]);

  // Refetch balances when dialog opens AND accountName is available
  useEffect(() => {
    if (open && accountName) {
      refetch();
    }
  }, [open, accountName, refetch]);

  // Update selection when tokens load - default to CHEESE
  useEffect(() => {
    if (tokens.length > 0 && !selectedTokenKey) {
      const cheeseToken = tokens.find(t => t.symbol === 'CHEESE' && t.contract === 'cheeseburger');
      const defaultToken = cheeseToken || tokens[0];
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
        const quantity = `${parsedAmount.toFixed(selectedToken.precision)} ${selectedToken.symbol}`;
        showSuccessDialog('Transaction Successful!', `Sent ${quantity} to ${recipient}`, txId);
        refetch(); // Refresh token balances immediately
      }
    } finally {
      setIsSending(false);
      closeWharfkitModals();
    }
  };

  const handleResourcesUpdate = useCallback((newResources: AccountResources | null) => {
    setResources(newResources);
  }, []);

  const handleTransactionComplete = useCallback(() => {
    // Force refresh resources by updating the key
    setResourcesKey(prev => prev + 1);
  }, []);

  const showSuccessDialog = useCallback((title: string, description: string, txId: string | null) => {
    setSuccessTitle(title);
    setSuccessDescription(description);
    setSuccessTxId(txId);
    setSuccessOpen(true);
  }, []);

  const handleSuccessClose = useCallback((open: boolean) => {
    setSuccessOpen(open);
    if (!open) {
      // Reset form after closing success dialog
      setRecipient('');
      setAmount('');
      setMemo('');
    }
  }, []);

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) closeWharfkitModals();
      onOpenChange(isOpen);
    }}>
      <DialogContent 
        className="sm:max-w-[1000px] max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <img src={cheeseLogo} alt="Cheese" className="h-6 w-6" />
            <span><span className="text-primary cheese-text-glow">CHEESE</span><span className="text-foreground">Wallet</span></span>
          </DialogTitle>
          <DialogDescription className="sr-only">Manage your wallet tokens, staking, and RAM</DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 h-[810px]">
          {/* Left Sidebar Menu */}
          <div className="w-40 shrink-0 border-r border-border pr-4 flex flex-col">
            {/* Main menu items - takes available space */}
            <div className="space-y-1">
              {mainMenuItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full justify-start gap-2 text-left h-auto py-3",
                    activeSection === item.id 
                      ? "bg-cheese/20 text-cheese hover:bg-cheese/30 hover:text-cheese" 
                      : "hover:bg-muted"
                  )}
                >
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </Button>
              ))}
            </div>


            {/* Bottom menu items - pinned to bottom */}
            <div className="border-t border-border/50 pt-3 space-y-1">
              {bottomMenuItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full justify-start gap-2 text-left h-auto py-3",
                    activeSection === item.id 
                      ? "bg-cheese/20 text-cheese hover:bg-cheese/30 hover:text-cheese" 
                      : "hover:bg-muted"
                  )}
                >
                  {item.icon}
                  <span className="text-xs leading-tight">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col">
            {/* Resources display - always visible */}
            <WalletResources 
              key={resourcesKey} 
              onResourcesUpdate={handleResourcesUpdate} 
              showTotalWaxBalance={activeSection === 'account'}
              waxUsdPrice={waxUsdPrice}
            />

            <div className="mt-4">
              {/* Account Section */}
              {activeSection === 'account' && (
                <div className="space-y-4">
                  {/* Account Details Section */}
                  <AccountDetailsSection resources={resources} />
                  
                  {/* Staked Resources Section */}
                  <StakedResourcesSection resources={resources} />

                  {/* Token Balances */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Token Balances</h3>
                      {!isLoadingBalances && tokens.length > 0 && (
                        <div className="text-xs text-right">
                          <span className="text-cheese font-medium">
                            {portfolioValue.wax.toFixed(4)} WAX
                          </span>
                          {waxUsdPrice > 0 && (
                            <span className="text-muted-foreground ml-2">
                              (${portfolioValue.usd.toFixed(2)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {isLoadingBalances ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading balances...</span>
                      </div>
                    ) : tokens.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tokens found</p>
                    ) : (
                      <ScrollArea className="h-[260px]">
                        <div className="space-y-2 pr-2">
                          {tokens.filter(t => !(t.symbol === 'WAX' && t.contract === 'eosio.token')).map((token) => (
                            <div 
                              key={`${token.contract}-${token.symbol}`}
                              className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <TokenLogo 
                                contract={token.contract} 
                                symbol={token.symbol} 
                                size="sm" 
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <a 
                                    href={`https://waxblock.io/account/${token.contract}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:text-cheese hover:underline transition-colors cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {token.symbol}
                                  </a>
                                  <a 
                                    href={`https://waxblock.io/account/${token.contract}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground truncate hover:text-cheese hover:underline transition-colors cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ({token.contract})
                                  </a>
                                </div>
                              </div>
                              <span className="font-mono text-sm">
                                {token.balance.toFixed(token.precision)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              )}

              {/* Send Tokens Section */}
              {activeSection === 'send' && (
                <div className="space-y-4">
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
                                ({balance.toFixed(selectedToken.precision)})
                              </span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="p-0">
                        <div 
                          className="p-2 sticky top-0 bg-popover border-b border-border z-10"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <Input
                            ref={searchInputRef}
                            placeholder="Search tokens..."
                            value={tokenSearch}
                            onChange={(e) => {
                              e.stopPropagation();
                              setTokenSearch(e.target.value);
                              requestAnimationFrame(() => {
                                searchInputRef.current?.focus();
                              });
                            }}
                            className="h-8"
                            autoComplete="off"
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onKeyUp={(e) => e.stopPropagation()}
                            onKeyPress={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              if (e.relatedTarget?.closest('[role="option"]')) {
                                return;
                              }
                            }}
                          />
                        </div>
                        <ScrollArea className="h-64">
                          <div className="p-1">
                            {isLoadingBalances ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span className="text-sm text-muted-foreground">Loading balances...</span>
                              </div>
                            ) : filteredTokens.length === 0 ? (
                              <div className="py-4 text-center text-sm text-muted-foreground">
                                No tokens found
                              </div>
                            ) : (
                              filteredTokens.map((token) => (
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
                                    <span className="text-muted-foreground text-xs">({token.contract})</span>
                                    <span className={`text-xs ml-auto ${token.balance > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                      {token.balance.toFixed(token.precision)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </div>
                        </ScrollArea>
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
                            {balance.toFixed(selectedToken.precision)} {selectedToken.symbol}
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
                </div>
              )}

              {/* Stake CPU/NET Section */}
              {/* Send NFTs Section */}
              {activeSection === 'send-nfts' && (
                <NFTSendManager onTransactionSuccess={showSuccessDialog} />
              )}

              {/* Stake CPU/NET Section */}
              {activeSection === 'stake' && (
                <StakeManager 
                  resources={resources} 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}

              {/* Rent CPU/NET Section */}
              {activeSection === 'rent' && (
                <RentResourcesManager 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}

              {/* Trade RAM Section */}
              {activeSection === 'ram' && (
                <RamManager 
                  resources={resources} 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}

              {/* Vote Section */}
              {activeSection === 'vote' && (
                <VoteManager 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}

              {/* Vote Rewards Section */}
              {activeSection === 'rewards' && (
                <VoteRewardsManager 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}

              {/* Alcor Farms Section */}
              {activeSection === 'alcor-farms' && (
                <AlcorFarmManager 
                  onTransactionComplete={handleTransactionComplete}
                  onTransactionSuccess={showSuccessDialog}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <TransactionSuccessDialog
      open={successOpen}
      onOpenChange={handleSuccessClose}
      title={successTitle}
      description={successDescription}
      txId={successTxId}
    />
    </>
  );
}
