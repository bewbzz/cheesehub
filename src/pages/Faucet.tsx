import { Header } from "@/components/Header";
import { useWax } from "@/context/WaxContext";
import { useFaucet } from "@/hooks/useFaucet";
import { InlineStakeSection } from "@/components/faucet/InlineStakeSection";
import { RewardsSection } from "@/components/faucet/RewardsSection";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { FAUCET_CONFIG } from "@/lib/faucet";

export default function Faucet() {
  const { isConnected } = useWax();
  const {
    stakeInfo,
    rewards,
    cheeseBalance,
    isLoading,
    isStaking,
    isUnstaking,
    isClaiming,
    stake,
    unstake,
    refund,
    claim,
    refresh,
  } = useFaucet();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="container py-12 max-w-4xl mx-auto space-y-8">
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">
            <span className="text-cheese-gradient">🧀 $CHEESE Community Faucet 🧀</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Stake <span className="text-cheese font-semibold">WEDGE</span> ({FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE)
            for daily claims, or <span className="text-cheese font-semibold">WHEEL</span> ({FAUCET_CONFIG.wheelAmount.toLocaleString()} CHEESE)
            for {FAUCET_CONFIG.wheelApr}% APR plus CHEESE, WAX, and LSWAX rewards!
          </p>
          <Button
            onClick={refresh}
            disabled={isLoading || !isConnected}
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Inline Stake Section */}
        <InlineStakeSection
          cheeseBalance={cheeseBalance}
          stakeInfo={stakeInfo}
          isConnected={isConnected}
          isStaking={isStaking}
          isUnstaking={isUnstaking}
          onStake={stake}
          onUnstake={unstake}
          onRefund={refund}
        />

        {/* Rewards Section */}
        <RewardsSection
          rewards={rewards}
          stakeInfo={stakeInfo}
          isConnected={isConnected}
          isClaiming={isClaiming}
          onClaim={claim}
        />

        {/* Info Section */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6 text-sm">
          <h3 className="font-bold text-foreground mb-3">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-muted-foreground">
            <div>
              <p className="text-cheese font-semibold mb-1">WEDGE Tier</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Stake min {FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE</li>
                <li>• Claim daily CHEESE rewards</li>
              </ul>
            </div>
            <div>
              <p className="text-cheese font-semibold mb-1">WHEEL Tier</p>
              <ul className="space-y-0.5 text-xs">
                <li>• Stake min {FAUCET_CONFIG.wheelAmount.toLocaleString()} CHEESE</li>
                <li>• Earn {FAUCET_CONFIG.wheelApr}% APR + CHEESE, WAX, LSWAX</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-4 pt-3 border-t border-border/30">
            Note: Unstaking has a 72-hour cooldown. No rewards during cooldown.
          </p>
        </div>
      </section>
    </div>
  );
}
