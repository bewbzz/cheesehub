import { Clock, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StakeInfo, getUnstakeCooldownRemaining, formatCooldownTime, FAUCET_CONFIG } from "@/lib/faucet";

interface UnstakeCardProps {
  stakeInfo: StakeInfo | null;
  isConnected: boolean;
  isUnstaking: boolean;
  onUnstake: () => void;
  onRefund: () => void;
}

export function UnstakeCard({ stakeInfo, isConnected, isUnstaking, onUnstake, onRefund }: UnstakeCardProps) {
  const cooldownRemaining = stakeInfo?.unstakeTime 
    ? getUnstakeCooldownRemaining(stakeInfo.unstakeTime) 
    : 0;
  const canRefund = stakeInfo?.isUnstaking && cooldownRemaining === 0;
  const stakedAmount = stakeInfo?.amount || "0 CHEESE";

  if (!isConnected || !stakeInfo) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowDownRight className="h-5 w-5 text-cheese" />
          Unstake CHEESE
        </CardTitle>
        <CardDescription>
          Unstaking has a 72-hour cooldown period. After the cooldown, you can claim your CHEESE back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-background/30 border border-border/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground">Your stake</span>
            <span className="font-bold text-foreground">{stakedAmount}</span>
          </div>
          {stakeInfo.isUnstaking && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Cooldown
              </span>
              <span className={`font-bold ${cooldownRemaining === 0 ? "text-green-500" : "text-cheese"}`}>
                {formatCooldownTime(cooldownRemaining)}
              </span>
            </div>
          )}
        </div>

        {stakeInfo.isUnstaking ? (
          <Button
            onClick={onRefund}
            disabled={!canRefund || isUnstaking}
            className="w-full"
            variant={canRefund ? "default" : "outline"}
          >
            {isUnstaking 
              ? "Processing..." 
              : canRefund 
                ? "Claim Refund" 
                : `Cooldown: ${formatCooldownTime(cooldownRemaining)}`
            }
          </Button>
        ) : (
          <Button
            onClick={onUnstake}
            disabled={isUnstaking}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            {isUnstaking ? "Processing..." : "Start Unstaking (72h cooldown)"}
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Note: You won't earn rewards during the cooldown period
        </p>
      </CardContent>
    </Card>
  );
}
