import { fetchTable } from "@/lib/wax";

// Liquidity Locker contract
export const LIQLOCKER_CONTRACT = "liqlocker.gm";

// DEX Types
export const DEX = {
  DEFIBOX: "defibox",
  TACO: "taco",
} as const;

export type DexType = typeof DEX[keyof typeof DEX];

// LP Token Contracts
export const LP_CONTRACTS = {
  [DEX.DEFIBOX]: "lptoken.box",
  [DEX.TACO]: "swap.taco",
} as const;

// Lock status values
export const LIQ_LOCK_STATUS = {
  CREATED: 0,
  FUNDED: 1,
  WITHDRAWN: 2,
} as const;

// Liquidity lock table structure
export interface LiquidityLock {
  ID: number;
  creator: string;
  receiver: string;
  lp_token: string;        // e.g., "100.00000000 BOXABC"
  token_contract: string;  // lptoken.box or swap.taco
  pair_id: number;
  dex: string;             // "defibox" or "taco"
  time_of_creation: number;
  time_of_deposit: number;
  unlock_time: number;
  status: number;
}

// LP Token Balance from user's account
export interface LPTokenBalance {
  symbol: string;
  amount: string;
  contract: string;
  dex: DexType;
  pairId?: number;
}

// Fetch LP token balances from Defibox
export async function fetchDefiboxLPTokens(account: string): Promise<LPTokenBalance[]> {
  try {
    const balances = await fetchTable<{ balance: string }>(
      LP_CONTRACTS[DEX.DEFIBOX],
      account,
      "accounts",
      { limit: 100 }
    );
    
    return balances.map((b) => {
      const [amount, symbol] = b.balance.split(" ");
      // Extract pair ID from symbol (e.g., "BOXABC" -> try to get pair info)
      return {
        symbol: symbol || "UNKNOWN",
        amount: amount || "0",
        contract: LP_CONTRACTS[DEX.DEFIBOX],
        dex: DEX.DEFIBOX,
      };
    });
  } catch (error) {
    console.error("Failed to fetch Defibox LP tokens:", error);
    return [];
  }
}

// Fetch LP token balances from TacoSwap
export async function fetchTacoLPTokens(account: string): Promise<LPTokenBalance[]> {
  try {
    const balances = await fetchTable<{ balance: string }>(
      LP_CONTRACTS[DEX.TACO],
      account,
      "accounts",
      { limit: 100 }
    );
    
    return balances.map((b) => {
      const [amount, symbol] = b.balance.split(" ");
      return {
        symbol: symbol || "UNKNOWN",
        amount: amount || "0",
        contract: LP_CONTRACTS[DEX.TACO],
        dex: DEX.TACO,
      };
    });
  } catch (error) {
    console.error("Failed to fetch TacoSwap LP tokens:", error);
    return [];
  }
}

// Fetch all LP tokens for a user
export async function fetchAllLPTokens(account: string): Promise<LPTokenBalance[]> {
  const [defibox, taco] = await Promise.all([
    fetchDefiboxLPTokens(account),
    fetchTacoLPTokens(account),
  ]);
  return [...defibox, ...taco];
}

// Fetch liquidity locks for a specific user
export async function fetchUserLiquidityLocks(account: string): Promise<LiquidityLock[]> {
  try {
    const locks = await fetchTable<LiquidityLock>(
      LIQLOCKER_CONTRACT,
      LIQLOCKER_CONTRACT,
      "locks",
      {
        lower_bound: account,
        upper_bound: account,
        key_type: "name",
        index_position: 3, // receiver index
        limit: 100,
      }
    );
    
    console.log("Raw liquidity locks data:", locks);
    return locks;
  } catch (error) {
    console.error("Failed to fetch liquidity locks:", error);
    return [];
  }
}

// Parse LP asset string
export function parseLPAsset(asset: string | undefined): { amount: string; symbol: string } {
  if (!asset || typeof asset !== "string") {
    return { amount: "0", symbol: "UNKNOWN" };
  }
  const parts = asset.split(" ");
  return { amount: parts[0] || "0", symbol: parts[1] || "UNKNOWN" };
}

// Format unlock time from Unix timestamp
export function formatLiqUnlockTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Check if liquidity lock is claimable
export function isLiqClaimable(lock: LiquidityLock): boolean {
  if (lock.status !== LIQ_LOCK_STATUS.FUNDED) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= lock.unlock_time;
}

// Get time remaining until unlock
export function getLiqTimeRemaining(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;

  if (diff <= 0) return "Unlocked";

  const days = Math.floor(diff / (60 * 60 * 24));
  const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Get display status for a liquidity lock
export function getLiqLockStatus(lock: LiquidityLock): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  if (lock.status === LIQ_LOCK_STATUS.WITHDRAWN) {
    return { label: "Claimed", variant: "secondary" };
  }
  if (lock.status === LIQ_LOCK_STATUS.CREATED) {
    return { label: "Awaiting Deposit", variant: "outline" };
  }
  if (isLiqClaimable(lock)) {
    return { label: "Claimable", variant: "default" };
  }
  return { label: "Locked", variant: "outline" };
}

// Get DEX display name
export function getDexDisplayName(dex: string): string {
  switch (dex) {
    case DEX.DEFIBOX:
      return "Defibox";
    case DEX.TACO:
      return "TacoSwap";
    default:
      return dex;
  }
}
