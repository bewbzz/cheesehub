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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Check,
  AlertTriangle,
  Link as LinkIcon,
} from "lucide-react";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { useUserNFTs } from "@/hooks/useUserNFTs";
import {
  FARM_CONTRACT,
  buildStakeNftsAction,
  buildUnstakeNftsAction,
  buildClaimRewardsAction,
  fetchUserStakes,
  fetchFarmStakableConfig,
  fetchUserGlobalStakes,
  FarmInfo,
  PendingReward,
} from "@/lib/farm";
import { ATOMIC_API } from "@/lib/waxConfig";
import { fetchWithFallback } from "@/lib/fetchWithFallback";
import { batchGetOrFetch } from "@/lib/templateCache";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { cn } from "@/lib/utils";
import { waxRpcCall } from "@/lib/waxRpcFallback";

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

// IPFS gateway fallback list (same as wallet NFTSendManager)
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }
  // Handle /ipfs/ paths
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+.*)/);
  if (ipfsMatch) return ipfsMatch[1];
  // Handle bare CID
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  return null;
}

function getImageUrl(img: string | undefined): string {
  if (!img) return "/placeholder.svg";
  if (img.startsWith("http")) return img;
  if (img.startsWith('ipfs://')) {
    const hash = img.replace('ipfs://', '');
    return `${IPFS_GATEWAY}${hash}`;
  }
  if (img.startsWith("Qm") || img.startsWith("bafy") || img.startsWith("bafk")) {
    return `${IPFS_GATEWAY}${img}`;
  }
  return img || "/placeholder.svg";
}

// Helper to extract media URL from NFT data, with video fallback for video-only NFTs
function getMediaUrl(data: Record<string, string | undefined> | undefined): { url: string; isVideo: boolean } {
  if (!data) return { url: '/placeholder.svg', isVideo: false };
  
  // Try standard image fields first
  const imageField = data.img || data.image;
  if (imageField) {
    return { url: getImageUrl(imageField), isVideo: false };
  }
  
  // Fallback to video field (common in video-only NFTs)
  const videoField = data.video;
  if (videoField) {
    return { url: getImageUrl(videoField), isVideo: true };
  }
  
  return { url: '/placeholder.svg', isVideo: false };
}

// NFT Card with IPFS gateway fallback (matches wallet NFTSendManager)
interface NFTCardProps {
  nft: NFTAsset;
  isSelected: boolean;
  onToggle: () => void;
  selectedColor?: "primary" | "destructive";
  stakedInFarm?: string; // Name of farm where this NFT is already staked (if any)
}

function NFTCard({ nft, isSelected, onToggle, selectedColor = "primary", stakedInFarm }: NFTCardProps) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ipfsHash = extractIpfsHash(nft.image);
  const hasValidImage = Boolean(nft.image && nft.image.length > 0 && nft.image !== '/placeholder.svg');
  const isStakedElsewhere = Boolean(stakedInFarm);
  
  // Build current image URL with gateway rotation
  const currentImageUrl = useMemo(() => {
    if (!nft.image || nft.image === '/placeholder.svg') return '/placeholder.svg';
    if (ipfsHash) {
      const baseUrl = `${IPFS_GATEWAYS[gatewayIndex]}${ipfsHash}`;
      return retryCount > 0 ? `${baseUrl}?retry=${retryCount}` : baseUrl;
    }
    // For non-IPFS URLs
    const separator = nft.image.includes('?') ? '&' : '?';
    return retryCount > 0 ? `${nft.image}${separator}retry=${retryCount}` : nft.image;
  }, [nft.image, ipfsHash, gatewayIndex, retryCount]);

  const handleImageError = useCallback(() => {
    if (ipfsHash && gatewayIndex < IPFS_GATEWAYS.length - 1) {
      // Try next gateway
      setGatewayIndex(prev => prev + 1);
      setImgLoaded(false);
    } else {
      setImgError(true);
    }
  }, [ipfsHash, gatewayIndex]);

  // Timeout fallback - if image doesn't load in 10s, try next gateway
  useEffect(() => {
    if (!hasValidImage || imgError || imgLoaded) return;
    
    const timeout = setTimeout(() => {
      if (!imgLoaded && !imgError) {
        handleImageError();
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [hasValidImage, imgError, imgLoaded, currentImageUrl, handleImageError]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgError(false);
    setImgLoaded(false);
    setGatewayIndex(0);
    setRetryCount(prev => prev + 1);
  };

  const showErrorState = !hasValidImage || imgError;
  const borderColor = isStakedElsewhere 
    ? "border-amber-500 ring-amber-500" 
    : selectedColor === "destructive" 
      ? "border-destructive ring-destructive" 
      : "border-primary ring-primary";

  const cardContent = (
    <button
      onClick={onToggle}
      className={cn(
        "group relative rounded-md overflow-hidden border-2 transition-all aspect-square",
        isStakedElsewhere && "opacity-70",
        isSelected
          ? `${borderColor} ring-1`
          : isStakedElsewhere 
            ? "border-amber-500/50"
            : "border-transparent hover:border-muted-foreground/30"
      )}
    >
      {/* Staked elsewhere indicator */}
      {isStakedElsewhere && (
        <div className="absolute top-1 left-1 z-10">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className={cn(
          "absolute top-1 right-1 z-10 rounded-full p-0.5",
          isStakedElsewhere ? "bg-amber-500" : selectedColor === "destructive" ? "bg-destructive" : "bg-primary"
        )}>
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Image with IPFS fallback */}
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        {showErrorState ? (
          <button 
            type="button"
            className="w-full h-full flex flex-col items-center justify-center bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors z-20"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleRetry(e);
            }}
            title="Click to retry loading image"
          >
            <ImageIcon className="h-5 w-5 text-cheese mb-1" />
            <span className="text-[9px] text-cheese font-medium">Retry</span>
            <span className="text-[8px] text-muted-foreground mt-0.5">#{nft.asset_id}</span>
          </button>
        ) : (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            )}
            <img
              src={currentImageUrl}
              alt={nft.name}
              className={cn(
                "w-full h-full object-contain transition-opacity",
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
                }
              }}
            />
          </>
        )}
      </div>

      {/* Info bar at bottom - compact */}
      <div className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 bg-background/90">
        <p className="text-[8px] font-medium truncate leading-tight">{nft.name}</p>
        {isStakedElsewhere ? (
          <p className="text-[7px] text-amber-500 truncate leading-tight">in: {stakedInFarm}</p>
        ) : (
          <p className="text-[7px] text-muted-foreground truncate leading-tight">#{nft.asset_id}</p>
        )}
      </div>
    </button>
  );

  // Wrap in tooltip if staked elsewhere
  if (isStakedElsewhere) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">
              <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />
              Already staked in <span className="font-semibold">{stakedInFarm}</span>. 
              Unstake there first to stake here.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
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

  // Fetch user's global stakes across ALL V2 farms to detect conflicts
  const { data: globalStakes = [], refetch: refetchGlobalStakes } = useQuery({
    queryKey: ["userGlobalStakes", accountName],
    queryFn: () => fetchUserGlobalStakes(accountName!),
    enabled: !!accountName,
    staleTime: 30000,
  });

  // Create a map of asset_id -> farm_name for quick lookup (excluding current farm)
  const globallyStakedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const stake of globalStakes) {
      if (stake.farmName !== farm.farm_name) {
        for (const assetId of stake.assetIds) {
          map.set(assetId, stake.farmName);
        }
      }
    }
    return map;
  }, [globalStakes, farm.farm_name]);

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
      
      // Cap at farm expiration -- rewards stop accruing once farm expires
      const isExpired = farm.expiration > 0 && now > farm.expiration;
      const effectiveNow = isExpired ? farm.expiration : now;
      
      // Use USER's last_state_change, not farm's last_payout
      const userLastStateChange = stakerData.lastStateChange || effectiveNow;
      
      // Calculate completed payout periods since USER's last state change
      const timeSinceUserStateChange = Math.max(0, effectiveNow - userLastStateChange);
      const completedPeriods = Math.floor(timeSinceUserStateChange / payoutInterval);
      const claimableHours = (completedPeriods * payoutInterval) / 3600;
      
      // Time remaining in current incomplete period (for countdown)
      // If expired, no next payout
      if (isExpired) {
        setNextPayoutIn(0);
      } else {
        const elapsedInCurrentPeriod = timeSinceUserStateChange % payoutInterval;
        const secondsUntilNextPayout = payoutInterval - elapsedInCurrentPeriod;
        setNextPayoutIn(secondsUntilNextPayout);
      }

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
      
      console.log('[NFTStaking] Starting eligible NFT fetch for', accountName);
      console.log('[NFTStaking] Stakable config:', stakableConfig);
      
      // Get set of already staked asset IDs to exclude
      const stakedAssetIds = new Set(stakedNfts.map(s => s.asset_id));
      
      // Get all unique collections from config
      const eligibleCollections = new Set<string>();
      stakableConfig.collections.forEach(c => {
        if (c.collection) eligibleCollections.add(c.collection);
      });
      stakableConfig.schemas.forEach(s => {
        if (s.collection) eligibleCollections.add(s.collection);
      });
      stakableConfig.templates.forEach(t => {
        if (t.collection) eligibleCollections.add(t.collection);
      });
      
      const templateIds = new Set(stakableConfig.templates.map(t => t.template_id).filter(Boolean));
      
      console.log('[NFTStaking] Eligible collections:', Array.from(eligibleCollections));
      console.log('[NFTStaking] Template IDs:', Array.from(templateIds));
      
      // STRATEGY: Blockchain-first approach - get all user's on-chain assets, then filter by eligibility
      // This bypasses AtomicAssets indexer delays
      
      const eligibleAssetIds: string[] = [];
      const assetMetadataMap = new Map<string, { collection: string; schema: string; template_id: number }>();
      
      try {
        // Fetch all user's assets directly from blockchain
        let lowerBound = "";
        let hasMore = true;
        const BATCH_SIZE = 1000;
        let iterations = 0;
        const MAX_ITERATIONS = 10;
        
        while (hasMore && iterations < MAX_ITERATIONS) {
          const response = await waxRpcCall<{
            rows: Array<{ asset_id: string; collection_name: string; schema_name: string; template_id: number }>;
            more: boolean;
            next_key: string;
          }>('/v1/chain/get_table_rows', {
            json: true,
            code: 'atomicassets',
            scope: accountName,
            table: 'assets',
            limit: BATCH_SIZE,
            lower_bound: lowerBound || undefined,
          });
          
          if (response.rows && response.rows.length > 0) {
            for (const asset of response.rows) {
              const assetId = String(asset.asset_id);
              
              // Skip already staked
              if (stakedAssetIds.has(assetId)) continue;
              
              // Check if this asset is eligible based on collection, schema, or template
              let isEligible = false;
              
              // Check collections
              if (eligibleCollections.has(asset.collection_name)) {
                isEligible = true;
              }
              
              // Check schemas
              if (stakableConfig.schemas.some(s => 
                s.collection === asset.collection_name && s.schema === asset.schema_name
              )) {
                isEligible = true;
              }
              
              // Check templates
              if (templateIds.has(asset.template_id)) {
                isEligible = true;
              }
              
              if (isEligible) {
                eligibleAssetIds.push(assetId);
                assetMetadataMap.set(assetId, {
                  collection: asset.collection_name,
                  schema: asset.schema_name,
                  template_id: asset.template_id,
                });
              }
            }
            
            if (response.more && response.rows.length === BATCH_SIZE) {
              const lastAsset = response.rows[response.rows.length - 1];
              lowerBound = String(BigInt(lastAsset.asset_id) + 1n);
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
          
          iterations++;
        }
        
        console.log('[NFTStaking] Found', eligibleAssetIds.length, 'eligible assets on-chain');
      } catch (error) {
        console.error('[NFTStaking] Blockchain query failed:', error);
      }
      
      if (eligibleAssetIds.length === 0) {
        return [];
      }
      
      // Now fetch metadata from AtomicAssets API for these specific asset IDs
      const assets: NFTAsset[] = [];
      const cacheBuster = `_ts=${Date.now()}`;
      
      // Fetch in batches of 50
      const batchSize = 50;
      for (let i = 0; i < eligibleAssetIds.length; i += batchSize) {
        const batch = eligibleAssetIds.slice(i, i + batchSize);
        const idsParam = batch.join(',');
        
        try {
          const path = `${ATOMIC_API.paths.assets}?ids=${idsParam}&${cacheBuster}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
          const json = await response.json();
          
          if (json.success && json.data) {
            for (const asset of json.data) {
              const media = getMediaUrl(asset.data);
              assets.push({
                asset_id: asset.asset_id,
                name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
                image: media.url,
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
                template_id: asset.template?.template_id || "",
              });
            }
          }
        } catch (error) {
          console.error('[NFTStaking] Error fetching asset metadata:', error);
        }
      }
      
      // For any assets not returned by API (not indexed yet), try to fetch template metadata
      const fetchedIds = new Set(assets.map(a => a.asset_id));
      const missingAssetIds = eligibleAssetIds.filter(id => !fetchedIds.has(id));
      
      if (missingAssetIds.length > 0) {
        console.log('[NFTStaking] Fetching template metadata for', missingAssetIds.length, 'unindexed assets');
        
        // Group by template_id to minimize API calls
        const templateGroups = new Map<number, string[]>();
        for (const assetId of missingAssetIds) {
          const meta = assetMetadataMap.get(assetId);
          if (meta?.template_id) {
            const existing = templateGroups.get(meta.template_id) || [];
            existing.push(assetId);
            templateGroups.set(meta.template_id, existing);
          }
        }
        
        // Build batch request for all templates (FAST - single API call)
        const templateRequests = Array.from(templateGroups.entries()).map(([templateId, assetIds]) => {
          const meta = assetMetadataMap.get(assetIds[0]);
          return {
            templateId: String(templateId),
            collectionName: meta?.collection || '',
          };
        });
        
        // Batch fetch all templates at once using shared cache
        const templateDataMap = await batchGetOrFetch(templateRequests);
        console.log('[NFTStaking] Batch fetched', templateDataMap.size, 'templates');
        
        // Map template data back to assets
        for (const [templateId, assetIds] of templateGroups) {
          const meta = assetMetadataMap.get(assetIds[0]);
          const key = `${meta?.collection}:${templateId}`;
          const templateData = templateDataMap.get(key);
          
          for (const assetId of assetIds) {
            assets.push({
              asset_id: assetId,
              name: templateData?.name || `NFT #${assetId}`,
              image: templateData?.image || '/placeholder.svg',
              collection: meta?.collection || 'Unknown',
              schema: meta?.schema || '',
              template_id: String(templateId),
            });
          }
        }
        
        // Handle assets without template_id
        for (const assetId of missingAssetIds) {
          const meta = assetMetadataMap.get(assetId);
          if (!meta?.template_id) {
            assets.push({
              asset_id: assetId,
              name: `NFT #${assetId}`,
              image: '',
              collection: meta?.collection || 'Unknown',
              schema: meta?.schema || '',
              template_id: '',
            });
          }
        }
      }
      
      console.log('[NFTStaking] Final eligible NFTs:', assets.length);
      return assets;
    },
    enabled: !!accountName && !!stakableConfig,
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch staked NFT details - with fallback for unindexed assets
  const { data: stakedNftDetails = [], isLoading: isLoadingStakedDetails, refetch: refetchStakedDetails } = useQuery({
    queryKey: ["stakedNftDetails", stakedNfts.map(s => s.asset_id).join(","), accountName],
    queryFn: async () => {
      if (!stakedNfts.length || !accountName) return [];
      
      const stakedAssetIds = stakedNfts.map(s => s.asset_id);
      const assets: NFTAsset[] = [];
      
      // Try to fetch from AtomicAssets API first
      const assetIdsParam = stakedAssetIds.join(",");
      const params = new URLSearchParams({
        ids: assetIdsParam,
        limit: "100",
      });
      const path = `${ATOMIC_API.paths.assets}?${params.toString()}`;
      
      try {
        const response = await fetchWithFallback(ATOMIC_API.baseUrls, path);
        const json = await response.json();
        
        if (json.success && json.data) {
          for (const asset of json.data) {
            const media = getMediaUrl(asset.data);
            assets.push({
              asset_id: asset.asset_id,
              name: asset.data?.name || asset.name || `NFT #${asset.asset_id}`,
              image: media.url,
              collection: asset.collection?.collection_name || "",
              schema: asset.schema?.schema_name || "",
              template_id: asset.template?.template_id || "",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching staked NFT details:", error);
      }
      
      // Handle assets not returned by API (not indexed yet) - fetch from blockchain
      const fetchedIds = new Set(assets.map(a => a.asset_id));
      const missingAssetIds = stakedAssetIds.filter(id => !fetchedIds.has(id));
      
      if (missingAssetIds.length > 0) {
        console.log('[NFTStaking] Missing staked assets from API:', missingAssetIds.length, '- fetching from blockchain');
        
        const rpcEndpoints = ['https://wax.eosusa.io', 'https://api.wax.alohaeos.com', 'https://wax.greymass.com'];
        
        // Build metadata map from blockchain - V2 farms are non-custodial so NFTs stay in user's wallet
        const assetMetadataMap = new Map<string, { template_id: number; collection: string; schema: string }>();
        
        for (const endpoint of rpcEndpoints) {
          try {
            // Query user's assets from blockchain
            const resp = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: 'atomicassets',
                scope: accountName, // Use account name as scope for V2 non-custodial staking
                table: 'assets',
                limit: 1000,
                json: true,
              }),
            });
            const result = await resp.json();
            
            if (result.rows?.length > 0) {
              for (const row of result.rows) {
                const assetId = String(row.asset_id);
                if (missingAssetIds.includes(assetId)) {
                  assetMetadataMap.set(assetId, {
                    template_id: row.template_id || 0,
                    collection: row.collection_name || '',
                    schema: row.schema_name || '',
                  });
                }
              }
              break;
            }
          } catch {
            continue;
          }
        }
        
        // Group by template_id to minimize API calls (same pattern as eligible NFTs)
        const templateGroups = new Map<number, string[]>();
        for (const assetId of missingAssetIds) {
          const meta = assetMetadataMap.get(assetId);
          if (meta?.template_id && meta.template_id > 0) {
            const existing = templateGroups.get(meta.template_id) || [];
            existing.push(assetId);
            templateGroups.set(meta.template_id, existing);
          }
        }
        
        // Build batch request for all templates (FAST - uses shared cache)
        const templateRequests = Array.from(templateGroups.entries()).map(([templateId, assetIds]) => {
          const meta = assetMetadataMap.get(assetIds[0]);
          return {
            templateId: String(templateId),
            collectionName: meta?.collection || '',
          };
        });
        
        // Batch fetch all templates at once
        const templateDataMap = await batchGetOrFetch(templateRequests);
        console.log('[NFTStaking] Batch fetched', templateDataMap.size, 'staked NFT templates');
        
        // Map template data back to assets
        for (const [templateId, assetIds] of templateGroups) {
          const meta = assetMetadataMap.get(assetIds[0]);
          const key = `${meta?.collection}:${templateId}`;
          const templateData = templateDataMap.get(key);
          
          for (const assetId of assetIds) {
            assets.push({
              asset_id: assetId,
              name: templateData?.name || `NFT #${assetId}`,
              image: templateData?.image || '/placeholder.svg',
              collection: meta?.collection || 'Unknown',
              schema: meta?.schema || '',
              template_id: String(templateId),
            });
          }
        }
        
        // Handle assets without template_id or not found in blockchain
        const processedIds = new Set(assets.map(a => a.asset_id));
        for (const assetId of missingAssetIds) {
          if (processedIds.has(assetId)) continue;
          
          const meta = assetMetadataMap.get(assetId);
          assets.push({
            asset_id: assetId,
            name: `NFT #${assetId}`,
            image: '',
            collection: meta?.collection || 'Unknown',
            schema: meta?.schema || '',
            template_id: meta?.template_id ? String(meta.template_id) : '',
          });
        }
      }
      
      console.log('[NFTStaking] Final staked NFT details:', assets.length);
      return assets;
    },
    enabled: stakedNfts.length > 0 && !!accountName,
    staleTime: 0, // Always refetch to catch newly staked NFTs
    gcTime: 0,
  });

  const handleStake = async () => {
    if (!session || selectedToStake.size === 0) return;
    
    setIsStaking(true);
    try {
      // Filter out NFTs that are staked elsewhere - only stake ones that will succeed
      const conflictingIds = new Set(selectedConflicts.map(c => c.assetId));
      const assetIds = Array.from(selectedToStake).filter(id => !conflictingIds.has(id));
      
      if (assetIds.length === 0) {
        toast({
          title: "No Valid NFTs",
          description: "All selected NFTs are already staked in other farms",
          variant: "destructive",
        });
        return;
      }
      
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
      
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["stakedNftDetails"] });
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
      queryClient.invalidateQueries({ queryKey: ["userGlobalStakes", accountName] });
      
      // Refetch data with a small delay to allow blockchain state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      await Promise.all([
        refetchStaked(),
        refetchEligible(),
        refetchStakedDetails(),
        refetchGlobalStakes(),
      ]);
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
      
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: ["stakedNftDetails"] });
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farm.farm_name] });
      
      // Refetch data with a small delay to allow blockchain state to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      await Promise.all([
        refetchStaked(),
        refetchEligible(),
        refetchStakedDetails(),
      ]);
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
    
    // Snapshot claimable amounts before the claim
    const claimableSnapshot = pendingRewards.map(r => ({ symbol: r.symbol, amount: r.amount }));
    
    setIsClaiming(true);
    try {
      const action = buildClaimRewardsAction(session.actor.toString(), farm.farm_name);
      
      const result = await session.transact({ actions: [action] });
      
      // Validate the transaction was actually successful on-chain
      const txId = result?.response?.transaction_id || (result as any)?.transaction_id;
      if (!txId) {
        throw new Error('Transaction was broadcast but no transaction ID was returned. The claim may not have succeeded.');
      }
      
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

  // Find selected NFTs that are staked in other farms (will fail staking)
  const selectedConflicts = useMemo(() => {
    const conflicts: Array<{ assetId: string; farmName: string }> = [];
    for (const assetId of selectedToStake) {
      const farmName = globallyStakedMap.get(assetId);
      if (farmName) {
        conflicts.push({ assetId, farmName });
      }
    }
    return conflicts;
  }, [selectedToStake, globallyStakedMap]);

  const hasConflicts = selectedConflicts.length > 0;

  // Helper to remove conflicting NFTs from selection
  const removeConflictsFromSelection = () => {
    const newSet = new Set(selectedToStake);
    for (const { assetId } of selectedConflicts) {
      newSet.delete(assetId);
    }
    setSelectedToStake(newSet);
  };

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

  // Virtualization - 6 columns grid with small square cards
  const COLUMNS = 6;
  const ROW_HEIGHT = 70;
  
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
                  <a 
                    href={`https://wax.atomichub.io/explorer/schema/wax-mainnet/${s.collection}/${s.schema}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {s.collection}/{s.schema}
                  </a>
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
                            className="grid grid-cols-6 gap-1 px-1"
                          >
                            {rowNFTs.map((nft) => (
                              <NFTCard
                                key={nft.asset_id}
                                nft={nft}
                                isSelected={selectedToStake.has(nft.asset_id)}
                                onToggle={() => toggleStakeSelection(nft.asset_id)}
                                selectedColor="primary"
                                stakedInFarm={globallyStakedMap.get(nft.asset_id)}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    {/* Warning for NFTs staked elsewhere */}
                    {hasConflicts && (
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertDescription className="text-xs">
                          <span className="font-medium text-amber-500">{selectedConflicts.length} NFT(s)</span> are already staked in other farms and will fail:
                          <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                            {selectedConflicts.slice(0, 3).map(({ assetId, farmName }) => (
                              <li key={assetId}>
                                #{assetId} → <a href={`/farm/${farmName}`} className="text-primary hover:underline">{farmName}</a>
                              </li>
                            ))}
                            {selectedConflicts.length > 3 && (
                              <li>...and {selectedConflicts.length - 3} more</li>
                            )}
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                            onClick={removeConflictsFromSelection}
                          >
                            Remove from selection
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button
                      onClick={handleStake}
                      disabled={isStaking || selectedToStake.size === 0 || (hasConflicts && selectedConflicts.length === selectedToStake.size)}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      {isStaking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="h-4 w-4 mr-2" />
                      )}
                      {hasConflicts 
                        ? `Stake ${selectedToStake.size - selectedConflicts.length} NFT(s)` 
                        : `Stake ${selectedToStake.size} NFT(s)`}
                    </Button>
                    {hasConflicts && selectedToStake.size > selectedConflicts.length && (
                      <p className="text-xs text-center text-muted-foreground">
                        {selectedConflicts.length} NFT(s) will be skipped
                      </p>
                    )}
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
                            className="grid grid-cols-6 gap-1 px-1"
                          >
                            {rowNFTs.map((nft) => (
                              <NFTCard
                                key={nft.asset_id}
                                nft={nft}
                                isSelected={selectedToUnstake.has(nft.asset_id)}
                                onToggle={() => toggleUnstakeSelection(nft.asset_id)}
                                selectedColor="destructive"
                              />
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
              {stakedNfts.length > 0 && (
                <Badge variant="outline" className="text-xs font-normal ml-1">
                  {stakedNfts.length} NFT{stakedNfts.length !== 1 ? 's' : ''} staked
                </Badge>
              )}
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
          {/* Expiration warning */}
          {farm.expiration > 0 && Math.floor(Date.now() / 1000) > farm.expiration && stakedNfts.length > 0 && (
            <Alert className="mb-4 border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm text-destructive">
                This farm has expired. Rewards are no longer accruing. Speak to the farm owner about opening it again and claim any remaining rewards.
              </AlertDescription>
            </Alert>
          )}
          {/* 2-column rewards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Pending */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                Pending
                {nextPayoutIn > 0 && (
                  <span className="text-muted-foreground/70 ml-1">
                    (in {Math.floor(nextPayoutIn / 60)}:{(nextPayoutIn % 60).toString().padStart(2, '0')})
                  </span>
                )}
              </p>
              {pendingNextPayout.length > 0 && pendingNextPayout.some(r => r.amount > 0) ? (
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
              ) : (
                <p className="text-muted-foreground text-sm">—</p>
              )}
            </div>

            {/* Claimable Now */}
            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Claimable Now</p>
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

          </div>

          {/* Claim button */}
          <div className="flex justify-center">
            <Button
              onClick={handleClaim}
              disabled={isClaiming || !hasRewards}
              className="w-full sm:w-1/2 bg-cheese hover:bg-cheese/90 text-cheese-foreground"
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