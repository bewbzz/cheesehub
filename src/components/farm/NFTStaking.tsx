import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  ArrowUpFromLine,
  ArrowDownToLine,
  Coins,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import {
  FARM_CONTRACT,
  buildStakeNftsAction,
  buildUnstakeNftsAction,
  buildClaimRewardsAction,
  fetchUserStakes,
  fetchFarmStakableConfig,
  fetchPendingRewards,
  FarmInfo,
  UserStake,
  PendingReward,
} from "@/lib/farm";
import { ATOMIC_API } from "@/lib/waxConfig";
import { fetchWithFallback } from "@/lib/fetchWithFallback";

interface NFTAsset {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

interface NFTStakingProps {
  farm: FarmInfo;
}

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function getImageUrl(img: string | undefined): string {
  if (!img) return "/placeholder.svg";
  if (img.startsWith("http")) return img;
  if (img.startsWith("Qm") || img.startsWith("bafy")) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img || "/placeholder.svg";
}

export function NFTStaking({ farm }: NFTStakingProps) {
  const { session, isConnected, accountName } = useWax();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedToStake, setSelectedToStake] = useState<Set<string>>(new Set());
  const [selectedToUnstake, setSelectedToUnstake] = useState<Set<string>>(new Set());
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Fetch stakable config
  const { data: stakableConfig } = useQuery({
    queryKey: ["farmStakableConfig", farm.farm_name],
    queryFn: () => fetchFarmStakableConfig(farm.farm_name),
    staleTime: 60000,
  });

  // Fetch user's staked NFTs
  const { data: stakedNfts = [], isLoading: isLoadingStaked, refetch: refetchStaked } = useQuery({
    queryKey: ["userStakes", accountName, farm.farm_name],
    queryFn: () => fetchUserStakes(accountName!, farm.farm_name),
    enabled: !!accountName,
    staleTime: 30000,
  });

  // Fetch user's pending rewards
  const { data: pendingRewards = [], refetch: refetchRewards } = useQuery({
    queryKey: ["pendingRewards", accountName, farm.farm_name],
    queryFn: () => fetchPendingRewards(accountName!, farm.farm_name),
    enabled: !!accountName,
    staleTime: 30000,
  });

  // Fetch user's eligible NFTs for staking
  const { data: eligibleNfts = [], isLoading: isLoadingEligible, refetch: refetchEligible } = useQuery({
    queryKey: ["eligibleNfts", accountName, farm.farm_name, stakableConfig],
    queryFn: async () => {
      if (!accountName || !stakableConfig) return [];
      
      const assets: NFTAsset[] = [];
      const seenIds = new Set<string>();
      
      // Get all unique collections from config
      const collectionsToFetch = new Set<string>();
      stakableConfig.collections.forEach(c => collectionsToFetch.add(c));
      stakableConfig.schemas.forEach(s => collectionsToFetch.add(s.collection));
      stakableConfig.templates.forEach(t => collectionsToFetch.add(t.collection));
      
      // Fetch assets for each collection
      for (const collection of collectionsToFetch) {
        try {
          const params = new URLSearchParams({
            owner: accountName,
            collection_name: collection,
            limit: "100",
          });
          const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();
          
          if (json.success && json.data) {
            for (const asset of json.data) {
              if (seenIds.has(asset.asset_id)) continue;
              
              const assetCollection = asset.collection?.collection_name || "";
              const assetSchema = asset.schema?.schema_name || "";
              const assetTemplateId = parseInt(asset.template?.template_id || "0");
              
              // Check if asset matches any stakable config
              let isEligible = false;
              
              // Check collections
              if (stakableConfig.collections.includes(assetCollection)) {
                isEligible = true;
              }
              
              // Check schemas
              if (stakableConfig.schemas.some(s => 
                s.collection === assetCollection && s.schema === assetSchema
              )) {
                isEligible = true;
              }
              
              // Check templates
              if (stakableConfig.templates.some(t => 
                t.template_id === assetTemplateId
              )) {
                isEligible = true;
              }
              
              if (isEligible) {
                seenIds.add(asset.asset_id);
                assets.push({
                  asset_id: asset.asset_id,
                  name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
                  image: getImageUrl(asset.data?.img || asset.data?.image),
                  collection: assetCollection,
                  schema: assetSchema,
                  template_id: asset.template?.template_id || "",
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching assets for collection ${collection}:`, error);
        }
      }
      
      return assets;
    },
    enabled: !!accountName && !!stakableConfig,
    staleTime: 30000,
  });

  // Fetch staked NFT details
  const { data: stakedNftDetails = [], isLoading: isLoadingStakedDetails } = useQuery({
    queryKey: ["stakedNftDetails", stakedNfts],
    queryFn: async () => {
      if (!stakedNfts.length) return [];
      
      const assetIds = stakedNfts.map(s => s.asset_id).join(",");
      const params = new URLSearchParams({
        ids: assetIds,
        limit: "100",
      });
      const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
      
      try {
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
        const json = await response.json();
        
        if (json.success && json.data) {
          return json.data.map((asset: any) => ({
            asset_id: asset.asset_id,
            name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
            image: getImageUrl(asset.data?.img || asset.data?.image),
            collection: asset.collection?.collection_name || "",
            schema: asset.schema?.schema_name || "",
            template_id: asset.template?.template_id || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching staked NFT details:", error);
      }
      return [];
    },
    enabled: stakedNfts.length > 0,
    staleTime: 30000,
  });

  const handleStake = async () => {
    if (!session || selectedToStake.size === 0) return;
    
    setIsStaking(true);
    try {
      const assetIds = Array.from(selectedToStake);
      const action = buildStakeNftsAction(
        session.actor.toString(),
        farm.farm_name,
        assetIds
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "NFTs Staked!",
        description: `Successfully staked ${assetIds.length} NFT(s) to ${farm.farm_name}`,
      });
      
      setSelectedToStake(new Set());
      
      // Refetch data
      await Promise.all([
        refetchStaked(),
        refetchEligible(),
        refetchRewards(),
      ]);
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
    } catch (error) {
      console.error("Stake failed:", error);
      toast({
        title: "Staking Failed",
        description: error instanceof Error ? error.message : "Failed to stake NFTs",
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!session || selectedToUnstake.size === 0) return;
    
    setIsUnstaking(true);
    try {
      const assetIds = Array.from(selectedToUnstake);
      const action = buildUnstakeNftsAction(
        session.actor.toString(),
        farm.farm_name,
        assetIds
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "NFTs Unstaked!",
        description: `Successfully unstaked ${assetIds.length} NFT(s) from ${farm.farm_name}`,
      });
      
      setSelectedToUnstake(new Set());
      
      // Refetch data
      await Promise.all([
        refetchStaked(),
        refetchEligible(),
        refetchRewards(),
      ]);
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
    } catch (error) {
      console.error("Unstake failed:", error);
      toast({
        title: "Unstaking Failed",
        description: error instanceof Error ? error.message : "Failed to unstake NFTs",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaim = async () => {
    if (!session) return;
    
    setIsClaiming(true);
    try {
      const action = buildClaimRewardsAction(session.actor.toString(), farm.farm_name);
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "Rewards Claimed!",
        description: `Successfully claimed rewards from ${farm.farm_name}`,
      });
      
      await refetchRewards();
    } catch (error) {
      console.error("Claim failed:", error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim rewards",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const toggleStakeSelection = (assetId: string) => {
    const newSet = new Set(selectedToStake);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedToStake(newSet);
  };

  const toggleUnstakeSelection = (assetId: string) => {
    const newSet = new Set(selectedToUnstake);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedToUnstake(newSet);
  };

  const selectAllToStake = () => {
    setSelectedToStake(new Set(eligibleNfts.map(n => n.asset_id)));
  };

  const selectAllToUnstake = () => {
    setSelectedToUnstake(new Set(stakedNftDetails.map(n => n.asset_id)));
  };

  if (!isConnected) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-6 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Connect Wallet to Stake</h3>
          <p className="text-muted-foreground text-sm">
            Connect your WAX wallet to stake NFTs and earn rewards.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPendingRewards = pendingRewards.reduce((acc, r) => acc + r.amount, 0);
  const hasRewards = totalPendingRewards > 0;

  return (
    <div className="space-y-4">
      {/* Rewards Card */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-cheese" />
            Your Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              {pendingRewards.length > 0 ? (
                <div className="space-y-1">
                  {pendingRewards.map((reward, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-cheese/10 text-cheese border-cheese/20">
                        {reward.amount.toFixed(reward.precision)} {reward.symbol}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No pending rewards</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {stakedNfts.length} NFT(s) staked in this farm
              </p>
            </div>
            <Button
              onClick={handleClaim}
              disabled={isClaiming || !hasRewards}
              className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            >
              {isClaiming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Coins className="h-4 w-4 mr-2" />
              )}
              Claim Rewards
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staking Tabs */}
      <Card className="border-border/50 bg-card/50">
        <Tabs defaultValue="stake" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stake" className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Stake ({eligibleNfts.length})
              </TabsTrigger>
              <TabsTrigger value="unstake" className="gap-2">
                <ArrowUpFromLine className="h-4 w-4" />
                Unstake ({stakedNftDetails.length})
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <CardContent className="pt-4">
            {/* Stake Tab */}
            <TabsContent value="stake" className="mt-0">
              {isLoadingEligible ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : eligibleNfts.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No eligible NFTs found in your wallet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This farm accepts: {stakableConfig?.collections.join(", ") || "specific collections/templates"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedToStake.size} selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={selectAllToStake}>
                      Select All
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {eligibleNfts.map((nft) => (
                        <div
                          key={nft.asset_id}
                          onClick={() => toggleStakeSelection(nft.asset_id)}
                          className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all ${
                            selectedToStake.has(nft.asset_id)
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border/50 hover:border-border"
                          }`}
                        >
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs text-white font-medium truncate">{nft.name}</p>
                            <p className="text-xs text-white/60 truncate">{nft.collection}</p>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Checkbox
                              checked={selectedToStake.has(nft.asset_id)}
                              className="bg-background/80 border-border"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <Button
                      onClick={handleStake}
                      disabled={isStaking || selectedToStake.size === 0}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      {isStaking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4 mr-2" />
                      )}
                      Stake {selectedToStake.size} NFT(s)
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Unstake Tab */}
            <TabsContent value="unstake" className="mt-0">
              {isLoadingStaked || isLoadingStakedDetails ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : stakedNftDetails.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No NFTs staked in this farm</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedToUnstake.size} selected
                    </span>
                    <Button variant="ghost" size="sm" onClick={selectAllToUnstake}>
                      Select All
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {stakedNftDetails.map((nft) => (
                        <div
                          key={nft.asset_id}
                          onClick={() => toggleUnstakeSelection(nft.asset_id)}
                          className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all ${
                            selectedToUnstake.has(nft.asset_id)
                              ? "border-destructive ring-2 ring-destructive/20"
                              : "border-border/50 hover:border-border"
                          }`}
                        >
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs text-white font-medium truncate">{nft.name}</p>
                            <p className="text-xs text-white/60 truncate">{nft.collection}</p>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Checkbox
                              checked={selectedToUnstake.has(nft.asset_id)}
                              className="bg-background/80 border-border"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <Button
                      onClick={handleUnstake}
                      disabled={isUnstaking || selectedToUnstake.size === 0}
                      variant="destructive"
                      className="w-full"
                    >
                      {isUnstaking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4 mr-2" />
                      )}
                      Unstake {selectedToUnstake.size} NFT(s)
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}