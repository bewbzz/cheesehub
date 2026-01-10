import { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWax } from "@/context/WaxContext";
import { useUserNFTs, UserNFT } from "@/hooks/useUserNFTs";
import { useDebounce } from "@/hooks/useDebounce";
import { buildNFTDepositAction, buildDepositNFTToTreasuryAction } from "@/lib/dao";
import { toast } from "sonner";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, ArrowDownToLine, Wallet, Check, Search, RefreshCw, Image, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreasuryNFTDepositProps {
  daoName: string;
  onSuccess: () => void;
}

type SortOption = "newest" | "oldest" | "name" | "collection";

export function TreasuryNFTDeposit({ daoName, onSuccess }: TreasuryNFTDepositProps) {
  const { session, accountName } = useWax();
  const { nfts, isLoading, loadingProgress, refetch, collections } = useUserNFTs(accountName);

  const [loading, setLoading] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");

  const debouncedSearch = useDebounce(searchQuery, 300);
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    let result = [...nfts];

    // Filter by collection
    if (collectionFilter !== "all") {
      result = result.filter((nft) => nft.collection === collectionFilter);
    }

    // Filter by search query
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (nft) =>
          nft.name.toLowerCase().includes(query) ||
          nft.collection.toLowerCase().includes(query) ||
          nft.asset_id.includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "collection":
        result.sort((a, b) => a.collection.localeCompare(b.collection));
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        result.sort((a, b) => parseInt(b.asset_id) - parseInt(a.asset_id));
        break;
      case "oldest":
        result.sort((a, b) => parseInt(a.asset_id) - parseInt(b.asset_id));
        break;
    }

    return result;
  }, [nfts, collectionFilter, debouncedSearch, sortBy]);

  // Virtual grid - 4 columns
  const COLUMNS = 4;
  const ROW_HEIGHT = 130;
  const rowCount = Math.ceil(filteredNFTs.length / COLUMNS);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  const toggleNFT = useCallback((assetId: string) => {
    setSelectedNFTs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        // Limit to 50 NFTs per transaction
        if (newSet.size < 50) {
          newSet.add(assetId);
        }
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNFTs(new Set());
  }, []);

  const selectAll = useCallback(() => {
    // If all filtered are selected, deselect all
    const allSelected = filteredNFTs.length > 0 && filteredNFTs.every((nft) => selectedNFTs.has(nft.asset_id));
    if (allSelected) {
      setSelectedNFTs(new Set());
    } else {
      // Select up to 50
      const idsToSelect = filteredNFTs.slice(0, 50).map((nft) => nft.asset_id);
      setSelectedNFTs(new Set(idsToSelect));
    }
  }, [filteredNFTs, selectedNFTs]);

  async function handleDeposit() {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (selectedNFTs.size === 0) {
      toast.error("Please select at least one NFT");
      return;
    }

    setLoading(true);
    try {
      const assetIds = Array.from(selectedNFTs);
      const nftDepositAction = buildNFTDepositAction(
        String(session.actor),
        daoName,
        assetIds
      );
      const transferAction = buildDepositNFTToTreasuryAction(
        String(session.actor),
        daoName,
        assetIds
      );

      await session.transact({ actions: [nftDepositAction, transferAction] });
      toast.success(`Successfully deposited ${selectedNFTs.size} NFT(s) to treasury!`);
      setSelectedNFTs(new Set());
      refetch();
      onSuccess();
    } catch (error) {
      console.error("Failed to deposit NFTs:", error);
      closeWharfkitModals();
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("CPU") || errorMessage.includes("cpu")) {
        toast.error("Transaction failed - not enough CPU. Try using CHEESEUp to power up your account.");
      } else {
        toast.error(errorMessage || "Failed to deposit NFTs");
      }
    } finally {
      setLoading(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  if (!session) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg text-center">
        <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Connect your wallet to deposit NFTs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-cheese" />
          <h4 className="font-medium">Deposit NFTs to Treasury</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, collection, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Collection Filter */}
          <Select value={collectionFilter} onValueChange={setCollectionFilter}>
            <SelectTrigger className="w-[130px]">
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
            <SelectTrigger className="w-[110px]">
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

      {/* Selection Actions & Loading Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {loadingProgress ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading {loadingProgress.loaded}/{loadingProgress.total}...
            </span>
          ) : (
            <>
              {selectedNFTs.size} selected {selectedNFTs.size >= 50 && "(max 50)"}
            </>
          )}
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

      {/* Virtualized NFT Grid */}
      <div
        ref={parentRef}
        className="h-[240px] overflow-auto rounded-md border border-border"
      >
        {isLoading && nfts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="flex items-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading NFTs...</span>
            </div>
            <span className="text-xs text-muted-foreground/70">May take up to 30 seconds, please be patient</span>
          </div>
        ) : filteredNFTs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Image className="h-8 w-8 mb-2" />
            <p>{nfts.length === 0 ? "No NFTs in wallet" : "No NFTs match filter"}</p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIndex = virtualRow.index * COLUMNS;
              const rowNFTs = filteredNFTs.slice(startIndex, startIndex + COLUMNS);

              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
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
                      onToggle={() => toggleNFT(nft.asset_id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected NFTs Summary */}
      {selectedNFTs.size > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            {selectedNFTs.size} NFT{selectedNFTs.size !== 1 ? "s" : ""} selected
          </span>
        </div>
      )}

      <Button
        onClick={handleDeposit}
        disabled={loading || selectedNFTs.size === 0}
        className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Depositing...
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Deposit {selectedNFTs.size > 0 ? `${selectedNFTs.size} NFT(s)` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Anyone can deposit NFTs. To withdraw, create an NFT Transfer proposal.
      </p>
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
        "relative rounded-md overflow-hidden border-2 transition-all hover:opacity-90 h-[120px]",
        isSelected
          ? "border-cheese ring-1 ring-cheese"
          : "border-transparent hover:border-muted-foreground/30"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 z-10 bg-cheese rounded-full p-0.5">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-muted h-[80px]">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover"
            loading="lazy"
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
