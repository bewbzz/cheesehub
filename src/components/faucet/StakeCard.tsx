import { useState } from "react";
import { Coins, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FAUCET_CONFIG } from "@/lib/faucet";

interface StakeCardProps {
  cheeseBalance: string;
  isConnected: boolean;
  isStaking: boolean;
  onStake: (amount: number) => void;
}

export function StakeCard({ cheeseBalance, isConnected, isStaking, onStake }: StakeCardProps) {
  const [stakeAmount, setStakeAmount] = useState("");
  const balance = parseFloat(cheeseBalance.split(" ")[0] || "0");
  const amount = parseFloat(stakeAmount) || 0;

  const handleStake = () => {
    if (amount >= FAUCET_CONFIG.wedgeAmount) {
      onStake(amount);
      setStakeAmount("");
    }
  };

  const setPresetAmount = (preset: number) => {
    setStakeAmount(preset.toString());
  };

  const isValidAmount = amount >= FAUCET_CONFIG.wedgeAmount;
  const hasEnoughBalance = balance >= amount;
  const stakeType = amount >= FAUCET_CONFIG.wheelAmount ? "WHEEL" : amount >= FAUCET_CONFIG.wedgeAmount ? "WEDGE" : null;

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="h-5 w-5 text-cheese" />
          Stake CHEESE
        </CardTitle>
        <CardDescription>
          Stake your CHEESE to earn rewards. Choose between WEDGE (1,000) or WHEEL (5,000) tiers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier Info */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPresetAmount(FAUCET_CONFIG.wedgeAmount)}
            className={`p-3 rounded-lg border transition-all text-left ${
              stakeType === "WEDGE"
                ? "border-cheese bg-cheese/10"
                : "border-border hover:border-cheese/50"
            }`}
          >
            <p className="font-semibold text-foreground">WEDGE</p>
            <p className="text-sm text-muted-foreground">{FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE</p>
            <p className="text-xs text-cheese mt-1">Daily CHEESE claim</p>
          </button>
          <button
            onClick={() => setPresetAmount(FAUCET_CONFIG.wheelAmount)}
            className={`p-3 rounded-lg border transition-all text-left ${
              stakeType === "WHEEL"
                ? "border-cheese bg-cheese/10"
                : "border-border hover:border-cheese/50"
            }`}
          >
            <p className="font-semibold text-foreground">WHEEL</p>
            <p className="text-sm text-muted-foreground">{FAUCET_CONFIG.wheelAmount.toLocaleString()} CHEESE</p>
            <p className="text-xs text-cheese mt-1">{FAUCET_CONFIG.wheelApr}% APR + All Claims</p>
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount to stake</span>
            <button 
              className="text-cheese hover:underline"
              onClick={() => setStakeAmount(balance.toString())}
            >
              Max: {balance.toLocaleString()}
            </button>
          </div>
          <Input
            type="number"
            placeholder="Enter amount..."
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="bg-background/50"
          />
          {stakeType && (
            <p className="text-sm text-cheese">
              You'll receive a {stakeType} stake
            </p>
          )}
        </div>

        {/* Stake Button */}
        <Button
          onClick={handleStake}
          disabled={!isConnected || !isValidAmount || !hasEnoughBalance || isStaking}
          className="w-full bg-cheese text-cheese-foreground hover:bg-cheese/90"
        >
          {isStaking ? (
            "Staking..."
          ) : !isConnected ? (
            "Connect Wallet"
          ) : !isValidAmount ? (
            `Minimum ${FAUCET_CONFIG.wedgeAmount.toLocaleString()} CHEESE`
          ) : !hasEnoughBalance ? (
            "Insufficient Balance"
          ) : (
            <>
              Stake {amount.toLocaleString()} CHEESE
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
