import { useState, useEffect, useCallback } from "react";
import { useWax } from "@/context/WaxContext";
import {
  StakeInfo,
  ClaimableRewards,
  getStakeInfo,
  getClaimableRewards,
  getCheeseBalance,
  buildStakeAction,
  buildUnstakeAction,
  buildRefundAction,
  buildClaimAction,
  FAUCET_CONFIG,
} from "@/lib/faucet";
import { useToast } from "@/hooks/use-toast";

export function useFaucet() {
  const { session, isConnected, accountName } = useWax();
  const { toast } = useToast();
  
  const [stakeInfo, setStakeInfo] = useState<StakeInfo | null>(null);
  const [rewards, setRewards] = useState<ClaimableRewards>({
    cheese: "0 CHEESE",
    wax: "0 WAX",
    lswax: "0 LSWAX",
    wedgeCheese: "0 CHEESE",
  });
  const [cheeseBalance, setCheeseBalance] = useState("0 CHEESE");
  const [isLoading, setIsLoading] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Fetch all faucet data
  const fetchFaucetData = useCallback(async () => {
    if (!accountName) return;
    
    setIsLoading(true);
    try {
      const [stake, rewardsData, balance] = await Promise.all([
        getStakeInfo(accountName),
        getClaimableRewards(accountName),
        getCheeseBalance(accountName),
      ]);
      
      setStakeInfo(stake);
      setRewards(rewardsData);
      setCheeseBalance(balance);
    } catch (error) {
      console.error("Failed to fetch faucet data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  // Auto-fetch when connected
  useEffect(() => {
    if (isConnected && accountName) {
      fetchFaucetData();
    } else {
      setStakeInfo(null);
      setRewards({
        cheese: "0 CHEESE",
        wax: "0 WAX",
        lswax: "0 LSWAX",
        wedgeCheese: "0 CHEESE",
      });
      setCheeseBalance("0 CHEESE");
    }
  }, [isConnected, accountName, fetchFaucetData]);

  // Stake CHEESE
  const stake = async (amount: number) => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (amount < FAUCET_CONFIG.wedgeAmount) {
      toast({
        title: "Invalid amount",
        description: `Minimum stake is ${FAUCET_CONFIG.wedgeAmount} CHEESE (WEDGE)`,
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    try {
      const action = buildStakeAction(accountName, amount);
      await session.transact({ actions: [action] });
      
      toast({
        title: "Stake successful! 🧀",
        description: `You staked ${amount} CHEESE`,
      });
      
      await fetchFaucetData();
    } catch (error: any) {
      console.error("Stake failed:", error);
      toast({
        title: "Stake failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };

  // Unstake (start cooldown)
  const unstake = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsUnstaking(true);
    try {
      const action = buildUnstakeAction(accountName);
      await session.transact({ actions: [action] });
      
      toast({
        title: "Unstake initiated",
        description: "Your CHEESE will be available in 72 hours",
      });
      
      await fetchFaucetData();
    } catch (error: any) {
      console.error("Unstake failed:", error);
      toast({
        title: "Unstake failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  // Refund (after cooldown)
  const refund = async () => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsUnstaking(true);
    try {
      const action = buildRefundAction(accountName);
      await session.transact({ actions: [action] });
      
      toast({
        title: "Refund successful! 🧀",
        description: "Your CHEESE has been returned",
      });
      
      await fetchFaucetData();
    } catch (error: any) {
      console.error("Refund failed:", error);
      toast({
        title: "Refund failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  };

  // Claim rewards
  const claim = async (claimType: "cheese" | "wax" | "lswax" | "wedge") => {
    if (!session || !accountName) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);
    try {
      const action = buildClaimAction(accountName, claimType);
      await session.transact({ actions: [action] });
      
      const tokenName = claimType === "wedge" ? "CHEESE (Wedge)" : claimType.toUpperCase();
      toast({
        title: "Claim successful! 🧀",
        description: `You claimed your ${tokenName} rewards`,
      });
      
      await fetchFaucetData();
    } catch (error: any) {
      console.error("Claim failed:", error);
      toast({
        title: "Claim failed",
        description: error.message || "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return {
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
    refresh: fetchFaucetData,
  };
}
