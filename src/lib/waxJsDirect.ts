/**
 * Direct WaxJS integration for Cloud Wallet transactions.
 * This bypasses the WharfKit plugin which has signature application bugs.
 * 
 * Used only for .wam accounts - Anchor users continue using WharfKit.
 */

import * as waxjs from '@waxio/waxjs/dist';

// Primary and fallback RPC endpoints
const RPC_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
  'https://wax.cryptolions.io',
  'https://wax.eu.eosamsterdam.net',
];

let waxInstance: waxjs.WaxJS | null = null;
let currentEndpointIndex = 0;

/**
 * Get or create the WaxJS instance.
 * Reuses the same instance to maintain login state.
 */
export function getWaxJS(): waxjs.WaxJS {
  if (!waxInstance) {
    waxInstance = new waxjs.WaxJS({
      rpcEndpoint: RPC_ENDPOINTS[currentEndpointIndex],
      tryAutoLogin: false, // Don't auto-login, we'll handle it explicitly
    });
  }
  return waxInstance;
}

/**
 * Login via Cloud Wallet popup.
 * Returns the account name on success.
 */
export async function loginWithCloudWallet(): Promise<string> {
  const wax = getWaxJS();
  const userAccount = await wax.login();
  console.log('[WaxJS Direct] Logged in as:', userAccount);
  return userAccount;
}

/**
 * Check if user is logged in to Cloud Wallet.
 */
export function isCloudWalletLoggedIn(): boolean {
  const wax = getWaxJS();
  return !!wax.userAccount;
}

/**
 * Get the logged-in account name.
 */
export function getCloudWalletAccount(): string | null {
  const wax = getWaxJS();
  return wax.userAccount || null;
}

/**
 * Get the WaxJS api object for DIRECT transaction calls.
 * IMPORTANT: For Cloud Wallet popups to work, api.transact() MUST be 
 * called as the IMMEDIATE first async operation after a user click.
 * Any intermediate function calls or state updates break the gesture chain.
 */
export function getWaxApi(): typeof waxjs.WaxJS.prototype.api {
  const wax = getWaxJS();
  if (!wax.api) {
    throw new Error('Cloud Wallet not initialized - please login first');
  }
  return wax.api;
}

/**
 * Execute a transaction via Cloud Wallet.
 * NOTE: This wrapper adds function call depth which can break user gesture
 * chain for popup-based signing. For UI button handlers, prefer calling
 * getWaxApi().transact() directly instead.
 */
export async function transactWithCloudWallet(
  actions: Array<{
    account: string;
    name: string;
    authorization: Array<{ actor: string; permission: string }>;
    data: Record<string, unknown>;
  }>
): Promise<{ transaction_id: string }> {
  const wax = getWaxJS();
  
  // Ensure user is logged in
  if (!wax.userAccount) {
    console.log('[WaxJS Direct] Not logged in, triggering login...');
    await wax.login();
  }
  
  console.log('[WaxJS Direct] Executing transaction with actions:', actions);
  
  try {
    const result = await wax.api.transact(
      { actions },
      {
        blocksBehind: 3,
        expireSeconds: 1200,
      }
    );
    
    console.log('[WaxJS Direct] Transaction successful:', result);
    // Extract transaction_id from the result - type varies based on response
    const txResult = result as { transaction_id?: string; processed?: { id?: string } };
    return { transaction_id: txResult.transaction_id || txResult.processed?.id || '' };
  } catch (error) {
    console.error('[WaxJS Direct] Transaction failed:', error);
    
    // If RPC error, try next endpoint
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout')) {
      currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
      console.log('[WaxJS Direct] Switching to endpoint:', RPC_ENDPOINTS[currentEndpointIndex]);
      
      // Reset instance to use new endpoint
      waxInstance = null;
      throw new Error('Network error - please try again');
    }
    
    throw error;
  }
}

/**
 * Logout from Cloud Wallet.
 */
export function logoutCloudWallet(): void {
  waxInstance = null;
  // Clear any stored session data
  try {
    Object.keys(localStorage)
      .filter(key => key.includes('wax') || key.includes('cloudwallet'))
      .forEach(key => {
        // Don't clear WharfKit keys - those are managed separately
        if (!key.includes('wharfkit')) {
          localStorage.removeItem(key);
        }
      });
  } catch (e) {
    console.error('[WaxJS Direct] Failed to clear storage:', e);
  }
}
