import { Coins, Droplets, Sparkles, CircleDollarSign } from "lucide-react";
import { RewardRow } from "./RewardRow";
import { ClaimableRewards, StakeInfo } from "@/lib/faucet";

interface RewardsSectionProps {
  rewards: ClaimableRewards;
  stakeInfo: StakeInfo | null;
  isConnected: boolean;
  isClaiming: boolean;
  onClaim: (claimType: "cheese" | "wax" | "lswax" | "wedge") => void;
}

export function RewardsSection({
  rewards,
  stakeInfo,
  isConnected,
  isClaiming,
  onClaim,
}: RewardsSectionProps) {
  const stakeType = stakeInfo?.stakeType;

  if (!isConnected) {
    return (
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Connect your wallet to view rewards</p>
      </div>
    );
  }

  if (!stakeInfo) {
    return (
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Stake CHEESE to start earning rewards</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-foreground mb-4">🧀 Claimable Rewards</h2>

      <RewardRow
        icon={Coins}
        label="CHEESE (Wedge Claim)"
        description="Daily CHEESE for all stakers"
        amount={rewards.wedgeCheese}
        claimType="wedge"
        disabled={!isConnected}
        isClaiming={isClaiming}
        onClaim={onClaim}
        stakeType={stakeType}
      />

      <RewardRow
        icon={Sparkles}
        label="CHEESE (33%+ APR)"
        description="APR rewards for WHEEL stakers"
        amount={rewards.cheese}
        claimType="cheese"
        disabled={!isConnected}
        isClaiming={isClaiming}
        onClaim={onClaim}
        requiresWheel
        stakeType={stakeType}
      />

      <RewardRow
        icon={CircleDollarSign}
        label="WAX"
        description="Daily WAX for WHEEL stakers"
        amount={rewards.wax}
        claimType="wax"
        disabled={!isConnected}
        isClaiming={isClaiming}
        onClaim={onClaim}
        requiresWheel
        stakeType={stakeType}
      />

      <RewardRow
        icon={Droplets}
        label="LSWAX"
        description="Liquid Staked WAX from waxfusion.io"
        amount={rewards.lswax}
        claimType="lswax"
        disabled={!isConnected}
        isClaiming={isClaiming}
        onClaim={onClaim}
        requiresWheel
        stakeType={stakeType}
      />
    </div>
  );
}
