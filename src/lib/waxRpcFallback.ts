// WAX RPC API fallback utility for reliability
// Automatically retries requests across multiple endpoints

// Hyperion endpoints for get_tokens (faster for balance queries)
const HYPERION_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
  "https://wax.eosphere.io",
  "https://wax.pink.gg",
];

export const WAX_RPC_ENDPOINTS = [
  "https://wax.eosusa.io",
  "https://api.wax.alohaeos.com",
  "https://wax.eosphere.io",
  "https://wax.pink.gg",
  "https://api.waxsweden.org",
  "https://wax.greymass.com",
];

interface TableRowsParams {
  json?: boolean;
  code: string;
  scope: string;
  table: string;
  limit?: number;
  lower_bound?: string;
  upper_bound?: string;
  index_position?: number;
  key_type?: string;
  reverse?: boolean;
}

interface TableRowsResponse<T = Record<string, unknown>> {
  rows: T[];
  more: boolean;
  next_key?: string;
}

/**
 * Fetch table rows from WAX blockchain with automatic endpoint fallback
 */
export async function fetchTableRows<T = Record<string, unknown>>(
  params: TableRowsParams,
  timeout: number = 8000
): Promise<TableRowsResponse<T>> {
  let lastError: Error | null = null;

  for (const baseUrl of WAX_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          ...params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data as TableRowsResponse<T>;
      }

      console.warn(`WAX endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`WAX endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All WAX RPC endpoints failed");
}

/**
 * Generic WAX RPC call with fallback
 * For get_currency_balance, a 400 error means the contract doesn't exist - return empty array
 */
export async function waxRpcCall<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  timeout: number = 8000
): Promise<T> {
  let lastError: Error | null = null;

  for (const baseUrl of WAX_RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // For get_currency_balance, 400/500 with account_query_exception means contract doesn't exist
      // Return empty array instead of retrying - this is a valid response
      if (path === '/v1/chain/get_currency_balance' && (response.status === 400 || response.status === 500)) {
        return [] as T;
      }

      console.warn(`WAX endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`WAX endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All WAX RPC endpoints failed");
}

// Hyperion API types
export interface HyperionToken {
  symbol: string;
  amount: number;
  contract: string;
  precision?: number;
}

interface HyperionTokensResponse {
  account: string;
  tokens: HyperionToken[];
}

/**
 * Fetch ALL token balances for an account using Hyperion API
 * This is much faster than querying each contract individually
 */
export async function fetchAllTokenBalances(
  account: string,
  timeout: number = 8000
): Promise<HyperionToken[]> {
  let lastError: Error | null = null;

  for (const baseUrl of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `${baseUrl}/v2/state/get_tokens?account=${account}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as HyperionTokensResponse;
        console.log(`[Hyperion] Got ${data.tokens?.length || 0} tokens from ${baseUrl}`);
        return data.tokens || [];
      }

      console.warn(`Hyperion endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Hyperion endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  throw lastError || new Error("All Hyperion endpoints failed");
}

/**
 * Fetch a single token balance using get_currency_balance
 * Used as fallback for critical tokens that may be missing from Hyperion
 */
export async function fetchSingleTokenBalance(
  account: string,
  contract: string,
  symbol: string,
  timeout: number = 5000
): Promise<number> {
  try {
    const balances = await waxRpcCall<string[]>(
      '/v1/chain/get_currency_balance',
      { code: contract, account, symbol },
      timeout
    );
    
    console.log(`[Fallback] ${symbol}@${contract} response:`, balances);
    
    if (balances && balances.length > 0) {
      // Parse "123.45678900 CHEESE" format
      const parts = balances[0].split(' ');
      const amount = parseFloat(parts[0]) || 0;
      console.log(`[Fallback] ${symbol} balance: ${amount}`);
      return amount;
    }
    console.log(`[Fallback] ${symbol} returned empty array`);
  } catch (error) {
    console.warn(`[Fallback] Failed to fetch ${symbol} balance:`, error);
  }
  return 0;
}

// ============================================
// HYPERION ACCOUNT DATA (Unified fetch)
// ============================================

export interface SelfDelegatedBandwidth {
  from: string;
  to: string;
  net_weight: string;
  cpu_weight: string;
}

export interface VoterInfo {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
  flags1: number;
  reserved2: number;
  reserved3: string;
  unpaid_voteshare: string;
  unpaid_voteshare_last_updated: number;
  unpaid_voteshare_change_rate: string;
}

export interface RefundRequest {
  owner: string;
  request_time: string;
  net_amount: string;
  cpu_amount: string;
}

export interface HyperionAccountData {
  account_name: string;
  ram_quota: number;
  ram_usage: number;
  net_limit: { used: number; max: number; available: number };
  cpu_limit: { used: number; max: number; available: number };
  core_liquid_balance?: string;
  self_delegated_bandwidth?: SelfDelegatedBandwidth;
  voter_info?: VoterInfo;
  refund_request?: RefundRequest;
}

/**
 * Fetch comprehensive account data using Hyperion API
 * Returns RAM, CPU, NET, staked resources, voter info, and refunds in a single call
 */
export async function fetchAccountData(
  account: string,
  timeout: number = 8000
): Promise<HyperionAccountData> {
  let lastError: Error | null = null;

  for (const baseUrl of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `${baseUrl}/v2/state/get_account?account=${account}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log(`[Hyperion] Got account data from ${baseUrl}`);
        return data.account || data;
      }

      console.warn(`Hyperion endpoint ${baseUrl} returned ${response.status}, trying next...`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Hyperion endpoint ${baseUrl} failed:`, (error as Error).message);
    }
  }

  // Fallback to standard RPC if Hyperion fails
  console.log("[Hyperion] All Hyperion endpoints failed, falling back to RPC...");
  return fetchAccountDataRpc(account, timeout);
}

/**
 * Fallback: Fetch account data using standard RPC
 */
async function fetchAccountDataRpc(
  account: string,
  timeout: number = 8000
): Promise<HyperionAccountData> {
  const data = await waxRpcCall<HyperionAccountData>(
    '/v1/chain/get_account',
    { account_name: account },
    timeout
  );
  return data;
}

// ============================================
// GLOBAL STATE FOR VOTE REWARDS
// ============================================

export interface GlobalState {
  total_unpaid_voteshare: string;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare_last_updated: string;
  voters_bucket: string;
  pervote_bucket: number;
  total_activated_stake: string;
  last_pervote_bucket_fill: string;
}

/**
 * Fetch global state for vote reward calculation
 */
export async function fetchGlobalState(
  timeout: number = 8000
): Promise<GlobalState | null> {
  try {
    // Try global4 first
    const data = await fetchTableRows<GlobalState>({
      code: 'eosio',
      scope: 'eosio',
      table: 'global4',
      limit: 1,
    }, timeout);
    
    if (data.rows && data.rows.length > 0) {
      return data.rows[0];
    }
  } catch (e) {
    console.log('[GlobalState] global4 failed, trying global...');
  }

  try {
    // Fallback to global table
    const data = await fetchTableRows<GlobalState>({
      code: 'eosio',
      scope: 'eosio',
      table: 'global',
      limit: 1,
    }, timeout);
    
    if (data.rows && data.rows.length > 0) {
      return data.rows[0];
    }
  } catch (e) {
    console.log('[GlobalState] global fetch also failed');
  }

  return null;
}
