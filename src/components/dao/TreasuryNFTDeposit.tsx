import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { buildNFTDepositAction, buildDepositNFTToTreasuryAction, fetchUserNFTs, TreasuryNFT } from "@/lib/dao";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Wallet, ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreasuryNFTDepositProps {
  daoName: string;
  onSuccess: () => void;
  onTransactionStart?: () => void;
  onTransactionEnd?: () => void;
}

export function TreasuryNFTDeposit({ daoName, onSuccess, onTransactionStart, onTransactionEnd }: TreasuryNFTDepositProps) {
  const { session } = useWax();
  const [loading, setLoading] = useState(false);
  const [nfts, setNfts] = useState<TreasuryNFT[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session) {
      loadUserNFTs();
    }
  }, [session]);

  async function loadUserNFTs() {
    if (!session) return;
    setLoadingNFTs(true);
    try {
      const userNFTs = await fetchUserNFTs(String(session.actor));
      setNfts(userNFTs);
    } catch (error) {
      console.error("Failed to load NFTs:", error);
    } finally {
      setLoadingNFTs(false);
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

    setLoading(true);
    onTransactionStart?.();
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
      toast.error(error instanceof Error ? error.message : "Failed to deposit NFTs");
    } finally {
      setLoading(false);
      onTransactionEnd?.();
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
            "Refresh"
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
                onClick={() => toggleNFT(nft.asset_id)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
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
