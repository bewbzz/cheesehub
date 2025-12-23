import { DaoInfo, DAO_TYPES, PROPOSER_TYPES, getIpfsUrl } from "@/lib/dao";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ExternalLink, Clock, Coins, Vote } from "lucide-react";
import { useState } from "react";
import { DaoDetail } from "./DaoDetail";
import { cn } from "@/lib/utils";

interface DaoCardProps {
  dao: DaoInfo;
}

export function DaoCard({ dao }: DaoCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  // Parse token symbol (format: "8,CHEESE" -> "CHEESE")
  const tokenDisplay = dao.token_symbol !== "0,NULL" 
    ? dao.token_symbol.split(",")[1] 
    : null;

  // Format date
  const createdDate = dao.time_created 
    ? new Date(dao.time_created * 1000).toLocaleDateString()
    : "Unknown";

  return (
    <>
      <Card className="bg-card/50 border-border/50 hover:border-cheese/30 transition-all duration-300 hover:shadow-lg hover:shadow-cheese/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            {/* DAO Name & Type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-10 w-10 rounded-lg bg-cheese/10 flex items-center justify-center overflow-hidden">
                  {dao.logo ? (
                    <img 
                      src={getIpfsUrl(dao.logo)} 
                      alt={dao.dao_name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Users className={cn("h-5 w-5 text-cheese", dao.logo && "hidden")} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground truncate">
                    {dao.dao_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    by {dao.creator}
                  </p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-cheese border-cheese/30 shrink-0">
              {DAO_TYPES[dao.dao_type] || "Unknown"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
              <Vote className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{(dao.threshold ?? 0).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Threshold</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{dao.hours_per_proposal ?? 0}h</p>
                <p className="text-xs text-muted-foreground">Vote Duration</p>
              </div>
            </div>
          </div>

          {/* Token & Cost Info */}
          <div className="space-y-1 text-sm">
            {tokenDisplay && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-cheese">🧀</span>
                <span>Gov Token: <span className="text-foreground font-medium">{tokenDisplay}</span></span>
              </div>
            )}
            {dao.gov_schemas && dao.gov_schemas.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>🎨</span>
                <span>NFT Collections: <span className="text-foreground font-medium">{dao.gov_schemas.length}</span></span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="h-3 w-3" />
              <span>Proposal Cost: <span className="text-foreground font-medium">{dao.proposal_cost}</span></span>
            </div>
          </div>

          {/* Proposer Type Badge */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created: {createdDate}</span>
            <Badge variant="secondary" className="text-xs">
              {PROPOSER_TYPES[dao.proposer_type] || "Unknown"} can propose
            </Badge>
          </div>

          {/* View Button */}
          <Button
            onClick={() => setShowDetail(true)}
            className="w-full bg-cheese/10 text-cheese hover:bg-cheese/20 border border-cheese/20"
            variant="outline"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View DAO
          </Button>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <DaoDetail
        dao={dao}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
}
