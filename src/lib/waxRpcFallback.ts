// WAX RPC API fallback utility for reliability
// Automatically retries requests across multiple endpoints

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
