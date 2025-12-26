// CHEESE Token Stats Fetching Utilities
import { CHEESE_CONFIG } from './waxConfig';

// WAX API endpoints for fallback
const WAX_API_ENDPOINTS = [
  'https://wax.greymass.com',
  'https://api.wax.alohaeos.com',
  'https://wax.eosrio.io',
  'https://api.waxsweden.org',
];

// WaxDAO locker contract
const WAXDAO_LOCKER = 'waxdaolocker';

interface TokenStat {
  supply: string;
  max_supply: string;
  issuer: string;
}

interface AccountPermission {
  perm_name: string;
  parent: string;
  required_auth: {
    threshold: number;
    keys: Array<{ key: string; weight: number }>;
    accounts: Array<{ permission: { actor: string; permission: string }; weight: number }>;
    waits: Array<{ wait_sec: number; weight: number }>;
  };
}

interface AccountInfo {
  account_name: string;
  permissions: AccountPermission[];
}

interface TokenLock {
  ID: number;
  creator: string;
  receiver: string;
  amount: string;
  token_contract: string;
  status: number; // 1 = funded/active
  unlock_time: number; // Unix timestamp
}

export interface NextUnlock {
  year: number;
  amount: number;
}

export interface CheeseStats {
  totalSupply: number;
  circulatingSupply: number;
  maxSupply: number;
  lockedSupply: number;
  isNulled: boolean;
  ownerNulled: boolean;
  activeNulled: boolean;
  status: 'Immutable' | 'Active';
  issuer: string;
  nextUnlock: NextUnlock | null;
}

// Fetch token stats from the stat table
async function fetchTokenStats(): Promise<TokenStat | null> {
  for (const endpoint of WAX_API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: CHEESE_CONFIG.tokenContract,
          scope: CHEESE_CONFIG.tokenSymbol,
          table: 'stat',
          json: true,
          limit: 1,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        return data.rows[0] as TokenStat;
      }
    } catch (error) {
      console.warn(`Failed to fetch token stats from ${endpoint}:`, error);
    }
  }
  return null;
}

// Check if a permission is nulled (set to eosio.null)
function isPermissionNulled(permission: AccountPermission): boolean {
  const auth = permission.required_auth;
  
  // Check if there are no keys
  if (auth.keys.length > 0) return false;
  
  // Check if there's only one account authority pointing to eosio.null
  if (auth.accounts.length === 1) {
    const account = auth.accounts[0];
    return account.permission.actor === 'eosio.null';
  }
  
  return false;
}

// Fetch account info to check if contract is nulled
async function fetchAccountInfo(accountName: string): Promise<AccountInfo | null> {
  for (const endpoint of WAX_API_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1/chain/get_account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: accountName,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      return data as AccountInfo;
    } catch (error) {
      console.warn(`Failed to fetch account info from ${endpoint}:`, error);
    }
  }
  return null;
}

// Parse token amount string (e.g., "888888888888.0000 CHEESE") to number
function parseTokenAmount(amountStr: string): number {
  const parts = amountStr.split(' ');
  if (parts.length < 1) return 0;
  return parseFloat(parts[0]);
}

// Fetch locked CHEESE from waxdaolocker contract
async function fetchLockedCheese(): Promise<{ lockedAmount: number; nextUnlock: NextUnlock | null }> {
  const now = Math.floor(Date.now() / 1000);
  
  for (const endpoint of WAX_API_ENDPOINTS) {
    try {
      let lockedAmount = 0;
      let nextUnlock: NextUnlock | null = null;
      let more = true;
      let lowerBound = '';
      
      // Paginate through all locks
      while (more) {
        const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: WAXDAO_LOCKER,
            scope: WAXDAO_LOCKER,
            table: 'locks',
            json: true,
            limit: 1000,
            lower_bound: lowerBound,
          }),
        });

        if (!response.ok) break;

        const data = await response.json();
        const locks = data.rows as TokenLock[];
        
        // Sum up CHEESE locks that are funded (status = 1)
        for (const lock of locks) {
          if (lock.token_contract === CHEESE_CONFIG.tokenContract && lock.status === 1) {
            const amount = parseTokenAmount(lock.amount);
            lockedAmount += amount;
            
            // Find the next unlock (unlock_time in the future, closest to now)
            if (lock.unlock_time > now) {
              const unlockYear = new Date(lock.unlock_time * 1000).getFullYear();
              
              if (!nextUnlock || lock.unlock_time < nextUnlock.year) {
                // Store the timestamp temporarily in year field to compare
                nextUnlock = { year: lock.unlock_time, amount };
              } else if (lock.unlock_time === nextUnlock.year) {
                // Same unlock time, accumulate amount
                nextUnlock.amount += amount;
              }
            }
          }
        }
        
        more = data.more;
        if (more && locks.length > 0) {
          lowerBound = String(locks[locks.length - 1].ID + 1);
        }
      }
      
      // Convert timestamp to year
      if (nextUnlock) {
        nextUnlock.year = new Date(nextUnlock.year * 1000).getFullYear();
      }
      
      return { lockedAmount, nextUnlock };
    } catch (error) {
      console.warn(`Failed to fetch locked CHEESE from ${endpoint}:`, error);
    }
  }
  return { lockedAmount: 0, nextUnlock: null };
}

// Get combined CHEESE stats
export async function getCheeseStats(): Promise<CheeseStats> {
  // Fetch all in parallel
  const [tokenStats, accountInfo, lockedData] = await Promise.all([
    fetchTokenStats(),
    fetchAccountInfo(CHEESE_CONFIG.tokenContract),
    fetchLockedCheese(),
  ]);

  // Default values
  let totalSupply = 0;
  let maxSupply = 0;
  let circulatingSupply = 0;
  let issuer = '';
  let ownerNulled = false;
  let activeNulled = false;

  // Parse token stats
  if (tokenStats) {
    totalSupply = parseTokenAmount(tokenStats.supply);
    maxSupply = parseTokenAmount(tokenStats.max_supply);
    circulatingSupply = totalSupply; // For now, assume all supply is circulating
    issuer = tokenStats.issuer;
  }

  // Check if contract permissions are nulled
  if (accountInfo) {
    for (const perm of accountInfo.permissions) {
      if (perm.perm_name === 'owner') {
        ownerNulled = isPermissionNulled(perm);
      } else if (perm.perm_name === 'active') {
        activeNulled = isPermissionNulled(perm);
      }
    }
  }

  const isNulled = ownerNulled && activeNulled;

  return {
    totalSupply,
    circulatingSupply,
    maxSupply,
    lockedSupply: lockedData.lockedAmount,
    isNulled,
    ownerNulled,
    activeNulled,
    status: isNulled ? 'Immutable' : 'Active',
    issuer,
    nextUnlock: lockedData.nextUnlock,
  };
}
