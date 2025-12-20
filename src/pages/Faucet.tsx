import { Header } from "@/components/Header";
import { useWax } from "@/context/WaxContext";
import { useFaucet } from "@/hooks/useFaucet";
import { StakeStats } from "@/components/faucet/StakeStats";
import { StakeCard } from "@/components/faucet/StakeCard";
import { RewardCard } from "@/components/faucet/RewardCard";
import { UnstakeCard } from "@/components/faucet/UnstakeCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from "lucide-react";
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
      
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cheese/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cheese/5 rounded-full blur-3xl" />
        
        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cheese/10 border border-cheese/20 mb-6">
              <Zap className="h-4 w-4 text-cheese" />
              <span className="text-sm font-medium text-cheese">CHEESEFaucet 2.0</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-cheese-gradient">🧀 $CHEESE Community Faucet 🧀</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8">
              Stake your CHEESE to earn daily rewards. Choose between <span className="text-cheese font-semibold">WEDGE</span> ({FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE) 
              for daily claims, or <span className="text-cheese font-semibold">WHEEL</span> ({FAUCET_CONFIG.wheelAmount.toLocaleString()} CHEESE) 
              for {FAUCET_CONFIG.wheelApr}% APR plus CHEESE, WAX, and LSWAX rewards!
            </p>

            <Button
              onClick={refresh}
              disabled={isLoading || !isConnected}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container pb-16 space-y-8">
        {/* Stats */}
        <StakeStats
          cheeseBalance={cheeseBalance}
          stakeInfo={stakeInfo}
          isConnected={isConnected}
        />

        {/* Staking and Rewards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Staking */}
          <div className="space-y-6">
            <StakeCard
              cheeseBalance={cheeseBalance}
              isConnected={isConnected}
              isStaking={isStaking}
              onStake={stake}
            />
            <UnstakeCard
              stakeInfo={stakeInfo}
              isConnected={isConnected}
              isUnstaking={isUnstaking}
              onUnstake={unstake}
              onRefund={refund}
            />
          </div>

          {/* Right Column - Rewards */}
          <RewardCard
            rewards={rewards}
            stakeInfo={stakeInfo}
            isConnected={isConnected}
            isClaiming={isClaiming}
            onClaim={claim}
          />
        </div>

        {/* Info Section */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-cheese mb-2">🧀 WEDGE Tier</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stake minimum {FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE</li>
                <li>• Claim daily CHEESE rewards</li>
                <li>• Perfect for smaller holders</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-cheese mb-2">🧀 WHEEL Tier</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stake minimum {FAUCET_CONFIG.wheelAmount.toLocaleString()} CHEESE</li>
                <li>• Earn {FAUCET_CONFIG.wheelApr}% APR on your stake</li>
                <li>• Claim daily CHEESE, WAX, and LSWAX</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/30">
            Note: Unstaking has a 72-hour cooldown period. You won't earn rewards during the cooldown.
          </p>
        </div>
      </section>
    </div>
  );
}
