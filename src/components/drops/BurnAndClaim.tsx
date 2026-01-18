import { useState, useMemo, useCallback, useEffect } from 'react';
import { Flame, Search, Coins, AlertTriangle, Loader2, Filter } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWax } from '@/context/WaxContext';
import { useUserNFTs } from '@/hooks/useUserNFTs';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { closeWharfkitModals, isLoginActive } from '@/lib/wharfKit';
import {
  fetchMultipleAssetBackings,
  calculateTotalBacking,
  buildBatchBurnActions,
  AssetWithBacking,
  BackedToken,
} from '@/lib/tokenBacking';

// IPFS gateways for image loading
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('Qm') || url.startsWith('bafy')) return url;
  const match = url.match(/(?:ipfs\/|ipfs:\/\/)(Qm[a-zA-Z0-9]+|bafy[a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc' | 'backed-first';

export function BurnAndClaim() {
  const { session, accountName } = useWax();
  
  // NFT fetching
  const { nfts, isLoading: nftsLoading, collections } = useUserNFTs(accountName || null);
  
  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('backed-first');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [showOnlyBacked, setShowOnlyBacked] = useState(true);
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  
  // Backing data
  const [backingMap, setBackingMap] = useState<Map<string, BackedToken[]>>(new Map());
  const [backingLoading, setBackingLoading] = useState(false);
  const [backingFetched, setBackingFetched] = useState(false);
  
  // Transaction state
  const [isBurning, setIsBurning] = useState(false);
  
  const debouncedSearch = useDebounce(search, 300);
  
  // Fetch backing data when NFTs load
  useEffect(() => {
    async function fetchBacking() {
      if (!nfts.length || backingFetched || !accountName) return;
      
      setBackingLoading(true);
      try {
        const assetIds = nfts.map(nft => nft.asset_id);
        const result = await fetchMultipleAssetBackings(assetIds, accountName);
        setBackingMap(result);
        setBackingFetched(true);
      } catch (error) {
        console.error('Failed to fetch backing data:', error);
        toast.error('Failed to load NFT backing data');
      } finally {
        setBackingLoading(false);
      }
    }
    
    fetchBacking();
  }, [nfts, backingFetched, accountName]);
  
  // Build NFTs with backing info
  const nftsWithBacking: AssetWithBacking[] = useMemo(() => {
    return nfts.map(nft => ({
      asset_id: nft.asset_id,
      name: nft.name || `#${nft.asset_id}`,
      collection: nft.collection || 'Unknown',
      template_id: nft.template_id || '',
      image: nft.image || '',
      backed_tokens: backingMap.get(nft.asset_id) || [],
    }));
  }, [nfts, backingMap]);
  
  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nftsWithBacking];
    
    // Filter by search
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(
        nft =>
          nft.name.toLowerCase().includes(searchLower) ||
          nft.asset_id.includes(searchLower) ||
          nft.collection.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by collection
    if (collectionFilter && collectionFilter !== 'all') {
      result = result.filter(nft => nft.collection === collectionFilter);
    }
    
    // Filter by backed only
    if (showOnlyBacked) {
      result = result.filter(nft => nft.backed_tokens.length > 0);
    }
    
    // Sort
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'id-asc':
        result.sort((a, b) => parseInt(a.asset_id) - parseInt(b.asset_id));
        break;
      case 'id-desc':
        result.sort((a, b) => parseInt(b.asset_id) - parseInt(a.asset_id));
        break;
      case 'backed-first':
        result.sort((a, b) => b.backed_tokens.length - a.backed_tokens.length);
        break;
    }
    
    return result;
  }, [nftsWithBacking, debouncedSearch, collectionFilter, showOnlyBacked, sortBy]);
  
  // Virtual grid - 6 columns
  const COLUMNS = 6;
  const ROW_HEIGHT = 100;
  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);
  
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.getElementById('burn-nft-grid-container'),
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });
  
  // Selection handlers
  const toggleNFTSelection = useCallback((assetId: string) => {
    setSelectedNFTs(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else if (next.size < 50) {
        next.add(assetId);
      } else {
        toast.warning('Maximum 50 NFTs per transaction');
      }
      return next;
    });
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedNFTs(new Set());
  }, []);
  
  const selectAllVisible = useCallback(() => {
    const newSet = new Set<string>();
    const limit = Math.min(filteredNFTs.length, 50);
    for (let i = 0; i < limit; i++) {
      newSet.add(filteredNFTs[i].asset_id);
    }
    setSelectedNFTs(newSet);
  }, [filteredNFTs]);
  
  // Get selected NFTs with backing info
  const selectedWithBacking = useMemo(() => {
    return nftsWithBacking.filter(nft => selectedNFTs.has(nft.asset_id));
  }, [nftsWithBacking, selectedNFTs]);
  
  // Calculate totals
  const totalBacking = useMemo(() => {
    return calculateTotalBacking(selectedWithBacking);
  }, [selectedWithBacking]);
  
  const backedCount = useMemo(() => {
    return selectedWithBacking.filter(nft => nft.backed_tokens.length > 0).length;
  }, [selectedWithBacking]);
  
  // Burn handler
  const handleBurn = async () => {
    if (!session || selectedNFTs.size === 0) return;
    
    setIsBurning(true);
    try {
      const assetIds = Array.from(selectedNFTs);
      const actions = assetIds.map((assetId) => ({
        account: 'atomicassets',
        name: 'burnasset',
        authorization: [session.permissionLevel],
        data: {
          asset_owner: accountName,
          asset_id: parseInt(assetId),
        },
      }));
      
      await session.transact({ actions });
      
      toast.success(`Successfully burned ${assetIds.length} NFT(s)!`);
      
      // Clear selection and reset backing cache
      setSelectedNFTs(new Set());
      setBackingFetched(false);
    } catch (error: any) {
      console.error('Burn failed:', error);
      
      if (error?.message?.includes('CPU')) {
        toast.error('Not enough CPU. Power up your account first.', {
          action: {
            label: 'Power Up',
            onClick: () => window.open('/powerup', '_blank'),
          },
        });
      } else {
        toast.error(error?.message || 'Failed to burn NFTs');
      }
    } finally {
      setIsBurning(false);
      if (!isLoginActive()) {
        closeWharfkitModals();
        setTimeout(() => closeWharfkitModals(), 300);
      }
    }
  };
  
  // Not connected state
  if (!session) {
    return (
      <div className="text-center py-12">
        <Flame className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
        <p className="text-muted-foreground">
          Connect your wallet to burn NFTs and claim backed tokens.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Warning Alert */}
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> Burning NFTs is <strong>irreversible</strong>. 
          Burned NFTs are permanently destroyed. Any backed tokens will be automatically 
          released to your wallet.
        </AlertDescription>
      </Alert>
      
      {/* Filters */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter NFTs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            {/* Collection Filter */}
            <Select value={collectionFilter} onValueChange={setCollectionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Collections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Collections</SelectItem>
                {collections.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backed-first">Backed First</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
                <SelectItem value="id-asc">ID (Low-High)</SelectItem>
                <SelectItem value="id-desc">ID (High-Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Only Backed Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="only-backed"
              checked={showOnlyBacked}
              onCheckedChange={(checked) => setShowOnlyBacked(checked as boolean)}
            />
            <Label htmlFor="only-backed" className="text-sm cursor-pointer">
              Show only NFTs with backed tokens
            </Label>
          </div>
        </CardContent>
      </Card>
      
      {/* NFT Selection */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Select NFTs to Burn ({selectedNFTs.size}/50)
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {nftsLoading || backingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">
                {nftsLoading ? 'Loading NFTs...' : 'Fetching backing data...'}
              </span>
            </div>
          ) : filteredNFTs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {showOnlyBacked
                ? 'No NFTs with backed tokens found.'
                : 'No NFTs found matching your filters.'}
            </div>
          ) : (
            <div
              id="burn-nft-grid-container"
              className="h-[400px] overflow-auto rounded-lg border border-border/30"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const startIndex = virtualRow.index * COLUMNS;
                  const rowNFTs = filteredNFTs.slice(startIndex, startIndex + COLUMNS);
                  
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="grid grid-cols-6 gap-2 px-2"
                    >
                      {rowNFTs.map((nft) => (
                        <NFTCard
                          key={nft.asset_id}
                          nft={nft}
                          isSelected={selectedNFTs.has(nft.asset_id)}
                          onToggle={() => toggleNFTSelection(nft.asset_id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Summary & Action */}
      {selectedNFTs.size > 0 && (
        <Card className="bg-card/50 border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <p className="font-medium">
                  {selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''} selected
                  {backedCount > 0 && (
                    <span className="text-muted-foreground">
                      {' '}({backedCount} with backing)
                    </span>
                  )}
                </p>
                
                {totalBacking.size > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">You will receive:</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(totalBacking.entries()).map(([symbol, data]) => (
                        <Badge key={symbol} variant="secondary" className="text-sm">
                          <Coins className="h-3 w-3 mr-1" />
                          {data.amount.toFixed(data.precision)} {symbol}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="lg"
                    disabled={isBurning}
                    className="gap-2"
                  >
                    {isBurning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Flame className="h-4 w-4" />
                    )}
                    Burn {selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''}
                    {totalBacking.size > 0 && ' & Claim Tokens'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <Flame className="h-5 w-5" />
                      Confirm Burn
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-4">
                        <p>
                          You are about to permanently burn{' '}
                          <strong>{selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''}</strong>.
                          This action <strong>cannot be undone</strong>.
                        </p>
                        
                        {totalBacking.size > 0 && (
                          <div className="p-3 bg-muted rounded-lg space-y-2">
                            <p className="font-medium text-foreground">
                              You will receive:
                            </p>
                            {Array.from(totalBacking.entries()).map(([symbol, data]) => (
                              <div key={symbol} className="flex items-center gap-2 text-foreground">
                                <Coins className="h-4 w-4 text-cheese" />
                                <span>
                                  {data.amount.toFixed(data.precision)} {symbol}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBurn}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Yes, Burn NFTs
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// NFT Card Component
interface NFTCardProps {
  nft: AssetWithBacking;
  isSelected: boolean;
  onToggle: () => void;
}

function NFTCard({ nft, isSelected, onToggle }: NFTCardProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  
  const hasBacking = nft.backed_tokens.length > 0;
  
  useEffect(() => {
    const hash = extractIpfsHash(nft.image);
    if (hash) {
      setImgSrc(`${IPFS_GATEWAYS[0]}${hash}`);
    } else if (nft.image) {
      setImgSrc(nft.image);
    }
    setGatewayIndex(0);
    setImgError(false);
  }, [nft.image]);
  
  const handleImageError = () => {
    const hash = extractIpfsHash(nft.image);
    if (hash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      const nextIndex = gatewayIndex + 1;
      setGatewayIndex(nextIndex);
      setImgSrc(`${IPFS_GATEWAYS[nextIndex]}${hash}`);
    } else {
      setImgError(true);
    }
  };
  
  return (
    <button
      onClick={onToggle}
      className={cn(
        'group relative rounded-md overflow-hidden border-2 transition-all hover:opacity-90 aspect-square',
        isSelected
          ? 'border-destructive ring-1 ring-destructive'
          : 'border-transparent hover:border-muted-foreground/30'
      )}
    >
      {/* Image */}
      {imgSrc && !imgError ? (
        <img
          src={imgSrc}
          alt={nft.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">No Image</span>
        </div>
      )}
      
      {/* Backing indicator */}
      {hasBacking && (
        <div className="absolute top-1 right-1 p-1 rounded-full bg-cheese/90">
          <Coins className="h-3 w-3 text-background" />
        </div>
      )}
      
      {/* Selection overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
          <Flame className="h-6 w-6 text-destructive" />
        </div>
      )}
      
      {/* Hover info */}
      <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-white truncate">{nft.name}</p>
      </div>
    </button>
  );
}
