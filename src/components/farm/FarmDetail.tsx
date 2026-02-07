import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Sprout, 
  Users, 
  Clock, 
  Calendar, 
  ExternalLink,
  Coins,
  Settings,
  Copy,
  Check,
  Construction,
  Globe,
  Youtube,
  BookOpen,
  ImageIcon,
  RefreshCw
} from "lucide-react";

// IPFS gateway fallback system
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/"
];

const getIpfsUrlWithGateway = (url: string, gatewayIndex: number): string => {
  if (!url) return "";
  // Extract IPFS hash from various formats
  const ipfsMatch = url.match(/(?:ipfs:\/\/|\/ipfs\/|^Qm|^bafy)([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    const hash = url.startsWith("Qm") || url.startsWith("bafy") ? url : ipfsMatch[1];
    return `${IPFS_GATEWAYS[gatewayIndex]}${hash}`;
  }
  return url;
};

// Custom social icons
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037c-1.687.29-3.33.8-4.885 1.515a.07.07 0 00-.032.028C.533 9.045-.32 13.58.099 18.058a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.098.246.198.373.293a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 00.084.029 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.055c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635z" />
  </svg>
);
import { fetchFarmDetails, getIpfsUrl, FarmInfo, RewardPool, calculateEffectiveBalance, fetchFarmContractBalance } from "@/lib/farm";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { useToast } from "@/hooks/use-toast";
import { NFTStaking } from "./NFTStaking";
import { ManageStakableAssets } from "./ManageStakableAssets";
import { OpenFarmDialog } from "./OpenFarmDialog";
import { ExtendFarmDialog } from "./ExtendFarmDialog";
import { CloseFarmDialog } from "./CloseFarmDialog";
import { PermCloseFarmDialog } from "./PermCloseFarmDialog";
import { KickUsersDialog } from "./KickUsersDialog";
import { EmptyFarmDialog } from "./EmptyFarmDialog";
import { DepositRewardsDialog } from "./DepositRewardsDialog";
import { EditFarmProfile } from "./EditFarmProfile";
import { useWax } from "@/context/WaxContext";
import { Pencil } from "lucide-react";
// Farm type labels based on WaxDAO contract
const FARM_TYPE_LABELS: Record<number, string> = {
  0: "Collections",
  1: "Schemas", 
  2: "Templates",
  3: "Attributes",
};

const getFarmTypeLabel = (type: number) => FARM_TYPE_LABELS[type] || "Unknown";

export function FarmDetail() {
  const { farmName } = useParams<{ farmName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accountName } = useWax();
  const [copied, setCopied] = useState(false);
  const [coverGatewayIndex, setCoverGatewayIndex] = useState(0);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryClient = useQueryClient();
  
  const { data: farm, isLoading, error, refetch } = useQuery({
    queryKey: ["farmDetail", farmName],
    queryFn: () => fetchFarmDetails(farmName!),
    enabled: !!farmName,
    staleTime: 30000,
  });

  // Fetch real on-chain contract balances for reward pool tokens
  const { data: contractBalances = {} } = useQuery({
    queryKey: ["farmContractBalances", farmName, farm?.reward_pools?.map(p => p.symbol).join(",")],
    queryFn: async () => {
      if (!farm?.reward_pools?.length) return {};
      const balances: Record<string, number> = {};
      await Promise.all(
        farm.reward_pools.map(async (pool) => {
          try {
            balances[pool.symbol] = await fetchFarmContractBalance(pool.contract, pool.symbol);
          } catch (e) {
            console.warn(`[FarmDetail] Failed to fetch balance for ${pool.symbol}:`, e);
          }
        })
      );
      return balances;
    },
    enabled: !!farm?.reward_pools?.length,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const handleFarmUpdated = async () => {
    // Invalidate cache to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ["farmDetail", farmName] });
    
    // Immediate refetch
    await refetch();
    
    // Multiple delayed refetches to handle RPC caching and indexer lag
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farmName] });
      refetch();
    }, 2000);
    
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["farmDetail", farmName] });
      refetch();
    }, 5000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({ title: "Farm data refreshed!" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyFarmName = () => {
    if (farmName) {
      navigator.clipboard.writeText(farmName);
      setCopied(true);
      toast({ title: "Farm name copied!" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !farm) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Farm Not Found</h3>
        <p className="text-muted-foreground mb-4">
          The farm "{farmName}" could not be found.
        </p>
        <Button onClick={() => navigate("/farm")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Farms
        </Button>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const createdDate = new Date(farm.time_created * 1000);
  
  // Farm is "under construction" if it hasn't been opened yet (status 0 or expiration is 0)
  const isUnderConstruction = farm.status === 0 || farm.expiration === 0;
  // Farm is "expired" only if it's been opened and has passed its expiration date
  const isExpired = !isUnderConstruction && farm.expiration < now;
  const expirationDate = new Date(farm.expiration * 1000);
  const daysRemaining = Math.max(0, Math.ceil((farm.expiration - now) / 86400));
  
  // Farm status codes: 0 = Under Construction, 1 = Active, 2 = Closed, 3 = Permanently Closed
  const isClosed = farm.status === 2;
  const isPermClosed = farm.status === 3;
  const hasStakers = farm.staked_count > 0;
  const isCreator = accountName && accountName === farm.creator;

  const formatPayoutInterval = (seconds: number) => {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  const formatAmount = (amount: number, symbol: string, precision?: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ${symbol}`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K ${symbol}`;
    }
    return `${amount.toFixed(precision || 4)} ${symbol}`;
  };

  const formatRewardPool = (pool: RewardPool) => {
    return formatAmount(parseFloat(pool.balance) || 0, pool.symbol, pool.precision);
  };

  const formatTimeRemaining = (hours: number | null): string | null => {
    if (hours === null || hours <= 0) return null;
    if (hours < 1) return `~${Math.round(hours * 60)}m remaining`;
    if (hours < 24) return `~${Math.round(hours)}h remaining`;
    const days = Math.round(hours / 24);
    if (days < 365) return `~${days}d remaining`;
    return `~${(days / 365).toFixed(1)}y remaining`;
  };

  // Whether to show effective balance (only for active farms with stakers)
  const showEffective = farm.status === 1 && farm.staked_count > 0;

  return (
    <div className="space-y-6">

      {/* Back Button */}
      <Button onClick={() => navigate("/farm")} variant="ghost" className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Farms
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Farm Logo */}
        <div className="h-24 w-24 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
          {farm.logo ? (
            <img
              src={getIpfsUrl(farm.logo)}
              alt={farm.farm_name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Sprout className="h-12 w-12 text-primary" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-3xl font-bold text-foreground">{farm.farm_name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              V2
            </Badge>
            {isPermClosed ? (
              <Badge variant="destructive">Permanently Closed</Badge>
            ) : isClosed ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                Closed
              </Badge>
            ) : isUnderConstruction ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Construction className="h-3 w-3 mr-1" />
                Under Construction
              </Badge>
            ) : isExpired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
            )}
          </div>
          <p className="text-muted-foreground mb-3">
            Created by <span className="text-foreground font-medium">{farm.creator}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleCopyFarmName}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Copy Name
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" onClick={() => setEditProfileOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit Profile
              </Button>
            )}
            {isCreator && (
              <ManageStakableAssets 
                farm={farm} 
                canEdit={(isUnderConstruction || (isClosed && !hasStakers)) && !isPermClosed}
                onSuccess={handleFarmUpdated} 
              />
            )}
            {isCreator && isUnderConstruction && (
              <OpenFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
            )}
          </div>
        </div>
      </div>

      {/* Creator Status Info Box */}
      {isCreator && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex gap-3 items-start">
              <Construction className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-1">
                {isPermClosed ? (
                  <p>Kick all users, then use the <strong>Empty Farm</strong> option to retrieve any leftover reward tokens. This farm is permanently closed and cannot be opened or extended.</p>
                ) : isClosed ? (
                  <p>Now kick all users, update stakeable assets and values (optional) then open the farm again.</p>
                ) : isUnderConstruction ? (
                  <p>Your farm is under construction. Add stakeable assets, deposit reward tokens, then press <strong>Open Farm</strong> to set an expiration date and go live.</p>
                ) : isExpired ? (
                  <div className="space-y-2">
                    <p>You have 2 choices:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-1">
                      <li>Close the farm, kick all users, update stakeable assets and values (optional) then open the farm again.</li>
                      <li>Permanently close the farm, kick all users, then use the <strong>Empty Farm</strong> option to retrieve any leftover reward tokens. Once a farm is permanently closed it cannot be opened or extended.</li>
                    </ol>
                  </div>
                ) : (
                  <p>Extend your farm by pressing the <strong>Extend</strong> button. However, before doing so you will need to deposit enough rewards to cover the current NFTs staked for the planned added time. Extending a farm is much easier while the farm is still active and not expired.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Farm Info & Reward Pools */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Farm Info */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Farm Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground">Farm Status</p>
                  {isCreator && isUnderConstruction && (
                    <OpenFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
                  )}
                </div>
                <p className="font-medium">
                  {isUnderConstruction ? (
                    <span className="text-amber-400">Under Construction</span>
                  ) : isExpired ? (
                    <span className="text-red-400">Expired</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Farm Type</p>
                <p className="font-medium">{getFarmTypeLabel(farm.farm_type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Creator</p>
                <p className="font-medium">{farm.creator}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{createdDate.toLocaleDateString()}</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground">Expires</p>
                  {isCreator && !isUnderConstruction && !isExpired && (
                    <ExtendFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
                  )}
                  {/* Show Close/Perm Close buttons for expired farms that aren't already closed */}
                  {isCreator && isExpired && !isClosed && !isPermClosed && (
                    <>
                      <CloseFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
                      <PermCloseFarmDialog farm={farm} onSuccess={() => navigate('/farm')} />
                    </>
                  )}
                  {/* Show Kick Users if farm is closed/perm closed and has stakers */}
                  {isCreator && (isClosed || isPermClosed) && hasStakers && (
                    <KickUsersDialog farm={farm} onSuccess={handleFarmUpdated} />
                  )}
                  {/* Show message if closed/perm closed with no stakers */}
                  {isCreator && (isClosed || isPermClosed) && !hasStakers && (
                    <span className="text-xs text-muted-foreground">No stakers to kick</span>
                  )}
                  {/* Show Empty Farm if perm closed and no stakers left */}
                  {isCreator && isPermClosed && !hasStakers && (
                    <EmptyFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
                  )}
                </div>
                <div>
                  <p className="font-medium">{expirationDate.toLocaleDateString()}</p>
                  {isCreator && !isUnderConstruction && (
                    <p className="text-xs text-muted-foreground">
                      {expirationDate.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {farm.description && (
              <div>
                <p className="text-muted-foreground text-sm mb-1">Description</p>
                <p className="text-foreground">{farm.description}</p>
              </div>
            )}

            {/* Social Links */}
            {farm.socials && (farm.socials.twitter || farm.socials.discord || 
              farm.socials.telegram || farm.socials.website || farm.socials.youtube || 
              farm.socials.medium || farm.socials.waxdao) && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Social Links</p>
                  <div className="flex flex-wrap gap-2">
                    {farm.socials.twitter && (
                      <a href={farm.socials.twitter} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <TwitterIcon className="h-3 w-3" />
                          Twitter
                        </Badge>
                      </a>
                    )}
                    {farm.socials.discord && (
                      <a href={farm.socials.discord} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <DiscordIcon className="h-3 w-3" />
                          Discord
                        </Badge>
                      </a>
                    )}
                    {farm.socials.telegram && (
                      <a href={farm.socials.telegram} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <TelegramIcon className="h-3 w-3" />
                          Telegram
                        </Badge>
                      </a>
                    )}
                    {farm.socials.website && (
                      <a href={farm.socials.website} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <Globe className="h-3 w-3" />
                          Website
                        </Badge>
                      </a>
                    )}
                    {farm.socials.youtube && (
                      <a href={farm.socials.youtube} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <Youtube className="h-3 w-3" />
                          YouTube
                        </Badge>
                      </a>
                    )}
                    {farm.socials.medium && (
                      <a href={farm.socials.medium} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <BookOpen className="h-3 w-3" />
                          Medium
                        </Badge>
                      </a>
                    )}
                    {farm.socials.waxdao && (
                      <a href={farm.socials.waxdao} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer flex items-center gap-1.5">
                          <ExternalLink className="h-3 w-3" />
                          WaxDAO
                        </Badge>
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reward Pools */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-cheese" />
                Reward Pools
              </CardTitle>
              <DepositRewardsDialog farm={farm} onSuccess={handleFarmUpdated} />
            </div>
          </CardHeader>
          <CardContent>
            {farm.reward_pools.length > 0 ? (
              <div className="space-y-3">
                {farm.reward_pools.map((pool, index) => {
                  const ebInfo = showEffective
                    ? calculateEffectiveBalance(pool, farm.last_payout, now)
                    : null;
                  const timeLeft = ebInfo ? formatTimeRemaining(ebInfo.hoursRemaining) : null;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={getTokenLogoUrl(pool.contract, pool.symbol)}
                          alt={pool.symbol}
                          className="h-8 w-8 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                          }}
                        />
                        <div>
                          <p className="font-medium">{pool.symbol}</p>
                          <p className="text-xs text-muted-foreground">{pool.contract}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {ebInfo ? (
                          <>
                            <Badge variant="secondary" className="bg-cheese/10 text-cheese border-cheese/20">
                              {contractBalances[pool.symbol] !== undefined 
                                ? formatAmount(contractBalances[pool.symbol], pool.symbol, pool.precision)
                                : `~${formatAmount(ebInfo.effectiveBalance, pool.symbol, pool.precision)}`
                              }
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Deposited: {formatRewardPool(pool)}
                            </p>
                            {ebInfo.hourlyRate > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Drain: {formatAmount(ebInfo.hourlyRate, pool.symbol, pool.precision)}/hr
                              </p>
                            )}
                            {timeLeft && (
                              <p className="text-xs text-primary/80">{timeLeft}</p>
                            )}
                          </>
                        ) : (
                          <Badge variant="secondary" className="bg-cheese/10 text-cheese border-cheese/20">
                            {formatRewardPool(pool)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No reward pools configured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Farm Stats</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NFTs Staked</p>
                <p className="text-2xl font-bold">{farm.staked_count.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cheese/10">
                <Coins className="h-5 w-5 text-cheese" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reward Tokens</p>
                <p className="text-2xl font-bold">{farm.reward_pools.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payout Interval</p>
                <p className="text-2xl font-bold">{formatPayoutInterval(farm.payout_interval)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                <Calendar className={`h-5 w-5 ${isExpired ? 'text-red-400' : 'text-green-400'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isExpired ? "Expired" : "Days Left"}
                </p>
                <p className="text-2xl font-bold">
                  {isExpired ? expirationDate.toLocaleDateString() : daysRemaining}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* NFT Staking Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sprout className="h-5 w-5 text-primary" />
          Stake & Earn
        </h2>
        <NFTStaking farm={farm} />
      </div>

      {/* Cover Image Section */}
      {farm.profile?.cover_image && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-cheese" />
            Cover Image
          </h4>
          <div className="rounded-lg overflow-hidden">
            <img 
              src={getIpfsUrlWithGateway(farm.profile.cover_image, coverGatewayIndex)} 
              alt={`${farm.farm_name} cover`}
              className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(getIpfsUrlWithGateway(farm.profile.cover_image, coverGatewayIndex), '_blank')}
              title="Click to view full size"
              onError={() => {
                if (coverGatewayIndex < IPFS_GATEWAYS.length - 1) {
                  setCoverGatewayIndex(prev => prev + 1);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* External Link */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">View on WaxDAO</h3>
              <p className="text-sm text-muted-foreground">
                View this farm on WaxDAO for additional details.
              </p>
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open(`https://waxdao.io/v2/farm/${farm.farm_name}`, "_blank")}
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              View on WaxDAO
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Farm Profile Dialog */}
      {isCreator && (
        <EditFarmProfile
          farm={farm}
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          onProfileUpdated={handleFarmUpdated}
        />
      )}
    </div>
  );
}
