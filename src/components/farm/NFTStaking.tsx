import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Package,
  ArrowUpFromLine,
  ArrowDownToLine,
  Coins,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  Search,
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
  FarmInfo,
  PendingReward,
} from "@/lib/farm";
import { ATOMIC_API, WAX_CHAIN } from "@/lib/waxConfig";
import { fetchWithFallback } from "@/lib/fetchWithFallback";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { waxRpcCall } from "@/lib/waxRpcFallback";
import { cn } from "@/lib/utils";

// Verify asset ownership directly from blockchain (real-time, no indexer delay)
// Supports pagination for wallets with 1000+ NFTs
async function verifyAssetOwnership(assetIds: string[], expectedOwner: string): Promise<Set<string>> {
  const ownedAssets = new Set<string>();
  
  try {
    let lowerBound = "";
    let hasMore = true;
    const BATCH_SIZE = 1000;
    let iterations = 0;
    const MAX_ITERATIONS = 10; // Max 10k NFTs
    
    while (hasMore && iterations < MAX_ITERATIONS) {
      const response = await fetch(`${WAX_CHAIN.rpcUrls[1]}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: true,
          code: 'atomicassets',
          scope: expectedOwner,
          table: 'assets',
          limit: BATCH_SIZE,
          lower_bound: lowerBound || undefined,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.rows && data.rows.length > 0) {
          for (const asset of data.rows) {
            ownedAssets.add(String(asset.asset_id));
          }
          
          // Set up for next page
          if (data.more && data.rows.length === BATCH_SIZE) {
            const lastAsset = data.rows[data.rows.length - 1];
            lowerBound = String(BigInt(lastAsset.asset_id) + 1n);
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      
      iterations++;
    }
  } catch (error) {
    console.error('Error verifying asset ownership from blockchain:', error);
    // If blockchain query fails, assume all assets are valid (fallback to API data)
    assetIds.forEach(id => ownedAssets.add(id));
  }
  
  return ownedAssets;
}

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Refs for virtualized lists
  const stakeParentRef = useRef<HTMLDivElement>(null);
  const unstakeParentRef = useRef<HTMLDivElement>(null);

  // Fetch stakable config
  const { data: stakableConfig } = useQuery({
    queryKey: ["farmStakableConfig", farm.farm_name],
    queryFn: () => fetchFarmStakableConfig(farm.farm_name),
    staleTime: 60000,
  });

  // Fetch user's staked NFTs
  const { data: stakedNfts = [], isLoading: isLoadingStaked, refetch: refetchStaked } = useQuery({
    queryKey: ["userStakes", accountName, farm.farm_name],
    queryFn: async () => {
      const stakes = await fetchUserStakes(accountName!, farm.farm_name);
      console.log("Fetched staked NFTs for", accountName, "in farm", farm.farm_name, ":", stakes);
      return stakes;
    },
    enabled: !!accountName,
    staleTime: 30000,
  });

  // State for live rewards that update in real-time
  const [liveRewards, setLiveRewards] = useState<PendingReward[]>([]);
  // State for pending rewards (will be added at next payout)
  const [pendingNextPayout, setPendingNextPayout] = useState<PendingReward[]>([]);
  // Countdown to next payout in seconds
  const [nextPayoutIn, setNextPayoutIn] = useState<number>(0);

  // Extract staking data for live calculation
  const stakerData = useMemo(() => {
    if (!stakedNfts.length) return null;
    const firstStake = stakedNfts[0] as {
      claimable_balances?: Array<{ quantity: string; contract: string }>;
      rates_per_hour?: Array<{ quantity: string; contract: string }>;
      last_state_change?: number;
    };
    return {
      claimableBalances: firstStake.claimable_balances || [],
      ratesPerHour: firstStake.rates_per_hour || [],
      lastStateChange: firstStake.last_state_change || 0,
    };
  }, [stakedNfts]);

  // Dynamic reward calculation based on completed payout periods
  useEffect(() => {
    if (!stakerData || !stakerData.claimableBalances.length) {
      setLiveRewards([]);
      setPendingNextPayout([]);
      setNextPayoutIn(0);
      return;
    }

    const calculateLiveRewards = () => {
      const now = Math.floor(Date.now() / 1000);
      const payoutInterval = farm.payout_interval || 3600; // Default 1 hour
      
      // Use USER's last_state_change, not farm's last_payout
      const userLastStateChange = stakerData.lastStateChange || now;
      
      // Calculate completed payout periods since USER's last state change
      const timeSinceUserStateChange = now - userLastStateChange;
      const completedPeriods = Math.floor(timeSinceUserStateChange / payoutInterval);
      const claimableHours = (completedPeriods * payoutInterval) / 3600;
      
      // Time remaining in current incomplete period (for countdown)
      const elapsedInCurrentPeriod = timeSinceUserStateChange % payoutInterval;
      const secondsUntilNextPayout = payoutInterval - elapsedInCurrentPeriod;
      setNextPayoutIn(secondsUntilNextPayout);

      // Calculate claimable rewards (base + accumulated from completed periods)
      const claimable = stakerData.claimableBalances.map((balance) => {
        const balanceParts = balance.quantity.split(" ");
        const baseAmount = parseFloat(balanceParts[0]) || 0;
        const symbol = balanceParts[1] || "";
        const precision = balanceParts[0].includes(".") ? balanceParts[0].split(".")[1]?.length || 0 : 0;
        const contract = balance.contract || "";

        // Find matching rate by symbol
        const rate = stakerData.ratesPerHour.find(r => r.quantity.includes(symbol));
        const rateAmount = rate ? parseFloat(rate.quantity.split(" ")[0]) : 0;

        // Claimable = base + (rate * hours from completed periods since user's last state change)
        const claimableAmount = baseAmount + (rateAmount * claimableHours);

        return { symbol, amount: claimableAmount, precision, contract };
      });

      // Calculate pending rewards (one full payout period worth)
      const pending = stakerData.ratesPerHour.map((rate) => {
        const rateParts = rate.quantity.split(" ");
        const rateAmount = parseFloat(rateParts[0]) || 0;
        const symbol = rateParts[1] || "";
        const precision = rateParts[0].includes(".") ? rateParts[0].split(".")[1]?.length || 0 : 0;
        const contract = rate.contract || "";
        
        // Pending = rate * hours_per_payout_period
        const hoursPerPeriod = payoutInterval / 3600;
        const pendingAmount = rateAmount * hoursPerPeriod;

        return { symbol, amount: pendingAmount, precision, contract };
      });

      setLiveRewards(claimable);
      setPendingNextPayout(pending);
    };

    calculateLiveRewards(); // Initial calculation
    const interval = setInterval(calculateLiveRewards, 1000); // Update countdown every second

    return () => clearInterval(interval);
  }, [stakerData, farm.payout_interval]);

  // Fallback to static rewards if live calculation not available
  const pendingRewards: PendingReward[] = useMemo(() => {
    if (liveRewards.length > 0) return liveRewards;
    if (!stakedNfts.length) return [];
    
    const claimableBalances = stakedNfts[0]?.claimable_balances;
    if (!claimableBalances || !Array.isArray(claimableBalances)) return [];
    
    return claimableBalances.map((b: { quantity: string; contract: string }) => {
      const parts = b.quantity.split(" ");
      const amount = parseFloat(parts[0]) || 0;
      const symbol = parts[1] || "";
      const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
      return { symbol, amount, precision };
    });
  }, [stakedNfts, liveRewards]);

  // Fetch user's eligible NFTs for staking (excludes already staked NFTs)
  const { data: eligibleNfts = [], isLoading: isLoadingEligible, refetch: refetchEligible } = useQuery({
    queryKey: ["eligibleNfts", accountName, farm.farm_name, stakableConfig, stakedNfts],
    queryFn: async () => {
      if (!accountName || !stakableConfig) return [];
      
      // Get set of already staked asset IDs to exclude
      const stakedAssetIds = new Set(stakedNfts.map(s => s.asset_id));
      
      const assets: NFTAsset[] = [];
      const seenIds = new Set<string>();
      
      // Get all unique collections from config
      const collectionsToFetch = new Set<string>();
      stakableConfig.collections.forEach(c => {
        if (c.collection) collectionsToFetch.add(c.collection);
      });
      stakableConfig.schemas.forEach(s => {
        if (s.collection) collectionsToFetch.add(s.collection);
      });
      stakableConfig.templates.forEach(t => {
        if (t.collection) collectionsToFetch.add(t.collection);
      });
      
      // Get template IDs for direct template lookup (in case collection is missing)
      const templateIds = stakableConfig.templates.map(t => t.template_id).filter(Boolean);
      
      // Cache-busting timestamp to bypass CDN caching
      const cacheBuster = `_ts=${Date.now()}`;
      
      // Strategy 1: Fetch by collection (for collection/schema-based farms)
      const collectionPromises = Array.from(collectionsToFetch).map(async (collection) => {
        const collectionAssets: NFTAsset[] = [];
        try {
          let page = 1;
          let hasMore = true;
          const PAGE_SIZE = 100;
          const MAX_PAGES = 10;
          
          while (hasMore && page <= MAX_PAGES) {
            const params = new URLSearchParams({
              owner: accountName,
              collection_name: collection,
              limit: String(PAGE_SIZE),
              page: String(page),
            });
            const path = `${ATOMIC_API.paths.assets}?${params.toString()}&${cacheBuster}`;
            const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
            const json = await response.json();
            
            if (json.success && json.data) {
              if (json.data.length < PAGE_SIZE) hasMore = false;
              
              for (const asset of json.data) {
                collectionAssets.push({
                  asset_id: asset.asset_id,
                  name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
                  image: getImageUrl(asset.data?.img || asset.data?.image),
                  collection: asset.collection?.collection_name || "",
                  schema: asset.schema?.schema_name || "",
                  template_id: asset.template?.template_id || "",
                });
              }
            } else {
              hasMore = false;
            }
            page++;
          }
        } catch (error) {
          console.error(`Error fetching assets for collection ${collection}:`, error);
        }
        return collectionAssets;
      });
      
      // Strategy 2: Fetch by template IDs directly (for template-based farms where collection might be missing)
      const templatePromises = templateIds.length > 0 ? (async () => {
        const templateAssets: NFTAsset[] = [];
        try {
          // Fetch in batches of 10 template IDs
          const batchSize = 10;
          for (let i = 0; i < templateIds.length; i += batchSize) {
            const batch = templateIds.slice(i, i + batchSize);
            const templateIdStr = batch.join(',');
            const params = new URLSearchParams({
              owner: accountName,
              template_id: templateIdStr,
              limit: '1000',
            });
            const path = `${ATOMIC_API.paths.assets}?${params.toString()}&${cacheBuster}`;
            const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
            const json = await response.json();
            
            if (json.success && json.data) {
              for (const asset of json.data) {
                templateAssets.push({
                  asset_id: asset.asset_id,
                  name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
                  image: getImageUrl(asset.data?.img || asset.data?.image),
                  collection: asset.collection?.collection_name || "",
                  schema: asset.schema?.schema_name || "",
                  template_id: asset.template?.template_id || "",
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching assets by template IDs:', error);
        }
        return templateAssets;
      })() : Promise.resolve([]);
      
      // Execute all fetches in parallel
      const [collectionResults, templateResults] = await Promise.all([
        Promise.all(collectionPromises),
        templatePromises,
      ]);
      
      // Merge all results
      const allFetchedAssets = [...collectionResults.flat(), ...templateResults];
      
      // Dedupe and filter
      for (const asset of allFetchedAssets) {
        if (seenIds.has(asset.asset_id)) continue;
        if (stakedAssetIds.has(asset.asset_id)) continue;
        
        const assetCollection = asset.collection;
        const assetSchema = asset.schema;
        const assetTemplateId = parseInt(asset.template_id || "0");
        
        // Check if asset matches any stakable config
        let isEligible = false;
        
        // Check collections
        if (stakableConfig.collections.some(c => c.collection === assetCollection)) {
          isEligible = true;
        }
        
        // Check schemas
        if (stakableConfig.schemas.some(s => 
          s.collection === assetCollection && s.schema === assetSchema
        )) {
          isEligible = true;
        }
        
        // Check templates (by ID only - collection might be missing in config)
        if (stakableConfig.templates.some(t => t.template_id === assetTemplateId)) {
          isEligible = true;
        }
        
        if (isEligible) {
          seenIds.add(asset.asset_id);
          assets.push(asset);
        }
      }
      
      // Verify ownership directly from blockchain to filter out transferred NFTs
      if (assets.length > 0) {
        const verifiedOwnership = await verifyAssetOwnership(
          assets.map(a => a.asset_id),
          accountName
        );
        
        const verifiedAssets = assets.filter(a => verifiedOwnership.has(a.asset_id));
        console.log(`Blockchain verification: ${assets.length} from API, ${verifiedAssets.length} verified on-chain`);
        return verifiedAssets;
      }
      
      return assets;
    },
    enabled: !!accountName && !!stakableConfig,
    staleTime: 0,
    gcTime: 0,
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
      
      await refetchStaked();
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
    if (selectedToStake.size === eligibleNfts.length) {
      setSelectedToStake(new Set());
    } else {
      setSelectedToStake(new Set(eligibleNfts.map(n => n.asset_id)));
    }
  };

  const selectAllToUnstake = () => {
    if (selectedToUnstake.size === stakedNftDetails.length) {
      setSelectedToUnstake(new Set());
    } else {
      setSelectedToUnstake(new Set(stakedNftDetails.map(n => n.asset_id)));
    }
  };

  const totalPendingRewards = pendingRewards.reduce((acc, r) => acc + r.amount, 0);
  const hasRewards = totalPendingRewards > 0;

  // Filtered NFTs based on search
  const filteredEligibleNfts = useMemo(() => {
    if (!searchQuery.trim()) return eligibleNfts;
    const query = searchQuery.toLowerCase();
    return eligibleNfts.filter(nft => 
      nft.name.toLowerCase().includes(query) ||
      nft.collection.toLowerCase().includes(query) ||
      nft.asset_id.includes(query)
    );
  }, [eligibleNfts, searchQuery]);

  const filteredStakedNfts = useMemo(() => {
    if (!searchQuery.trim()) return stakedNftDetails;
    const query = searchQuery.toLowerCase();
    return stakedNftDetails.filter(nft => 
      nft.name.toLowerCase().includes(query) ||
      nft.collection.toLowerCase().includes(query) ||
      nft.asset_id.includes(query)
    );
  }, [stakedNftDetails, searchQuery]);

  // Virtualization - 4 columns grid
  const COLUMNS = 4;
  const ROW_HEIGHT = 130;
  
  const stakeRowCount = Math.ceil(filteredEligibleNfts.length / COLUMNS);
  const unstakeRowCount = Math.ceil(filteredStakedNfts.length / COLUMNS);

  const stakeVirtualizer = useVirtualizer({
    count: stakeRowCount,
    getScrollElement: () => stakeParentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  const unstakeVirtualizer = useVirtualizer({
    count: unstakeRowCount,
    getScrollElement: () => unstakeParentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  // Manual refresh handler with cache invalidation and timeout
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Refresh timed out')), 15000)
      );

      // Race between refresh and timeout
      await Promise.race([
        (async () => {
          await queryClient.invalidateQueries({ queryKey: ["eligibleNfts", accountName, farm.farm_name] });
          await queryClient.invalidateQueries({ queryKey: ["userStakes", accountName, farm.farm_name] });
          await queryClient.invalidateQueries({ queryKey: ["stakedNftDetails"] });
          await Promise.all([refetchEligible(), refetchStaked()]);
        })(),
        timeoutPromise,
      ]);
      
      toast({
        title: "Refreshed",
        description: "NFT list updated from blockchain",
      });
    } catch (error) {
      console.error("Refresh failed:", error);
      toast({
        title: "Refresh Complete",
        description: "Data refreshed (some requests may have timed out)",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show stakeable assets for everyone, but staking UI only for connected users
  const renderStakeableAssets = () => (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Package className="h-4 w-4 text-muted-foreground" />
          Stakeable Assets
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        {/* Template-based farms */}
        {stakableConfig && stakableConfig.templates.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Templates: </span>
            <span className="text-foreground inline-flex flex-wrap gap-x-2 gap-y-1">
              {stakableConfig.templates.map((t, i) => (
                <span key={i} className="inline-flex items-center">
                  <a 
                    href={`https://wax.atomichub.io/explorer/template/wax-mainnet/${t.collection || 'unknown'}/${t.template_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono"
                  >
                    #{t.template_id}
                  </a>
                  {t.hourly_rates && t.hourly_rates.length > 0 ? (
                    <span className="text-cheese ml-1">
                      ({t.hourly_rates.map(r => r.quantity).join(' + ')}/hr)
                    </span>
                  ) : t.hourly_rate && t.hourly_rate !== "0" && (
                    <span className="text-cheese ml-1">({t.hourly_rate}/hr)</span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}
        
        {/* Schema-based farms */}
        {stakableConfig && stakableConfig.schemas.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Schemas: </span>
            <span className="text-foreground inline-flex flex-wrap gap-x-2 gap-y-1">
              {stakableConfig.schemas.map((s, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="text-primary">{s.collection}/{s.schema}</span>
                  {s.hourly_rates && s.hourly_rates.length > 0 ? (
                    <span className="text-cheese ml-1">
                      ({s.hourly_rates.map(r => r.quantity).join(' + ')}/hr)
                    </span>
                  ) : s.hourly_rate && s.hourly_rate !== "0" && (
                    <span className="text-cheese ml-1">({s.hourly_rate}/hr)</span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}
        
        {/* Collection-based farms */}
        {stakableConfig && stakableConfig.collections.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Collections: </span>
            <span className="text-foreground inline-flex flex-wrap gap-x-2 gap-y-1">
              {stakableConfig.collections.map((c, i) => (
                <span key={i} className="inline-flex items-center">
                  <a 
                    href={`https://wax.atomichub.io/explorer/collection/wax-mainnet/${c.collection}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {c.collection}
                  </a>
                  {c.hourly_rates && c.hourly_rates.length > 0 ? (
                    <span className="text-cheese ml-1">
                      ({c.hourly_rates.map(r => r.quantity).join(' + ')}/hr)
                    </span>
                  ) : c.hourly_rate && c.hourly_rate !== "0" && (
                    <span className="text-cheese ml-1">({c.hourly_rate}/hr)</span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}
        
        {/* Attribute-based farms */}
        {stakableConfig && stakableConfig.attributes && stakableConfig.attributes.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground">Attributes: </span>
            <span className="text-foreground inline-flex flex-wrap gap-x-2 gap-y-1">
              {stakableConfig.attributes.map((a, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="text-primary">{a.attribute_name}={a.attribute_value}</span>
                  {a.hourly_rates && a.hourly_rates.length > 0 ? (
                    <span className="text-cheese ml-1">
                      ({a.hourly_rates.map(r => r.quantity).join(' + ')}/hr)
                    </span>
                  ) : a.hourly_rate && a.hourly_rate !== "0" && (
                    <span className="text-cheese ml-1">({a.hourly_rate}/hr)</span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* No config found */}
        {(!stakableConfig || (stakableConfig.templates.length === 0 && stakableConfig.schemas.length === 0 && stakableConfig.collections.length === 0 && (!stakableConfig.attributes || stakableConfig.attributes.length === 0))) && (
          <p className="text-xs text-muted-foreground">
            {farm.farm_type === 1 && "Collection-based staking"}
            {farm.farm_type === 2 && "Schema-based staking"}
            {farm.farm_type === 3 && "Template-based staking"}
            {farm.farm_type === 4 && "Attribute-based staking"}
            {!farm.farm_type && "Loading requirements..."}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (!isConnected) {
    return (
      <div className="space-y-4">
        {renderStakeableAssets()}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Connect Wallet to Stake</h3>
            <p className="text-muted-foreground text-sm">
              Connect your WAX wallet to stake NFTs and earn rewards.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {renderStakeableAssets()}

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
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, collection, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

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
                    This farm accepts: {stakableConfig?.collections.map(c => c.collection).join(", ") || stakableConfig?.templates.map(t => `Template #${t.template_id}`).join(", ") || "specific collections/templates"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="mt-3"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    AtomicAssets indexing may have delays
                  </p>
                </div>
              ) : filteredEligibleNfts.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No NFTs match your search</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedToStake.size} selected {filteredEligibleNfts.length !== eligibleNfts.length && `(${filteredEligibleNfts.length} shown)`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-7 px-2"
                        title="Refresh NFT list"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={selectAllToStake}>
                      Select All
                    </Button>
                  </div>
                  <div
                    ref={stakeParentRef}
                    className="h-[300px] overflow-auto rounded-md border border-border"
                  >
                    <div
                      style={{
                        height: `${stakeVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {stakeVirtualizer.getVirtualItems().map((virtualRow) => {
                        const startIndex = virtualRow.index * COLUMNS;
                        const rowNFTs = filteredEligibleNfts.slice(startIndex, startIndex + COLUMNS);

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
                              <button
                                key={nft.asset_id}
                                onClick={() => toggleStakeSelection(nft.asset_id)}
                                className={cn(
                                  "relative rounded-md overflow-hidden border-2 transition-all h-[120px]",
                                  selectedToStake.has(nft.asset_id)
                                    ? "border-primary ring-1 ring-primary"
                                    : "border-transparent hover:border-muted-foreground/30"
                                )}
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
                                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                  <p className="text-[10px] text-white font-medium truncate">{nft.name}</p>
                                  <p className="text-[10px] text-white/60 truncate">{nft.collection}</p>
                                </div>
                                <div className="absolute top-1.5 right-1.5">
                                  <Checkbox
                                    checked={selectedToStake.has(nft.asset_id)}
                                    className="h-4 w-4 bg-background/80 border-border"
                                  />
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
              ) : filteredStakedNfts.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No staked NFTs match your search</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedToUnstake.size} selected {filteredStakedNfts.length !== stakedNftDetails.length && `(${filteredStakedNfts.length} shown)`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={selectAllToUnstake}>
                      Select All
                    </Button>
                  </div>
                  <div
                    ref={unstakeParentRef}
                    className="h-[300px] overflow-auto rounded-md border border-border"
                  >
                    <div
                      style={{
                        height: `${unstakeVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {unstakeVirtualizer.getVirtualItems().map((virtualRow) => {
                        const startIndex = virtualRow.index * COLUMNS;
                        const rowNFTs = filteredStakedNfts.slice(startIndex, startIndex + COLUMNS);

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
                              <button
                                key={nft.asset_id}
                                onClick={() => toggleUnstakeSelection(nft.asset_id)}
                                className={cn(
                                  "relative rounded-md overflow-hidden border-2 transition-all h-[120px]",
                                  selectedToUnstake.has(nft.asset_id)
                                    ? "border-destructive ring-1 ring-destructive"
                                    : "border-transparent hover:border-muted-foreground/30"
                                )}
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
                                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                  <p className="text-[10px] text-white font-medium truncate">{nft.name}</p>
                                  <p className="text-[10px] text-white/60 truncate">{nft.collection}</p>
                                </div>
                                <div className="absolute top-1.5 right-1.5">
                                  <Checkbox
                                    checked={selectedToUnstake.has(nft.asset_id)}
                                    className="h-4 w-4 bg-background/80 border-border"
                                  />
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

      {/* Rewards Card */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-cheese" />
              Your Rewards
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStaked()}
              disabled={isLoadingStaked}
              className="h-7 px-2"
              title="Refresh rewards"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingStaked ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-3">
              {/* Claimable Now */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Claimable Now</p>
                {pendingRewards.length > 0 ? (
                  <div className="space-y-1.5">
                    {pendingRewards.map((reward, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img
                          src={reward.contract ? getTokenLogoUrl(reward.contract, reward.symbol) : TOKEN_LOGO_PLACEHOLDER}
                          alt={reward.symbol}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                          }}
                        />
                        <Badge variant="secondary" className="bg-cheese/10 text-cheese border-cheese/20">
                          {reward.amount.toFixed(reward.precision)} {reward.symbol}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No claimable rewards</p>
                )}
              </div>
              
              {/* Pending (next payout) */}
              {pendingNextPayout.length > 0 && pendingNextPayout.some(r => r.amount > 0) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Pending 
                    <span className="text-muted-foreground/70 ml-1">
                      (in {Math.floor(nextPayoutIn / 60)}:{(nextPayoutIn % 60).toString().padStart(2, '0')})
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    {pendingNextPayout.map((reward, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img
                          src={reward.contract ? getTokenLogoUrl(reward.contract, reward.symbol) : TOKEN_LOGO_PLACEHOLDER}
                          alt={reward.symbol}
                          className="w-4 h-4 rounded-full opacity-70"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                          }}
                        />
                        <Badge variant="outline" className="text-muted-foreground border-border/50 text-xs">
                          +{reward.amount.toFixed(reward.precision)} {reward.symbol}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
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
    </div>
  );
}