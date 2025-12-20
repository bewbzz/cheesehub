import { fetchTable, WAXDAO_CONTRACT } from "@/lib/wax";

export interface TokenLock {
  lock_id: number;
  owner: string;
  token_contract: string;
  locked_amount: string;
  unlock_time: string;
  is_claimed: boolean;
}

// Fetch locks for a specific user
export async function fetchUserLocks(account: string): Promise<TokenLock[]> {
  try {
    // The locker table uses owner as secondary index
    const locks = await fetchTable<TokenLock>(
      WAXDAO_CONTRACT,
      WAXDAO_CONTRACT,
      "locks",
      {
        lower_bound: account,
        upper_bound: account,
        key_type: "name",
        index_position: 2,
        limit: 100,
      }
    );
    return locks;
  } catch (error) {
    console.error("Failed to fetch locks:", error);
    return [];
  }
}

// Format asset string (e.g., "100.0000 WAX" -> { amount: "100.0000", symbol: "WAX" })
export function parseAsset(asset: string | undefined): { amount: string; symbol: string } {
  if (!asset || typeof asset !== 'string') {
    console.warn("parseAsset received invalid value:", asset);
    return { amount: "0", symbol: "UNKNOWN" };
  }
  const parts = asset.split(" ");
  return { amount: parts[0] || "0", symbol: parts[1] || "UNKNOWN" };
}

// Format unlock time
export function formatUnlockTime(timestamp: string): string {
  const date = new Date(timestamp + "Z");
  return date.toLocaleString();
}

// Check if lock is claimable
export function isClaimable(lock: TokenLock): boolean {
  if (lock.is_claimed) return false;
  const unlockTime = new Date(lock.unlock_time + "Z");
  return new Date() >= unlockTime;
}

// Get time remaining until unlock
export function getTimeRemaining(timestamp: string): string {
  const unlockTime = new Date(timestamp + "Z");
  const now = new Date();
  const diff = unlockTime.getTime() - now.getTime();

  if (diff <= 0) return "Unlocked";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
