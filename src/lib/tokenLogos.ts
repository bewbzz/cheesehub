// Token logo URL utilities using Alcor Exchange's token logo repository

const ALCOR_LOGO_BASE = 'https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax';
const ALCOR_TOKENS_API = 'https://wax.alcor.exchange/api/v2/tokens';

// Cache for token contracts fetched from Alcor API
let tokenContractCache: Map<string, string> = new Map();
let cacheInitialized = false;
let cachePromise: Promise<void> | null = null;

/**
 * Fetch all token contracts from Alcor API and cache them
 * This eliminates the need for manual contract mapping
 */
async function initializeTokenCache(): Promise<void> {
  if (cacheInitialized) return;
  
  // If already fetching, wait for that promise
  if (cachePromise) {
    await cachePromise;
    return;
  }
  
  cachePromise = (async () => {
    try {
      const response = await fetch(ALCOR_TOKENS_API);
      if (!response.ok) {
        console.warn('Failed to fetch Alcor tokens, using fallback map');
        useFallbackMap();
        return;
      }
      
      const tokens = await response.json();
      
      // Build cache from API response
      // Alcor tokens API returns array of { id, contract, symbol, ... }
      if (Array.isArray(tokens)) {
        tokens.forEach((token: { symbol?: string; contract?: string }) => {
          if (token.symbol && token.contract) {
            const key = token.symbol.toUpperCase();
            // Only set if not already set (first occurrence wins, usually the main one)
            if (!tokenContractCache.has(key)) {
              tokenContractCache.set(key, token.contract);
            }
          }
        });
      }
      
      console.log(`Loaded ${tokenContractCache.size} token contracts from Alcor API`);
      cacheInitialized = true;
    } catch (error) {
      console.error('Error fetching Alcor tokens:', error);
      useFallbackMap();
    }
  })();
  
  await cachePromise;
}

/**
 * Fallback mapping for when API fails - kept minimal as backup only
 */
const FALLBACK_CONTRACT_MAP: Record<string, string> = {
  'WAX': 'eosio.token',
  'CHEESE': 'cheeseburger',
  'LSWAX': 'token.fusion',
  'LSW': 'lsw.alcor',
  'TLM': 'alien.worlds',
  'WUFFI': 'wuffi',
  'NEFTY': 'neftyblocksd',
  'TACO': 't.taco',
  'DUST': 'niftywizards',
  'AETHER': 'e.rplanet',
  'VOID': 'onessusonwax',
  'WOMBAT': 'wombatitoken',
  'ROOK': 'pixilminirpg',
  'RUGG': 'rareruggapes',
  'AQUA': 'aquascapeart',
};

function useFallbackMap(): void {
  Object.entries(FALLBACK_CONTRACT_MAP).forEach(([symbol, contract]) => {
    tokenContractCache.set(symbol, contract);
  });
  cacheInitialized = true;
}

/**
 * Get contract for a token symbol (sync version using cache)
 * Returns empty string if not found - caller should use placeholder
 */
export function getTokenContract(symbol: string): string {
  return tokenContractCache.get(symbol.toUpperCase()) || '';
}

/**
 * Ensure token cache is initialized - call this early in app lifecycle
 */
export async function ensureTokenCacheLoaded(): Promise<void> {
  await initializeTokenCache();
}

/**
 * Get the token logo URL from Alcor's repository
 * Format: https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax/{symbol_lowercase}_{contract}.png
 */
export function getTokenLogoUrl(contract: string, symbol: string): string {
  // Try to get contract from cache if not provided
  const resolvedContract = contract || getTokenContract(symbol);
  
  // If we still don't have a valid contract, return the placeholder
  if (!resolvedContract) {
    return TOKEN_LOGO_PLACEHOLDER;
  }
  
  return `${ALCOR_LOGO_BASE}/${symbol.toLowerCase()}_${resolvedContract}.png`;
}

/**
 * Async version that ensures cache is loaded first
 */
export async function getTokenLogoUrlAsync(contract: string, symbol: string): Promise<string> {
  await ensureTokenCacheLoaded();
  return getTokenLogoUrl(contract, symbol);
}

/**
 * Fallback placeholder for tokens without logos
 */
export const TOKEN_LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODg4ODgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik0xMiA2djEyIi8+PHBhdGggZD0iTTYgMTJoMTIiLz48L3N2Zz4=';
