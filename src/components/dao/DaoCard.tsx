import { DaoInfo } from "@/lib/dao";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Coins, ExternalLink } from "lucide-react";
import { useState } from "react";
import { DaoDetail } from "./DaoDetail";

interface DaoCardProps {
  dao: DaoInfo;
}

export function DaoCard({ dao }: DaoCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <Card className="bg-card/50 border-border/50 hover:border-cheese/30 transition-all duration-300 hover:shadow-lg hover:shadow-cheese/5">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-4">
            {/* DAO Logo */}
            <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center overflow-hidden">
              {dao.logo ? (
                <img
                  src={dao.logo}
                  alt={dao.dao_name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Users className="h-6 w-6 text-cheese" />
              )}
            </div>
            
            {/* DAO Name & Description */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-foreground truncate">
                {dao.dao_name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {dao.description || "No description provided"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium">{dao.member_count}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium">{dao.proposal_count}</p>
              <p className="text-xs text-muted-foreground">Proposals</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <Coins className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium truncate">{dao.treasury_balance || "0"}</p>
              <p className="text-xs text-muted-foreground">Treasury</p>
            </div>
          </div>

          {/* Token Info */}
          {dao.token_symbol && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="text-cheese">🧀</span>
              <span>Token: {dao.token_symbol}</span>
            </div>
          )}

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
