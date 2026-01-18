import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Flame, Search, AlertTriangle, Loader2, Filter, RefreshCw, Image as ImageIcon, Coins } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWax } from '@/context/WaxContext';
import { useUserNFTs } from '@/hooks/useUserNFTs';
import { useDebounce } from '@/hooks/useDebounce';
import { useNFTBacking } from '@/hooks/useNFTBacking';
import { buildBurnAssetAction, buildWaxdaoClaimAction } from '@/lib/tokenBacking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { closeWharfkitModals, isLoginActive } from '@/lib/wharfKit';

// IPFS gateways for image loading
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+.*)/);
  if (ipfsMatch) return ipfsMatch[1];
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  return null;
}

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc';

export function BurnAndClaim() {
  const { session, accountName } = useWax();
  
  // NFT fetching
  const { nfts, isLoading: nftsLoading, loadingProgress, refetch, collections } = useUserNFTs(accountName || null);
  
  // Build NFTs list with collection for backing lookup
  const nftList = useMemo(() => {
    return nfts.map(nft => ({
      asset_id: nft.asset_id,
      name: nft.name || `#${nft.asset_id}`,
      collection: nft.collection || 'Unknown',
      template_id: nft.template_id || '',
      image: nft.image || '',
    }));
  }, [nfts]);
  
  // Backing info hook
  const { 
    hasAnyBacking, 
    getBackingDisplay, 
    calculateTotalsForSelection, 
    formatTotalsList,
    isLoading: backingLoading,
    refetch: refetchBacking,
  } = useNFTBacking(nftList);
  
  // UI state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('id-desc');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  
  // Transaction state
  const [isBurning, setIsBurning] = useState(false);
  
  // Virtualization ref
  const parentRef = useRef<HTMLDivElement>(null);
  const loadedImagesRef = useRef<Set<string>>(new Set());
  
  const debouncedSearch = useDebounce(search, 300);
  
  const handleImageLoaded = useCallback((assetId: string) => {
    loadedImagesRef.current.add(assetId);
  }, []);
  
  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nftList];
    
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
    }
    
    return result;
  }, [nftList, debouncedSearch, collectionFilter, sortBy]);
  
  // Virtual grid - 4 columns for better visibility
  const COLUMNS = 4;
  const ROW_HEIGHT = 140;
  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);
  
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
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
  
  // Calculate backing totals for selected NFTs
  const selectedBackingTotals = useMemo(() => {
    const assetIds = Array.from(selectedNFTs);
    return calculateTotalsForSelection(assetIds);
  }, [selectedNFTs, calculateTotalsForSelection]);
  
  const formattedTotals = useMemo(() => {
    return formatTotalsList(selectedBackingTotals);
  }, [selectedBackingTotals, formatTotalsList]);
  
  const hasBackedTokens = formattedTotals.native.length > 0 || formattedTotals.waxdao.length > 0;
  
  // Burn handler - now separates burn and claim into two transactions
  const handleBurn = async () => {
    if (!session || selectedNFTs.size === 0) return;
    
    setIsBurning(true);
    const assetIds = Array.from(selectedNFTs);
    const hasWaxdaoBacking = selectedBackingTotals.waxdaoAssetIds.length > 0;
    
    try {
      // 1. Build burn actions for all selected NFTs
      const burnActions: any[] = [];
      for (const assetId of assetIds) {
        burnActions.push(buildBurnAssetAction(accountName!, assetId, session.permissionLevel));
      }
      
      // Execute burn transaction first
      await session.transact({ actions: burnActions });
      
      const nativeMsg = formattedTotals.native.length > 0 
        ? ` Native backing (${formattedTotals.native.join(', ')}) claimed!` 
        : '';
      
      toast.success(`Burned ${assetIds.length} NFT(s)!${nativeMsg}`);
      
      // 2. If WaxDAO backing exists, wait for contract state update then claim
      if (hasWaxdaoBacking) {
        toast.info('WaxDAO backing detected. Claiming tokens in 3 seconds...', {
          duration: 3000,
        });
        
        // Wait for the burn notification to propagate in the contract
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const claimAction = buildWaxdaoClaimAction(
            accountName!,
            selectedBackingTotals.waxdaoAssetIds,
            session.permissionLevel
          );
          
          console.log('WaxDAO Claim action:', JSON.stringify(claimAction, null, 2));
          
          await session.transact({ actions: [claimAction] as any });
          
          toast.success(`Claimed WaxDAO backed tokens: ${formattedTotals.waxdao.join(', ')}`);
        } catch (claimError: any) {
          console.error('WaxDAO claim failed:', claimError);
          
          // Provide helpful guidance for manual claim
          if (claimError?.message?.includes('user not found') || claimError?.message?.includes('no tokens')) {
            toast.error(
              'WaxDAO claim pending. The contract may need more time to process. Use "Claim Backed Tokens" tab to claim manually.',
              { duration: 8000 }
            );
          } else {
            toast.error(`Claim failed: ${claimError?.message || 'Unknown error'}. Try manual claim.`);
          }
        }
      }
      
      // Clear selection and refetch
      setSelectedNFTs(new Set());
      setTimeout(() => {
        refetch();
        refetchBacking();
      }, 2000);
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
    <TooltipProvider>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter NFTs ({nfts.length} total)
                {backingLoading && (
                  <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading backing...
                  </span>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refetch();
                  refetchBacking();
                }}
                disabled={nftsLoading || backingLoading}
                className="h-7 px-2"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", (nftsLoading || backingLoading) && "animate-spin")} />
              </Button>
            </div>
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
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="id-asc">ID (Low-High)</SelectItem>
                  <SelectItem value="id-desc">ID (High-Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {/* NFT Selection */}
        <Card className="bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Select NFTs to Burn
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {nftsLoading && loadingProgress.total > 0 ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading {loadingProgress.loaded}/{loadingProgress.total}...
                    </span>
                  ) : (
                    <>
                      {selectedNFTs.size} selected {selectedNFTs.size >= 50 && '(max 50 per tx)'}
                    </>
                  )}
                </p>
              </div>
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
            {nftsLoading && nfts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="flex items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading NFTs...</span>
                </div>
                <span className="text-xs text-muted-foreground/70">May take up to 30 seconds for large collections</span>
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No NFTs found matching your filters.
              </div>
            ) : (
              <div
                ref={parentRef}
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
                        className="grid grid-cols-4 gap-2 px-2 py-1"
                      >
                        {rowNFTs.map((nft) => (
                          <NFTCard
                            key={nft.asset_id}
                            nft={nft}
                            isSelected={selectedNFTs.has(nft.asset_id)}
                            onToggle={() => toggleNFTSelection(nft.asset_id)}
                            isImageCached={loadedImagesRef.current.has(nft.asset_id)}
                            onImageLoaded={handleImageLoaded}
                            hasBacking={hasAnyBacking(nft.asset_id)}
                            backingDisplay={getBackingDisplay(nft.asset_id)}
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
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-medium">
                    {selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''} selected
                  </p>
                  
                  {/* Backed tokens summary */}
                  {hasBackedTokens && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-primary" />
                        Tokens you will receive:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {formattedTotals.native.map((token, i) => (
                          <Badge key={`native-${i}`} variant="secondary" className="font-mono text-xs">
                            {token}
                            <span className="ml-1 text-muted-foreground">(Native)</span>
                          </Badge>
                        ))}
                        {formattedTotals.waxdao.map((token, i) => (
                          <Badge key={`waxdao-${i}`} variant="outline" className="font-mono text-xs border-primary/50">
                            {token}
                            <span className="ml-1 text-primary">(WaxDAO)</span>
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
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <Flame className="h-5 w-5" />
                        Confirm Burn
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-3">
                          <p>
                            You are about to permanently burn{' '}
                            <strong>{selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? 's' : ''}</strong>.
                            This action <strong>cannot be undone</strong>.
                          </p>
                          
                          {hasBackedTokens && (
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Coins className="h-4 w-4 text-primary" />
                                Tokens you will receive:
                              </p>
                              <div className="space-y-1 text-sm">
                                {formattedTotals.native.map((token, i) => (
                                  <div key={`native-${i}`} className="flex items-center gap-2">
                                    <span className="font-mono">{token}</span>
                                    <span className="text-muted-foreground">(auto-released)</span>
                                  </div>
                                ))}
                                {formattedTotals.waxdao.map((token, i) => (
                                  <div key={`waxdao-${i}`} className="flex items-center gap-2">
                                    <span className="font-mono text-primary">{token}</span>
                                    <span className="text-muted-foreground">(WaxDAO claim)</span>
                                  </div>
                                ))}
                              </div>
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
    </TooltipProvider>
  );
}

// NFT Card Component with backing indicator
interface NFTCardProps {
  nft: {
    asset_id: string;
    name: string;
    collection: string;
    template_id: string;
    image: string;
  };
  isSelected: boolean;
  onToggle: () => void;
  isImageCached?: boolean;
  onImageLoaded?: (assetId: string) => void;
  hasBacking?: boolean;
  backingDisplay?: string[];
}

function NFTCard({ 
  nft, 
  isSelected, 
  onToggle, 
  isImageCached, 
  onImageLoaded,
  hasBacking,
  backingDisplay = [],
}: NFTCardProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(isImageCached ?? false);
  const [retryCount, setRetryCount] = useState(0);
  
  const ipfsHash = extractIpfsHash(nft.image);
  const hasValidImage = Boolean(nft.image && nft.image.length > 0);
  
  // Build current image URL with cache-busting on retry
  const currentImageUrl = useMemo(() => {
    if (!nft.image) return '';
    if (ipfsHash) {
      const baseUrl = `${IPFS_GATEWAYS[gatewayIndex]}${ipfsHash}`;
      return retryCount > 0 ? `${baseUrl}?retry=${retryCount}` : baseUrl;
    }
    const separator = nft.image.includes('?') ? '&' : '?';
    return retryCount > 0 ? `${nft.image}${separator}retry=${retryCount}` : nft.image;
  }, [nft.image, ipfsHash, gatewayIndex, retryCount]);
  
  const handleImageError = useCallback(() => {
    if (ipfsHash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      setGatewayIndex(prev => prev + 1);
      setImgLoaded(false);
    } else {
      setImgError(true);
    }
  }, [ipfsHash, gatewayIndex]);
  
  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setImgLoaded(false);
    setGatewayIndex(0);
    setRetryCount(prev => prev + 1);
  };
  
  // Show error state if no valid image or if loading failed
  const showErrorState = !hasValidImage || imgError;
  
  return (
    <button
      onClick={onToggle}
      className={cn(
        'group relative rounded-md overflow-hidden border-2 transition-all hover:opacity-90 h-[130px]',
        isSelected
          ? 'border-destructive ring-2 ring-destructive'
          : 'border-transparent hover:border-muted-foreground/30'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 p-1 rounded-full bg-destructive">
          <Flame className="h-3 w-3 text-white" />
        </div>
      )}
      
      {/* Backing indicator */}
      {hasBacking && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "absolute top-1 z-10 p-1 rounded-full bg-primary/90",
                isSelected ? "left-1" : "right-1"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Coins className="h-3 w-3 text-primary-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="font-medium text-xs mb-1">Backed Tokens:</p>
            {backingDisplay.map((line, i) => (
              <p key={i} className="text-xs font-mono">{line}</p>
            ))}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Image */}
      <div className="aspect-square bg-muted h-[90px] flex items-center justify-center">
        {showErrorState ? (
          <div 
            className="w-full h-full flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted transition-colors z-10"
            onClick={handleRetry}
            title="Click to retry loading image"
          >
            <ImageIcon className="h-5 w-5 text-destructive mb-1" />
            <span className="text-[9px] text-destructive font-medium">Retry</span>
          </div>
        ) : (
          <img
            src={currentImageUrl}
            alt={nft.name}
            className={cn(
              "w-full h-full object-cover transition-opacity",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
            loading="lazy"
            onError={handleImageError}
            onLoad={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.naturalWidth === 0) {
                handleImageError();
              } else {
                setImgLoaded(true);
                onImageLoaded?.(nft.asset_id);
              }
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-1 bg-background/80 absolute bottom-0 left-0 right-0">
        <p className="text-[10px] font-medium truncate">{nft.name}</p>
        <span className="text-[9px] text-muted-foreground truncate block">
          {nft.collection}
        </span>
      </div>
      {/* Asset ID overlay on hover */}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <span className="text-destructive font-mono text-xs font-bold">#{nft.asset_id}</span>
      </div>
    </button>
  );
}
