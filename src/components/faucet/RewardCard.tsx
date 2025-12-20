import { Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClaimableRewards, StakeInfo } from "@/lib/faucet";

interface RewardCardProps {
  rewards: ClaimableRewards;
  stakeInfo: StakeInfo | null;
  isConnected: boolean;
  isClaiming: boolean;
  onClaim: (claimType: "cheese" | "wax" | "lswax" | "wedge") => void;
}

interface RewardRowProps {
  label: string;
  amount: string;
  claimType: "cheese" | "wax" | "lswax" | "wedge";
  disabled: boolean;
  isClaiming: boolean;
  onClaim: (claimType: "cheese" | "wax" | "lswax" | "wedge") => void;
  description?: string;
  requiresWheel?: boolean;
  stakeType?: "wedge" | "wheel" | null;
}

function RewardRow({ 
  label, 
  amount, 
  claimType, 
  disabled, 
  isClaiming, 
  onClaim,
  description,
  requiresWheel,
  stakeType,
}: RewardRowProps) {
  const amountValue = parseFloat(amount.split(" ")[0] || "0");
  const canClaim = amountValue > 0 && !disabled;
  const isLocked = requiresWheel && stakeType !== "wheel";

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border/30">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-lg font-bold text-cheese">{amount}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {isLocked && (
          <p className="text-xs text-destructive">Requires WHEEL stake</p>
        )}
      </div>
      <Button
        onClick={() => onClaim(claimType)}
        disabled={!canClaim || isClaiming || isLocked}
        size="sm"
        variant={canClaim && !isLocked ? "default" : "outline"}
        className={canClaim && !isLocked ? "bg-cheese text-cheese-foreground hover:bg-cheese/90" : ""}
      >
        {isClaiming ? "..." : "Claim"}
      </Button>
    </div>
  );
}

export function RewardCard({ rewards, stakeInfo, isConnected, isClaiming, onClaim }: RewardCardProps) {
  const stakeType = stakeInfo?.stakeType;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-cheese" />
          Claimable Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isConnected ? (
          <p className="text-center text-muted-foreground py-8">
            Connect your wallet to view rewards
          </p>
        ) : !stakeInfo ? (
          <p className="text-center text-muted-foreground py-8">
            Stake CHEESE to start earning rewards
          </p>
        ) : (
          <>
            <RewardRow
              label="Daily CHEESE (Wedge)"
              amount={rewards.wedgeCheese}
              claimType="wedge"
              disabled={!isConnected}
              isClaiming={isClaiming}
              onClaim={onClaim}
              description="Available for all stakers"
              stakeType={stakeType}
            />
            <RewardRow
              label="CHEESE APR Rewards"
              amount={rewards.cheese}
              claimType="cheese"
              disabled={!isConnected}
              isClaiming={isClaiming}
              onClaim={onClaim}
              description="33% APR for WHEEL stakers"
              requiresWheel
              stakeType={stakeType}
            />
            <RewardRow
              label="Daily WAX"
              amount={rewards.wax}
              claimType="wax"
              disabled={!isConnected}
              isClaiming={isClaiming}
              onClaim={onClaim}
              requiresWheel
              stakeType={stakeType}
            />
            <RewardRow
              label="Daily LSWAX"
              amount={rewards.lswax}
              claimType="lswax"
              disabled={!isConnected}
              isClaiming={isClaiming}
              onClaim={onClaim}
              requiresWheel
              stakeType={stakeType}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
