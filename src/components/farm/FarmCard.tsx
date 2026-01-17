import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sprout, Users, Clock, ArrowRight } from "lucide-react";
import { FarmInfo, getIpfsUrl } from "@/lib/farm";

// Farm type labels matching contract values
const FARM_TYPE_DISPLAY: Record<number, string> = {
  0: "Collections",
  1: "Schemas",
  2: "Templates",
  3: "Attributes",
};

interface FarmCardProps {
  farm: FarmInfo;
  onSelect?: (farm: FarmInfo) => void;
}

export function FarmCard({ farm, onSelect }: FarmCardProps) {
  const navigate = useNavigate();
  const now = Math.floor(Date.now() / 1000);
  const isExpired = farm.expiration < now;
  const expirationDate = new Date(farm.expiration * 1000);
  const daysRemaining = Math.max(0, Math.ceil((farm.expiration - now) / 86400));

  // Format reward pools for display
  const formatRewardPool = (pool: { symbol: string; balance: string }) => {
    const amount = parseFloat(pool.balance) || 0;
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M ${pool.symbol}`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K ${pool.symbol}`;
    }
    return `${amount.toFixed(2)} ${pool.symbol}`;
  };

  const handleViewFarm = () => {
    navigate(`/farm/${farm.farm_name}`);
  };

  return (
    <Card 
      className="group overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all cursor-pointer"
      onClick={handleViewFarm}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {/* Farm Logo */}
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
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
              <Sprout className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {farm.farm_name}
              </h3>
              <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground border-border text-xs">
                {FARM_TYPE_DISPLAY[farm.farm_type] || "Unknown"}
              </Badge>
              {isExpired && (
                <Badge variant="destructive" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              by {farm.creator}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{farm.staked_count.toLocaleString()} NFTs staked</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {isExpired 
                ? `Expired ${expirationDate.toLocaleDateString()}`
                : `${daysRemaining}d remaining`
              }
            </span>
          </div>
        </div>

        {/* Reward Pools */}
        {farm.reward_pools.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Reward Pools</p>
            <div className="flex flex-wrap gap-1">
              {farm.reward_pools.map((pool, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-cheese/10 text-cheese border-cheese/20 text-xs"
                >
                  {formatRewardPool(pool)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleViewFarm();
            }}
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
