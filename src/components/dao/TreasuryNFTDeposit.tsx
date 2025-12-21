import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildDepositNFTToTreasuryAction, fetchUserNFTs, TreasuryNFT } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Wallet, ImageIcon, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreasuryNFTDepositProps {
  daoName: string;
  onSuccess: () => void;
}

export function TreasuryNFTDeposit({ daoName, onSuccess }: TreasuryNFTDepositProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [nfts, setNfts] = useState<TreasuryNFT[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  
  // Use ref to track if component is still mounted during async operations
  const isMountedRef = useRef(true);
  // Store selected count before transaction to avoid state issues
  const selectedCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    if (session) {
      loadUserNFTs();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [session]);

  async function loadUserNFTs() {
    if (!session) return;
    setLoadingNFTs(true);
    try {
      const userNFTs = await fetchUserNFTs(String(session.actor));
      if (isMountedRef.current) {
        setNfts(userNFTs);
      }
    } catch (error) {
      console.error("Failed to load NFTs:", error);
    } finally {
      if (isMountedRef.current) {
        setLoadingNFTs(false);
      }
    }
  }

  function toggleNFT(assetId: string) {
    const newSelected = new Set(selectedNFTs);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedNFTs(newSelected);
  }

  async function handleDeposit() {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (selectedNFTs.size === 0) {
      toast.error("Please select at least one NFT");
      return;
    }

    // Store count before transaction starts
    selectedCountRef.current = selectedNFTs.size;
    const assetIds = Array.from(selectedNFTs);

    setLoading(true);
    setProcessingMessage(null);
    
    try {
      const action = buildDepositNFTToTreasuryAction(
        String(session.actor),
        daoName,
        assetIds
      );

      await session.transact({ actions: [action] });
      
      // Transaction succeeded - update state only if still mounted
      if (isMountedRef.current) {
        setSelectedNFTs(new Set());
        toast.success(`Successfully deposited ${selectedCountRef.current} NFT(s)!`);
        
        // Refresh user's NFTs immediately
        await loadUserNFTs();
        
        // Wait for blockchain indexers before refreshing treasury
        setProcessingMessage("Waiting for blockchain to sync...");
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        if (isMountedRef.current) {
          setProcessingMessage(null);
          onSuccess();
        }
      }
    } catch (error: unknown) {
      console.error("Failed to deposit NFTs:", error);
      
      if (!isMountedRef.current) return;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Detect user cancellation - these are not errors
      const isCancellation = 
        errorMessage.toLowerCase().includes("modal closed") ||
        errorMessage.toLowerCase().includes("rejected") ||
        errorMessage.toLowerCase().includes("cancelled") ||
        errorMessage.toLowerCase().includes("canceled") ||
        errorMessage.toLowerCase().includes("user rejected") ||
        errorMessage.toLowerCase().includes("user denied") ||
        errorMessage.toLowerCase().includes("aborted");
      
      if (isCancellation) {
        toast.info("Transaction cancelled");
      } else {
        toast.error(errorMessage || "Failed to deposit NFTs");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setProcessingMessage(null);
      }
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
          disabled={loadingNFTs || loading}
        >
          {loadingNFTs ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {loadingNFTs ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cheese" />
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No NFTs found in your wallet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
            {nfts.map((nft) => (
              <button
                key={nft.asset_id}
                onClick={() => !loading && toggleNFT(nft.asset_id)}
                disabled={loading}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                  loading && "opacity-50 cursor-not-allowed",
                  selectedNFTs.has(nft.asset_id)
                    ? "border-cheese ring-2 ring-cheese/30"
                    : "border-border/50 hover:border-cheese/50"
                )}
              >
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                {selectedNFTs.has(nft.asset_id) && (
                  <div className="absolute inset-0 bg-cheese/20 flex items-center justify-center">
                    <Check className="h-6 w-6 text-cheese" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                  <p className="text-[10px] text-white truncate">{nft.name}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Selected:</span>
            <span className="font-medium">{selectedNFTs.size} NFT(s)</span>
          </div>

          {processingMessage && (
            <div className="flex items-center justify-center gap-2 p-2 bg-cheese/10 rounded-lg text-sm text-cheese">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingMessage}
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
                {processingMessage ? "Processing..." : "Depositing..."}
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
