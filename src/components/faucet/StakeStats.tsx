import { Coins, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StakeInfo, FAUCET_CONFIG, getUnstakeCooldownRemaining, formatCooldownTime } from "@/lib/faucet";

interface StakeStatsProps {
  cheeseBalance: string;
  stakeInfo: StakeInfo | null;
  isConnected: boolean;
}

export function StakeStats({ cheeseBalance, stakeInfo, isConnected }: StakeStatsProps) {
  const balance = parseFloat(cheeseBalance.split(" ")[0] || "0");
  const stakedAmount = parseFloat(stakeInfo?.amount?.split(" ")[0] || "0");
  const stakeType = stakeInfo?.stakeType;
  const cooldownRemaining = stakeInfo?.unstakeTime 
    ? getUnstakeCooldownRemaining(stakeInfo.unstakeTime) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* CHEESE Balance */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cheese/20">
              <Coins className="h-5 w-5 text-cheese" />
            </div>
            <span className="text-sm text-muted-foreground">CHEESE Balance</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isConnected ? balance.toLocaleString() : "---"}
          </p>
        </CardContent>
      </Card>

      {/* Staked Amount */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cheese/20">
              <TrendingUp className="h-5 w-5 text-cheese" />
            </div>
            <span className="text-sm text-muted-foreground">Staked</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">
              {isConnected ? stakedAmount.toLocaleString() : "---"}
            </p>
            {stakeType && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                stakeType === "wheel" 
                  ? "bg-cheese/20 text-cheese" 
                  : "bg-muted text-muted-foreground"
              }`}>
                {stakeType.toUpperCase()}
              </span>
            )}
          </div>
          {stakeType && (
            <p className="text-xs text-muted-foreground mt-1">
              {stakeType === "wheel" 
                ? `${FAUCET_CONFIG.wheelApr}% APR + Daily Claims`
                : "Daily CHEESE Claims Only"
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stake Status */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cheese/20">
              <Clock className="h-5 w-5 text-cheese" />
            </div>
            <span className="text-sm text-muted-foreground">Status</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {!isConnected 
              ? "---"
              : stakeInfo?.isUnstaking 
                ? formatCooldownTime(cooldownRemaining)
                : stakeInfo 
                  ? "Active" 
                  : "Not Staked"
            }
          </p>
          {stakeInfo?.isUnstaking && cooldownRemaining > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Unstaking in progress
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
