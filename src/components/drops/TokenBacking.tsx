import { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Check, Loader2, Search, Image, Coins, RefreshCw, Info, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import {
  BACKING_TOKENS,
  BackingTokenKey,
  BackingConfig,
  getTokenDetails,
  buildBackNftActions,
  validateBackingConfig,
} from '@/lib/tokenBacking';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type SortOption = 'collection' | 'name' | 'newest' | 'oldest';

// IPFS gateway fallback list
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

export function TokenBacking() {
  const { session, isConnected, login, refreshBalance } = useWax();
  const accountName = session?.actor?.toString() || '';
  const { nfts, isLoading, loadingProgress, refetch, collections } = useUserNFTs(accountName);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [isBacking, setIsBacking] = useState(false);
  const [showCustomToken, setShowCustomToken] = useState(false);

  // Backing configuration
  const [config, setConfig] = useState<BackingConfig>({
    tokenKey: 'CHEESE',
    amountPerNFT: 100,
    customContract: '',
    customSymbol: '',
    customPrecision: 4,
  });

  const debouncedSearch = useDebounce(searchQuery, 300);
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nfts];

    if (collectionFilter !== 'all') {
      result = result.filter((nft) => nft.collection === collectionFilter);
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (nft) =>
          nft.name.toLowerCase().includes(query) ||
          nft.collection.toLowerCase().includes(query) ||
          nft.asset_id.includes(query)
      );
    }

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

  // Virtual grid - 4 columns for proper visibility
  const COLUMNS = 4;
  const ROW_HEIGHT = 140;
  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);

  const loadedImagesRef = useRef<Set<string>>(new Set());

  const handleImageLoaded = useCallback((assetId: string) => {
    loadedImagesRef.current.add(assetId);
  }, []);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  const toggleNFTSelection = useCallback((assetId: string) => {
    setSelectedNFTs((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else if (next.size < 50) {
        next.add(assetId);
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

  const tokenDetails = getTokenDetails(config);
  const totalAmount = config.amountPerNFT * selectedNFTs.size;

  const handleBack = async () => {
    if (!session || selectedNFTs.size === 0) return;

    const validationError = validateBackingConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsBacking(true);
    try {
      const assetIds = Array.from(selectedNFTs);
      const actions = buildBackNftActions(
        accountName,
        assetIds,
        config,
        session.permissionLevel
      );

      await session.transact({ actions } as { actions: typeof actions });

      toast.success(`Successfully backed ${assetIds.length} NFT(s) with ${totalAmount.toFixed(tokenDetails.precision)} ${tokenDetails.symbol}!`);
      setSelectedNFTs(new Set());
      await refreshBalance();
      refetch();
    } catch (error) {
      console.error('Token backing failed:', error);
      closeWharfkitModals();

      const errorMessage = error instanceof Error ? error.message : 'Backing failed';
      if (!errorMessage.toLowerCase().includes('cancel')) {
        toast.error('Token backing failed', { description: errorMessage });
      }
    } finally {
      setIsBacking(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  if (!isConnected) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-muted-foreground mb-6">
            Connect your WAX wallet to back NFTs with tokens.
          </p>
          <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="border-cheese/30 bg-cheese/5">
        <Info className="h-4 w-4 text-cheese" />
        <AlertDescription className="text-sm">
          Token backing locks tokens inside your NFTs. When the NFT is burned, the backed tokens are released to the burner.
          This gives your NFTs intrinsic value.
        </AlertDescription>
      </Alert>

      {/* Token Configuration */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            Token Configuration
          </CardTitle>
          <CardDescription>Choose the token and amount to back each NFT with</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Token</Label>
              <Select
                value={config.tokenKey}
                onValueChange={(v) => {
                  const key = v as BackingTokenKey | 'CUSTOM';
                  setConfig((prev) => ({ ...prev, tokenKey: key }));
                  setShowCustomToken(key === 'CUSTOM');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHEESE">🧀 CHEESE (4 decimals)</SelectItem>
                  <SelectItem value="WAX">💎 WAX (8 decimals)</SelectItem>
                  <SelectItem value="CUSTOM">⚙️ Custom Token</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount per NFT</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={config.amountPerNFT}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, amountPerNFT: parseFloat(e.target.value) || 0 }))
                }
                placeholder="100"
              />
            </div>
          </div>

          {/* Custom Token Fields */}
          <Collapsible open={showCustomToken}>
            <CollapsibleContent className="space-y-4 pt-4 border-t border-border/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Token Contract</Label>
                  <Input
                    value={config.customContract}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, customContract: e.target.value.toLowerCase() }))
                    }
                    placeholder="e.g., eosio.token"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    value={config.customSymbol}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, customSymbol: e.target.value.toUpperCase() }))
                    }
                    placeholder="e.g., WAX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precision</Label>
                  <Input
                    type="number"
                    min="0"
                    max="18"
                    value={config.customPrecision}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, customPrecision: parseInt(e.target.value) || 4 }))
                    }
                    placeholder="4"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* NFT Selection */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Select NFTs to Back</CardTitle>
              <CardDescription>Choose up to 50 NFTs per transaction</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={collectionFilter} onValueChange={setCollectionFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[120px]">
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

          {/* Selection Actions */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isLoading && loadingProgress.total > 0 ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading {loadingProgress.loaded}/{loadingProgress.total}...
                </span>
              ) : (
                <>
                  {selectedNFTs.size} selected {selectedNFTs.size >= 50 && '(max 50)'}
                </>
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} disabled={filteredNFTs.length === 0}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedNFTs.size === 0}>
                Clear
              </Button>
            </div>
          </div>

          {/* Virtualized NFT Grid */}
          <div ref={parentRef} className="h-[280px] overflow-auto rounded-md border border-border">
            {isLoading && nfts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading NFTs...</span>
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Image className="h-8 w-8 mb-2" />
                <p>{nfts.length === 0 ? 'No NFTs in wallet' : 'No NFTs match filter'}</p>
              </div>
            ) : (
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
                      className="grid grid-cols-4 gap-2 p-1"
                    >
                      {rowNFTs.map((nft) => (
                        <NFTCard
                          key={nft.asset_id}
                          nft={nft}
                          isSelected={selectedNFTs.has(nft.asset_id)}
                          onToggle={() => toggleNFTSelection(nft.asset_id)}
                          isImageCached={loadedImagesRef.current.has(nft.asset_id)}
                          onImageLoaded={handleImageLoaded}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary & Action */}
      {selectedNFTs.size > 0 && (
        <Card className="bg-cheese/5 border-cheese/30">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-sm text-muted-foreground">Total to lock:</p>
                <p className="text-2xl font-bold text-cheese">
                  {totalAmount.toLocaleString(undefined, { maximumFractionDigits: tokenDetails.precision })}{' '}
                  {tokenDetails.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config.amountPerNFT} {tokenDetails.symbol} × {selectedNFTs.size} NFT(s)
                </p>
              </div>
              <Button
                onClick={handleBack}
                disabled={isBacking || selectedNFTs.size === 0}
                size="lg"
                className="bg-cheese hover:bg-cheese/90 text-cheese-foreground min-w-[200px]"
              >
                {isBacking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Backing...
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    Back {selectedNFTs.size} NFT(s)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface NFTCardProps {
  nft: UserNFT;
  isSelected: boolean;
  onToggle: () => void;
  isImageCached?: boolean;
  onImageLoaded?: (assetId: string) => void;
}

function NFTCard({ nft, isSelected, onToggle, isImageCached, onImageLoaded }: NFTCardProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(isImageCached ?? false);
  const [retryCount, setRetryCount] = useState(0);

  const ipfsHash = extractIpfsHash(nft.image);
  const hasValidImage = Boolean(nft.image && nft.image.length > 0);

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
      setGatewayIndex((prev) => prev + 1);
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

  const showErrorState = !hasValidImage || imgError;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'group relative rounded-md overflow-hidden border-2 transition-all hover:opacity-90 h-[130px]',
        isSelected ? 'border-cheese ring-1 ring-cheese' : 'border-transparent hover:border-muted-foreground/30'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 bg-cheese rounded-full p-0.5">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-muted h-[90px] flex items-center justify-center">
        {showErrorState ? (
          <div 
            className="w-full h-full flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted transition-colors z-10"
            onClick={handleRetry}
            title="Click to retry loading image"
          >
            <Image className="h-5 w-5 text-cheese mb-1" />
            <span className="text-[9px] text-cheese font-medium">Retry</span>
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
        <span className="text-cheese font-mono text-xs font-bold">#{nft.asset_id}</span>
      </div>
    </button>
  );
}
