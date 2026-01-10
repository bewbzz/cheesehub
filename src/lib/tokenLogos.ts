// Token logo URL utilities using Alcor Exchange's token logo repository

const ALCOR_LOGO_BASE = 'https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax';

/**
 * Mapping of token symbols to their Alcor contract (for logo lookup)
 * Alcor uses different contracts than NFTHive for some tokens
 */
const ALCOR_CONTRACT_MAP: Record<string, string> = {
  // Main tokens
  'WAX': 'eosio.token',
  'CHEESE': 'cheeseburger',
  'LSWAX': 'token.lswax',
  'LSW': 'token.lswax',
  'TLM': 'alien.worlds',
  'WUFFI': 'wuffi',
  'NEFTY': 'neftyblocksd',
  'TACO': 't.taco',
  'DUST': 'niftywizards',
  'AETHER': 'e.rplanet',
  'VOID': 'onessusonwax',
  'WOMBAT': 'wombatitoken',
  'CAIT': 'tokencrafter',
  'ZOMB': 'zombietokens',
  'GOLD': 'goldgoldgold',
  'STEAK': 'token.steak',
  'LEEF': 'leefmaincorp',
  'GUILD': 'guildstoken',
  'BRWL': 'brawlertokns',
  'CROWN': 'crownedtokns',
  'MARTIA': 'martiainvad1',
  'CMX': 'cmxtokenswap',
  'NEON': 'neonstoicwax',
  'AWC': 'alien.worlds',
  // Wrapped tokens
  'WAXUSDT': 'eth.token',
  'WAXUSDC': 'eth.token',
  'WAXWETH': 'eth.token',
  'WAXWBTC': 'eth.token',
  // Other tokens
  'BET': 'betdividends',
  'KARMA': 'theonlykarma',
  'PGL': 'prospectorsw',
  'PURPLE': 'purplepurple',
  'GEM': 'gems.tycoon',
  'KOALA': 'appsbmtokens',
  'BITS': 'extexplorers',
  'PIXEL': 'penguincoins',
  'TOCIUM': 'toc.century',
  'CPR': 'coin.pirates',
  'MST': 'metatoken.gm',
  'SHELL': 'token.gr',
  'ART': 'goldarttoken',
  'GLITCH': 'gamingtokens',
  'BJ': 'blowjobtoken',
  'GNOKEN': 'gnokentokens',
  'FWF': 'farmerstoken',
  'FWG': 'farmerstoken',
  'FWW': 'farmerstoken',
  'KBUCKS': 'kolobokbucks',
  'BLUX': 'bluxbluxblux',
  'SHING': 'shinglestest',
  'WPS': 'waboratiogov',
};

/**
 * Get the token logo URL from Alcor's repository
 * Format: https://raw.githubusercontent.com/alcorexchange/alcor-ui/master/assets/tokens/wax/{symbol_lowercase}_{contract}.png
 */
export function getTokenLogoUrl(contract: string, symbol: string): string {
  // Use Alcor's contract mapping if available, otherwise use the provided contract
  // If contract is empty/undefined, we MUST use the mapping or return placeholder
  const alcorContract = ALCOR_CONTRACT_MAP[symbol.toUpperCase()] || contract;
  
  // If we still don't have a valid contract, return the placeholder
  if (!alcorContract) {
    return TOKEN_LOGO_PLACEHOLDER;
  }
  
  return `${ALCOR_LOGO_BASE}/${symbol.toLowerCase()}_${alcorContract}.png`;
}

/**
 * Fallback placeholder for tokens without logos
 */
export const TOKEN_LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODg4ODgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwYXRoIGQ9Ik0xMiA2djEyIi8+PHBhdGggZD0iTTYgMTJoMTIiLz48L3N2Zz4=';
