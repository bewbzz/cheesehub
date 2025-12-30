import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWax } from "@/context/WaxContext";
import { buildNFTDepositAction, buildDepositNFTToTreasuryAction } from "@/lib/dao";
import { toast } from "sonner";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { waxRpcCall } from "@/lib/waxRpcFallback";
import { Loader2, ArrowDownToLine, Wallet, ImageIcon, Check, Search, RefreshCw, AlertCircle, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const ATOMIC_API_ENDPOINTS = [
  "https://wax.api.atomicassets.io",
  "https://aa.wax.blacklusion.io",
  "https://wax-aa.eu.eosamsterdam.net"
];

interface NFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
  mint: string;
}

interface TreasuryNFTDepositProps {
  daoName: string;
  onSuccess: () => void;
}

async function fetchWithFallback(path: string): Promise<Response> {
  for (const endpoint of ATOMIC_API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}${path}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) return response;
    } catch {
      continue;
    }
  }
  throw new Error("All AtomicAssets endpoints failed");
}

export function TreasuryNFTDeposit({ daoName, onSuccess }: TreasuryNFTDepositProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loadProgress, setLoadProgress] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);

  const filteredNFTs = useMemo(() => {
    if (!searchQuery.trim()) return nfts;
    const query = searchQuery.toLowerCase();
    return nfts.filter((nft) =>
      nft.name.toLowerCase().includes(query) ||
      nft.collection.toLowerCase().includes(query) ||
      nft.asset_id.includes(query)
    );
  }, [nfts, searchQuery]);

  const loadUserNFTs = useCallback(async () => {
    if (!session) return;

    const accountName = String(session.actor);
    setLoadingNFTs(true);
    setNfts([]);
    setSelectedNFTs(new Set());
    setLoadProgress("Verifying on-chain ownership...");

    try {
      // Step 1: Get on-chain owned asset IDs from atomicassets contract
      const ownedAssetIds: string[] = [];
      let more = true;
      let lowerBound = "";

      while (more) {
        const result = await waxRpcCall<{
          rows: Array<{ asset_id: string; owner: string }>;
          more: boolean;
          next_key: string;
        }>("/v1/chain/get_table_rows", {
          code: "atomicassets",
          scope: accountName,
          table: "assets",
          limit: 1000,
          lower_bound: lowerBound,
          json: true
        });

        for (const row of result.rows) {
          ownedAssetIds.push(row.asset_id);
        }

        more = result.more;
        lowerBound = result.next_key;
      }

      if (ownedAssetIds.length === 0) {
        setNfts([]);
        setLoadingNFTs(false);
        setLoadProgress("");
        setHasLoaded(true);
        return;
      }

      setLoadProgress(`Found ${ownedAssetIds.length} NFTs, fetching metadata...`);

      // Step 2: Fetch metadata from AtomicAssets API in batches
      const batchSize = 100;
      const allNFTs: NFT[] = [];

      for (let i = 0; i < ownedAssetIds.length; i += batchSize) {
        const batch = ownedAssetIds.slice(i, i + batchSize);
        setLoadProgress(`Loading metadata... ${Math.min(i + batchSize, ownedAssetIds.length)}/${ownedAssetIds.length}`);

        try {
          const idsParam = batch.join(",");
          const response = await fetchWithFallback(
            `/atomicassets/v1/assets?ids=${idsParam}&page=1&limit=${batchSize}&order=desc&sort=asset_id`
          );
          const data = await response.json();

          if (data.success && data.data) {
            for (const asset of data.data) {
              const imgData = asset.data?.img || asset.template?.immutable_data?.img || "";
              let imageUrl = "";
              if (imgData.startsWith("http")) {
                imageUrl = imgData;
              } else if (imgData.startsWith("Qm") || imgData.startsWith("bafy")) {
                imageUrl = `https://ipfs.io/ipfs/${imgData}`;
              } else if (imgData) {
                imageUrl = `https://ipfs.io/ipfs/${imgData}`;
              }

              allNFTs.push({
                asset_id: asset.asset_id,
                name: asset.name || asset.data?.name || asset.template?.immutable_data?.name || `Asset #${asset.asset_id}`,
                image: imageUrl,
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
                template_id: asset.template?.template_id || "",
                mint: asset.template_mint || "N/A"
              });
            }
          }
        } catch (err) {
          console.warn("Failed to fetch batch metadata:", err);
          // Add basic entries for assets without metadata
          for (const assetId of batch) {
            if (!allNFTs.find(n => n.asset_id === assetId)) {
              allNFTs.push({
                asset_id: assetId,
                name: `Asset #${assetId}`,
                image: "",
                collection: "Unknown",
                schema: "",
                template_id: "",
                mint: "N/A"
              });
            }
          }
        }
      }

      // Sort by asset_id descending (newest first)
      allNFTs.sort((a, b) => Number(b.asset_id) - Number(a.asset_id));
      setNfts(allNFTs);
      setHasLoaded(true);

    } catch (err) {
      console.error("Failed to load NFTs:", err);
      toast.error("Failed to load NFTs");
    } finally {
      setLoadingNFTs(false);
      setLoadProgress("");
    }
  }, [session]);

  const toggleNFT = useCallback((assetId: string) => {
    setSelectedNFTs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNFTs(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedNFTs(new Set(filteredNFTs.map((nft) => nft.asset_id)));
  }, [filteredNFTs]);

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
      await loadUserNFTs();
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
          onClick={loadUserNFTs}
          disabled={loadingNFTs}
        >
          {loadingNFTs ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">{hasLoaded ? "Refresh" : "Load NFTs"}</span>
        </Button>
      </div>

      {loadingNFTs ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cheese mb-2" />
          <p className="text-sm text-muted-foreground">{loadProgress || "Loading your NFTs..."}</p>
          <p className="text-xs text-muted-foreground mt-1">NFTs may take up to 30 seconds to load, please be patient</p>
        </div>
      ) : !hasLoaded ? (
        <div className="text-center py-6 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Click "Load NFTs" to fetch your NFTs</p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No NFTs found in your wallet</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, collection, or asset ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {filteredNFTs.length} NFT{filteredNFTs.length !== 1 ? "s" : ""} available
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

          {filteredNFTs.length === 0 && searchQuery.trim() ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No NFTs matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
              {filteredNFTs.map((nft) => (
                <NFTCard
                  key={nft.asset_id}
                  nft={nft}
                  isSelected={selectedNFTs.has(nft.asset_id)}
                  onToggle={() => toggleNFT(nft.asset_id)}
                />
              ))}
            </div>
          )}

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
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Anyone can deposit NFTs. To withdraw, create an NFT Transfer proposal.
      </p>
    </div>
  );
}

interface NFTCardProps {
  nft: NFT;
  isSelected: boolean;
  onToggle: () => void;
}

function NFTCard({ nft, isSelected, onToggle }: NFTCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
        isSelected
          ? "border-cheese ring-2 ring-cheese/30"
          : "border-border/50 hover:border-cheese/50"
      )}
    >
      {nft.image && !imageError ? (
        <img
          src={nft.image}
          alt={nft.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      {isSelected && (
        <div className="absolute inset-0 bg-cheese/20 flex items-center justify-center">
          <Check className="h-6 w-6 text-cheese" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
        <p className="text-[10px] text-white truncate">{nft.name}</p>
        <p className="text-[8px] text-white/70 truncate">{nft.collection}</p>
      </div>
    </button>
  );
}
