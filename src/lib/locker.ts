import { fetchTable, WAXDAO_CONTRACT } from "@/lib/wax";

// Actual table structure from WaxDAO locker contract
export interface TokenLock {
  ID: number;
  creator: string;
  receiver: string;
  amount: string;  // e.g., "100.0000 WAX"
  token_contract: string;
  time_of_creation: number;  // Unix timestamp
  time_of_deposit: number;   // Unix timestamp
  unlock_time: number;       // Unix timestamp
  status: number;            // 0 = locked, 1 = claimed
}

// Fetch locks for a specific user (by receiver - the person who can claim)
export async function fetchUserLocks(account: string): Promise<TokenLock[]> {
  try {
    // Use receiver index (index_position 3) to find locks claimable by this user
    const locks = await fetchTable<TokenLock>(
      WAXDAO_CONTRACT,
      WAXDAO_CONTRACT,
      "locks",
      {
        lower_bound: account,
        upper_bound: account,
        key_type: "name",
        index_position: 3, // receiver index
        limit: 100,
      }
    );
    
    console.log("Raw locks data:", locks);
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

// Format unlock time from Unix timestamp
export function formatUnlockTime(timestamp: number): string {
  const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
  return date.toLocaleString();
}

// Check if lock is claimable
export function isClaimable(lock: TokenLock): boolean {
  if (lock.status === 1) return false; // Already claimed
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  return now >= lock.unlock_time;
}

// Get time remaining until unlock
export function getTimeRemaining(timestamp: number): string {
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
