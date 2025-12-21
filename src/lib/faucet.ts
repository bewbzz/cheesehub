import { fetchTable, WAXDAO_CONTRACT } from "./wax";

// Smart contract addresses
export const STAKING_CONTRACT = "cheesecheese"; // Handles stake/unstake/refund
export const FAUCET_CONTRACT = "cheesefaucet";  // Handles claims
export const CHEESE_TOKEN_CONTRACT = "cheloyszcvry";

// Token IDs for claims on cheesefaucet contract
export const CLAIM_TOKEN_IDS = {
  wedgeCheese: 1,  // CHEESE for all stakers (WEDGE claim)
  wheelCheese: 2,  // CHEESE for WHEEL stakers (33% APR)
  wax: 3,          // WAX for WHEEL stakers
  lswax: 4,        // LSWAX for WHEEL stakers
} as const;

export type ClaimTokenId = typeof CLAIM_TOKEN_IDS[keyof typeof CLAIM_TOKEN_IDS];

// Stake types
export type StakeType = "wedge" | "wheel" | null;

export interface StakeInfo {
  staker: string;
  amount: string;
  stakeType: StakeType;
  lastClaim: number;
  unstakeTime: number | null;
  isUnstaking: boolean;
}

export interface ClaimableRewards {
  cheese: string;
  wax: string;
  lswax: string;
  wedgeCheese: string;
}

export interface FaucetConfig {
  wedgeAmount: number;
  wheelAmount: number;
  wedgeApr: number;
  wheelApr: number;
  unstakeCooldown: number; // 72 hours in seconds
}

export const FAUCET_CONFIG: FaucetConfig = {
  wedgeAmount: 1000,
  wheelAmount: 5000,
  wedgeApr: 0, // WEDGE stakers don't get APR
  wheelApr: 33, // 33% APR for WHEEL stakers
  unstakeCooldown: 72 * 60 * 60, // 72 hours
};

// Fetch user's stake info from the staking contract
export async function getStakeInfo(account: string): Promise<StakeInfo | null> {
  try {
    const rows = await fetchTable<any>(
      STAKING_CONTRACT,
      STAKING_CONTRACT,
      "stakers",
      {
        lower_bound: account,
        upper_bound: account,
        limit: 1,
      }
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const amount = parseFloat(row.amount?.split(" ")[0] || "0");
    
    let stakeType: StakeType = null;
    if (amount >= FAUCET_CONFIG.wheelAmount) {
      stakeType = "wheel";
    } else if (amount >= FAUCET_CONFIG.wedgeAmount) {
      stakeType = "wedge";
    }

    return {
      staker: row.staker || account,
      amount: row.amount || "0 CHEESE",
      stakeType,
      lastClaim: row.last_claim || 0,
      unstakeTime: row.unstake_time || null,
      isUnstaking: (row.unstake_time || 0) > 0,
    };
  } catch (error) {
    console.error("Failed to fetch stake info:", error);
    return null;
  }
}

// Fetch claimable rewards
export async function getClaimableRewards(account: string): Promise<ClaimableRewards> {
  try {
    const rows = await fetchTable<any>(
      FAUCET_CONTRACT,
      account,
      "claims",
      { limit: 10 }
    );

    const rewards: ClaimableRewards = {
      cheese: "0 CHEESE",
      wax: "0 WAX",
      lswax: "0 LSWAX",
      wedgeCheese: "0 CHEESE",
    };

    for (const row of rows) {
      const symbol = row.quantity?.split(" ")[1];
      if (symbol === "CHEESE") {
        if (row.claim_type === "wedge") {
          rewards.wedgeCheese = row.quantity;
        } else {
          rewards.cheese = row.quantity;
        }
      } else if (symbol === "WAX") {
        rewards.wax = row.quantity;
      } else if (symbol === "LSWAX") {
        rewards.lswax = row.quantity;
      }
    }

    return rewards;
  } catch (error) {
    console.error("Failed to fetch claimable rewards:", error);
    return {
      cheese: "0 CHEESE",
      wax: "0 WAX",
      lswax: "0 LSWAX",
      wedgeCheese: "0 CHEESE",
    };
  }
}

// Get user's CHEESE balance
export async function getCheeseBalance(account: string): Promise<string> {
  try {
    const rows = await fetchTable<any>(
      CHEESE_TOKEN_CONTRACT,
      account,
      "accounts",
      { limit: 10 }
    );

    const cheeseRow = rows.find((r: any) => r.balance?.includes("CHEESE"));
    return cheeseRow?.balance || "0 CHEESE";
  } catch (error) {
    console.error("Failed to fetch CHEESE balance:", error);
    return "0 CHEESE";
  }
}

// Build stake action (transfer CHEESE to staking contract with memo)
export function buildStakeAction(account: string, amount: number) {
  const quantity = `${amount.toFixed(4)} CHEESE`;
  return {
    account: CHEESE_TOKEN_CONTRACT,
    name: "transfer",
    authorization: [{ actor: account, permission: "active" }],
    data: {
      from: account,
      to: STAKING_CONTRACT,
      quantity,
      memo: "stake",
    },
  };
}

// Build unstake action
export function buildUnstakeAction(account: string) {
  return {
    account: STAKING_CONTRACT,
    name: "unstake",
    authorization: [{ actor: account, permission: "active" }],
    data: {
      staker: account,
    },
  };
}

// Build refund action (after cooldown)
export function buildRefundAction(account: string) {
  return {
    account: STAKING_CONTRACT,
    name: "refund",
    authorization: [{ actor: account, permission: "active" }],
    data: {
      staker: account,
    },
  };
}

// Build claim action (on cheesefaucet contract with token ID)
export function buildClaimAction(account: string, tokenId: ClaimTokenId) {
  return {
    account: FAUCET_CONTRACT,
    name: "claim",
    authorization: [{ actor: account, permission: "active" }],
    data: {
      tokenid: tokenId,
      user: account,
    },
  };
}

// Calculate time remaining for unstake cooldown
export function getUnstakeCooldownRemaining(unstakeTime: number): number {
  const now = Math.floor(Date.now() / 1000);
  const unlockTime = unstakeTime + FAUCET_CONFIG.unstakeCooldown;
  return Math.max(0, unlockTime - now);
}

// Format cooldown time
export function formatCooldownTime(seconds: number): string {
  if (seconds <= 0) return "Ready";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
