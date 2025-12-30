import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWax } from '@/context/WaxContext';
import { useUserNFTs, UserNFT } from '@/hooks/useUserNFTs';
import { useDebounce } from '@/hooks/useDebounce';
import { Check, X, Loader2, Search, Image, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';

interface NFTSendManagerProps {
  onTransactionSuccess: (title: string, description: string, txId: string | null) => void;
}

type SortOption = 'collection' | 'name' | 'newest' | 'oldest';

function isValidWaxAccount(account: string): boolean {
  if (!account || account.length < 1 || account.length > 12) return false;
  return /^[a-z1-5.]+$/.test(account);
}

export function NFTSendManager({ onTransactionSuccess }: NFTSendManagerProps) {
  const { accountName, transferNFTs } = useWax();
  const { nfts, isLoading, refetch, collections } = useUserNFTs(accountName);

  const [recipient, setRecipient] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const isValidRecipient = recipient.length > 0 && isValidWaxAccount(recipient);
  const canSend = isValidRecipient && selectedNFTs.size > 0 && !isSending;

  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nfts];

    // Filter by collection
    if (collectionFilter !== 'all') {
      result = result.filter((nft) => nft.collection === collectionFilter);
    }

    // Filter by search query
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (nft) =>
          nft.name.toLowerCase().includes(query) ||
          nft.collection.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'collection':
        result.sort((a, b) => a.collection.localeCompare(b.collection));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        result.sort((a, b) => parseInt(b.asset_id) - parseInt(a.asset_id));
        break;
      case 'oldest':
        result.sort((a, b) => parseInt(a.asset_id) - parseInt(b.asset_id));
        break;
    }

    return result;
  }, [nfts, collectionFilter, debouncedSearch, sortBy]);

  const toggleNFTSelection = useCallback((assetId: string) => {
    setSelectedNFTs((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        // Limit to 50 NFTs per transaction
        if (next.size < 50) {
          next.add(assetId);
        }
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNFTs(new Set());
  }, []);

  const selectAll = useCallback(() => {
    const idsToSelect = filteredNFTs.slice(0, 50).map((nft) => nft.asset_id);
    setSelectedNFTs(new Set(idsToSelect));
  }, [filteredNFTs]);

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const assetIds = Array.from(selectedNFTs);
      const txId = await transferNFTs(recipient, assetIds, memo);

      if (txId) {
        onTransactionSuccess(
          'NFTs Sent Successfully!',
          `Sent ${assetIds.length} NFT(s) to ${recipient}`,
          txId
        );
        setRecipient('');
        setMemo('');
        setSelectedNFTs(new Set());
        refetch();
      }
    } catch (error) {
      console.error('NFT transfer failed:', error);
      
      // Close any stuck WharfKit modals
      closeWharfkitModals();
      
      const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
      const isCpuError = errorMessage.toLowerCase().includes('cpu') ||
                         errorMessage.toLowerCase().includes('billed') ||
                         errorMessage.toLowerCase().includes('net usage') ||
                         errorMessage.toLowerCase().includes('deadline exceeded');

      if (isCpuError) {
        toast.error('Transaction failed - insufficient resources', {
          description: 'Enable Greymass Fuel in Anchor settings, or use the CHEESEUp page to rent CPU.',
          duration: 8000,
        });
      } else if (!errorMessage.toLowerCase().includes('cancel')) {
        toast.error('NFT transfer failed', {
          description: errorMessage,
        });
      }
    } finally {
      setIsSending(false);
      // Always try to clean up modals after transaction attempt
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const selectedNFTsList = useMemo(() => {
    return nfts.filter((nft) => selectedNFTs.has(nft.asset_id));
  }, [nfts, selectedNFTs]);

  return (
    <div className="space-y-4">
      {/* Recipient */}
      <div className="space-y-2">
        <Label htmlFor="nft-recipient">Recipient</Label>
        <div className="relative">
          <Input
            id="nft-recipient"
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

      {/* Search and Filters */}
      <div className="space-y-2">
        <Label>Select NFTs to Send</Label>
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Collection Filter */}
          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({nfts.length})</SelectItem>
              {collections.map((col) => (
                <SelectItem key={col.name} value={col.name}>
                  {col.name} ({col.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="collection">Collection</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selection Actions */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {selectedNFTs.size} selected {selectedNFTs.size >= 50 && '(max 50)'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={filteredNFTs.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={selectedNFTs.size === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* NFT Grid */}
      <ScrollArea className="h-[240px] rounded-md border border-border p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading NFTs...</span>
          </div>
        ) : filteredNFTs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Image className="h-8 w-8 mb-2" />
            <p>{nfts.length === 0 ? 'No NFTs in wallet' : 'No NFTs match filter'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {filteredNFTs.map((nft) => (
              <NFTCard
                key={nft.asset_id}
                nft={nft}
                isSelected={selectedNFTs.has(nft.asset_id)}
                onToggle={() => toggleNFTSelection(nft.asset_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Selected NFTs Summary */}
      {selectedNFTsList.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Selected: </span>
          {selectedNFTsList.slice(0, 3).map((nft) => nft.name).join(', ')}
          {selectedNFTsList.length > 3 && ` +${selectedNFTsList.length - 3} more`}
        </div>
      )}

      {/* Memo */}
      <div className="space-y-2">
        <Label htmlFor="nft-memo">Memo (optional)</Label>
        <Input
          id="nft-memo"
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
            Sending {selectedNFTs.size} NFT(s)...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send {selectedNFTs.size > 0 ? `${selectedNFTs.size} NFT(s)` : 'NFTs'}
          </>
        )}
      </Button>
    </div>
  );
}

interface NFTCardProps {
  nft: UserNFT;
  isSelected: boolean;
  onToggle: () => void;
}

function NFTCard({ nft, isSelected, onToggle }: NFTCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative rounded-md overflow-hidden border-2 transition-all hover:opacity-90',
        isSelected
          ? 'border-cheese ring-1 ring-cheese'
          : 'border-transparent hover:border-muted-foreground/30'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 bg-cheese rounded-full p-0.5">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-muted">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-1 bg-background/80 absolute bottom-0 left-0 right-0">
        <p className="text-[10px] font-medium truncate">{nft.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground truncate max-w-[60%]">
            {nft.collection}
          </span>
          <span className="text-[9px] text-muted-foreground">#{nft.mint}</span>
        </div>
      </div>
    </button>
  );
}
