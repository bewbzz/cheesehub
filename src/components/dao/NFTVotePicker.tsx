import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DaoInfo, fetchVotedNFTs } from "@/lib/dao";
import { fetchUserNFTsBySchema } from "@/services/atomicApi";
import { Loader2, Image, AlertCircle } from "lucide-react";

interface NFTVotePickerProps {
  dao: DaoInfo;
  proposalId: number;
  userAccount: string;
  onSelect: (assetIds: string[]) => void;
  disabled?: boolean;
}

interface EligibleNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
}

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function getImageUrl(img: string): string {
  if (!img) return '/placeholder.svg';
  if (img.startsWith('http')) return img;
  if (img.startsWith('Qm') || img.startsWith('bafy')) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img;
}

export function NFTVotePicker({ dao, proposalId, userAccount, onSelect, disabled }: NFTVotePickerProps) {
  const [loading, setLoading] = useState(true);
  const [eligibleNFTs, setEligibleNFTs] = useState<EligibleNFT[]>([]);
  const [votedAssetIds, setVotedAssetIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's eligible NFTs and already-voted NFTs
  useEffect(() => {
    async function loadNFTs() {
      if (!userAccount || !dao.gov_schemas || dao.gov_schemas.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Fetch in parallel: user's eligible NFTs and already-voted NFTs for this proposal
        const collections = dao.gov_schemas.map(s => s.collection_name);
        const schemas = dao.gov_schemas.map(s => s.schema_name);
        
        const [userNFTs, voted] = await Promise.all([
          fetchUserNFTsBySchema(userAccount, collections, schemas),
          fetchVotedNFTs(proposalId)
        ]);
        
        setEligibleNFTs(userNFTs);
        setVotedAssetIds(voted);
      } catch (err) {
        console.error("Failed to load NFTs for voting:", err);
        setError("Failed to load your NFTs");
      } finally {
        setLoading(false);
      }
    }

    loadNFTs();
  }, [userAccount, dao.gov_schemas, proposalId]);

  // Filter out NFTs that have already voted
  const availableNFTs = useMemo(() => {
    return eligibleNFTs.filter(nft => !votedAssetIds.includes(nft.asset_id));
  }, [eligibleNFTs, votedAssetIds]);

  // Update parent when selection changes
  useEffect(() => {
    onSelect(selectedIds);
  }, [selectedIds, onSelect]);

  function toggleSelection(assetId: string) {
    setSelectedIds(prev => 
      prev.includes(assetId)
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  }

  function selectAll() {
    setSelectedIds(availableNFTs.map(nft => nft.asset_id));
  }

  function selectNone() {
    setSelectedIds([]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-cheese mr-2" />
        <span className="text-sm text-muted-foreground">Loading your NFTs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive p-2 bg-destructive/10 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (eligibleNFTs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-500 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
        <Image className="h-4 w-4" />
        <span>
          You don't have any NFTs from the eligible collections to vote with.
        </span>
      </div>
    );
  }

  if (availableNFTs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
        <Image className="h-4 w-4" />
        <span>
          All your eligible NFTs ({eligibleNFTs.length}) have already voted on this proposal.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Select NFTs to vote with ({selectedIds.length}/{availableNFTs.length} selected)
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll} disabled={disabled}>
            Select All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={selectNone} disabled={disabled || selectedIds.length === 0}>
            Clear
          </Button>
        </div>
      </div>
      
      {votedAssetIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {votedAssetIds.length} of your NFTs have already voted on this proposal.
        </p>
      )}
      
      <ScrollArea className="h-40 border border-border/50 rounded-lg p-2">
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {availableNFTs.map((nft) => (
            <div
              key={nft.asset_id}
              onClick={() => !disabled && toggleSelection(nft.asset_id)}
              className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                selectedIds.includes(nft.asset_id)
                  ? "border-cheese ring-2 ring-cheese/30"
                  : "border-transparent hover:border-muted-foreground/30"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="aspect-square bg-muted">
                <img
                  src={getImageUrl(nft.image)}
                  alt={nft.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute top-1 right-1">
                <Checkbox
                  checked={selectedIds.includes(nft.asset_id)}
                  className="bg-background/80"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="flex flex-wrap gap-1">
        {dao.gov_schemas.map((schema, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {schema.collection_name}/{schema.schema_name}
          </Badge>
        ))}
      </div>
      
      {selectedIds.length > 0 && (
        <p className="text-xs text-cheese">
          Your vote will have a weight of {selectedIds.length} (1 per NFT)
        </p>
      )}
    </div>
  );
}
