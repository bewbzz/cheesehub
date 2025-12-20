import { useState } from "react";
import { Coins, ArrowRight, Clock, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StakeInfo, FAUCET_CONFIG, getUnstakeCooldownRemaining, formatCooldownTime } from "@/lib/faucet";

interface InlineStakeSectionProps {
  cheeseBalance: string;
  stakeInfo: StakeInfo | null;
  isConnected: boolean;
  isStaking: boolean;
  isUnstaking: boolean;
  onStake: (amount: number) => void;
  onUnstake: () => void;
  onRefund: () => void;
}

export function InlineStakeSection({
  cheeseBalance,
  stakeInfo,
  isConnected,
  isStaking,
  isUnstaking,
  onStake,
  onUnstake,
  onRefund,
}: InlineStakeSectionProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const balance = parseFloat(cheeseBalance.split(" ")[0] || "0");
  const amount = parseFloat(stakeAmount) || 0;
  const stakedAmount = parseFloat(stakeInfo?.amount?.split(" ")[0] || "0");
  const stakeType = stakeInfo?.stakeType;
  const cooldownRemaining = stakeInfo?.unstakeTime
    ? getUnstakeCooldownRemaining(stakeInfo.unstakeTime)
    : 0;
  const canRefund = stakeInfo?.isUnstaking && cooldownRemaining === 0;

  const handleStake = () => {
    if (amount >= FAUCET_CONFIG.wedgeAmount) {
      onStake(amount);
      setStakeAmount("");
    }
  };

  const isValidAmount = amount >= FAUCET_CONFIG.wedgeAmount;
  const hasEnoughBalance = balance >= amount;

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
          <p className="text-xl font-bold text-foreground">
            {isConnected ? balance.toLocaleString() : "---"}
          </p>
          <p className="text-xs text-muted-foreground">CHEESE</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Staked</p>
          <p className="text-xl font-bold text-foreground">
            {isConnected ? stakedAmount.toLocaleString() : "---"}
          </p>
          <p className="text-xs text-cheese">
            {stakeType ? stakeType.toUpperCase() : "---"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">APR</p>
          <p className="text-xl font-bold text-cheese">
            {stakeType === "wheel" ? `${FAUCET_CONFIG.wheelApr}%` : "0%"}
          </p>
          <p className="text-xs text-muted-foreground">WHEEL only</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
          <p className="text-xl font-bold text-foreground">
            {!isConnected
              ? "---"
              : stakeInfo?.isUnstaking
                ? formatCooldownTime(cooldownRemaining)
                : stakeInfo
                  ? "Active"
                  : "None"
            }
          </p>
          {stakeInfo?.isUnstaking && (
            <p className="text-xs text-destructive">Unstaking</p>
          )}
        </div>
      </div>

      {/* Stake Controls Row */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
        {/* Tier Presets */}
        <div className="flex gap-2">
          <button
            onClick={() => setStakeAmount(FAUCET_CONFIG.wedgeAmount.toString())}
            className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
              amount >= FAUCET_CONFIG.wedgeAmount && amount < FAUCET_CONFIG.wheelAmount
                ? "border-cheese bg-cheese/20 text-cheese"
                : "border-border hover:border-cheese/50 text-muted-foreground"
            }`}
          >
            WEDGE ({FAUCET_CONFIG.wedgeAmount.toLocaleString()})
          </button>
          <button
            onClick={() => setStakeAmount(FAUCET_CONFIG.wheelAmount.toString())}
            className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
              amount >= FAUCET_CONFIG.wheelAmount
                ? "border-cheese bg-cheese/20 text-cheese"
                : "border-border hover:border-cheese/50 text-muted-foreground"
            }`}
          >
            WHEEL ({FAUCET_CONFIG.wheelAmount.toLocaleString()})
          </button>
        </div>

        {/* Amount Input */}
        <div className="flex-1 flex gap-2">
          <Input
            type="number"
            placeholder="Amount to stake..."
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="bg-background/50 min-w-[140px]"
          />
          <Button
            onClick={handleStake}
            disabled={!isConnected || !isValidAmount || !hasEnoughBalance || isStaking}
            className="bg-cheese text-cheese-foreground hover:bg-cheese/90 whitespace-nowrap"
          >
            {isStaking ? "Staking..." : "Stake"}
            {!isStaking && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {/* Unstake/Refund Buttons */}
        {stakeInfo && (
          <div className="flex gap-2">
            {stakeInfo.isUnstaking ? (
              <Button
                onClick={onRefund}
                disabled={!canRefund || isUnstaking}
                variant={canRefund ? "default" : "outline"}
                className="whitespace-nowrap"
              >
                {isUnstaking
                  ? "..."
                  : canRefund
                    ? "Claim Refund"
                    : formatCooldownTime(cooldownRemaining)
                }
              </Button>
            ) : (
              <Button
                onClick={onUnstake}
                disabled={isUnstaking}
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 whitespace-nowrap"
              >
                <ArrowDownRight className="mr-1 h-4 w-4" />
                {isUnstaking ? "..." : "Unstake"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
