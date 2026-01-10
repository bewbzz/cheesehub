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
  Construction
} from "lucide-react";
import { fetchFarmDetails, getIpfsUrl, FarmInfo, RewardPool } from "@/lib/farm";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { useToast } from "@/hooks/use-toast";
import { NFTStaking } from "./NFTStaking";
import { ManageStakableAssets } from "./ManageStakableAssets";
import { OpenFarmDialog } from "./OpenFarmDialog";
import { ExtendFarmDialog } from "./ExtendFarmDialog";
import { useWax } from "@/context/WaxContext";
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

  const queryClient = useQueryClient();
  
  const { data: farm, isLoading, error } = useQuery({
    queryKey: ["farmDetail", farmName],
    queryFn: () => fetchFarmDetails(farmName!),
    enabled: !!farmName,
    staleTime: 30000,
  });

  const handleFarmUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["farmDetail", farmName] });
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
  const isCreator = accountName && accountName === farm.creator;

  const formatPayoutInterval = (seconds: number) => {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  const formatRewardPool = (pool: RewardPool) => {
    const amount = parseFloat(pool.balance) || 0;
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ${pool.symbol}`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K ${pool.symbol}`;
    }
    return `${amount.toFixed(pool.precision || 4)} ${pool.symbol}`;
  };

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
            {isUnderConstruction ? (
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
              <ManageStakableAssets farm={farm} onSuccess={handleFarmUpdated} />
            )}
            {isCreator && isUnderConstruction && (
              <OpenFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
            )}
          </div>
        </div>
      </div>

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
                  {isCreator && (
                    <ExtendFarmDialog farm={farm} onSuccess={handleFarmUpdated} />
                  )}
                </div>
                <p className="font-medium">{expirationDate.toLocaleDateString()}</p>
              </div>
            </div>

            <Separator />

            {farm.description && (
              <div>
                <p className="text-muted-foreground text-sm mb-1">Description</p>
                <p className="text-foreground">{farm.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward Pools */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-cheese" />
              Reward Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            {farm.reward_pools.length > 0 ? (
              <div className="space-y-3">
                {farm.reward_pools.map((pool, index) => (
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
                    <Badge variant="secondary" className="bg-cheese/10 text-cheese border-cheese/20">
                      {formatRewardPool(pool)}
                    </Badge>
                  </div>
                ))}
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

      {/* Cover Image */}
      {farm.profile?.cover_image && (
        <div className="rounded-xl overflow-hidden border border-border/50">
          <img
            src={getIpfsUrl(farm.profile.cover_image)}
            alt={`${farm.farm_name} cover`}
            className="w-full h-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* NFT Staking Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sprout className="h-5 w-5 text-primary" />
          Stake & Earn
        </h2>
        <NFTStaking farm={farm} />
      </div>

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
    </div>
  );
}
