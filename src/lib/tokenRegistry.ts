// WAX Token Registry - All tokens supported by NFTHive drops
// Based on nfthivedrops contract supported tokens

export interface TokenConfig {
  symbol: string;
  contract: string;
  precision: number;
  displayName: string;
  logo?: string;
}

// Token registry with verified WAX tokens
export const WAX_TOKENS: TokenConfig[] = [
  { symbol: 'WAX', contract: 'eosio.token', precision: 8, displayName: 'WAX' },
  { symbol: 'CHEESE', contract: 'cheeseburger', precision: 4, displayName: 'CHEESE' },
  { symbol: 'TLM', contract: 'alien.worlds', precision: 4, displayName: 'TLM' },
  { symbol: 'WUFFI', contract: 'wuffi', precision: 8, displayName: 'WUFFI' },
  { symbol: 'AETHER', contract: 'aabormarket', precision: 8, displayName: 'AETHER' },
  { symbol: 'NEFTY', contract: 'neftycoinhub', precision: 8, displayName: 'NEFTY' },
  { symbol: 'LSWAX', contract: 'token.wax', precision: 8, displayName: 'LSWAX' },
  { symbol: 'BRWL', contract: 'brawlertokns', precision: 4, displayName: 'BRWL' },
  { symbol: 'DUST', contract: 'nftmintt.wax', precision: 4, displayName: 'DUST' },
];

// Get token config by symbol
export function getTokenConfig(symbol: string): TokenConfig | undefined {
  return WAX_TOKENS.find(t => t.symbol === symbol);
}

// Format a price amount for a given token symbol
export function formatTokenAmount(amount: number, symbol: string): string {
  const token = getTokenConfig(symbol);
  if (!token) {
    throw new Error(`Unknown token: ${symbol}`);
  }
  return `${amount.toFixed(token.precision)} ${symbol}`;
}

// Get settlement symbol format (precision,SYMBOL)
export function getSettlementSymbol(symbol: string): string {
  const token = getTokenConfig(symbol);
  if (!token) {
    throw new Error(`Unknown token: ${symbol}`);
  }
  return `${token.precision},${symbol}`;
}

// Parse a listing price string into amount and symbol
export function parseListingPrice(listingPrice: string): { amount: number; symbol: string } | null {
  const match = listingPrice.match(/^([\d.]+)\s+(\w+)$/);
  if (!match) return null;
  return {
    amount: parseFloat(match[1]),
    symbol: match[2],
  };
}

// Get default token (CHEESE)
export function getDefaultToken(): TokenConfig {
  return WAX_TOKENS.find(t => t.symbol === 'CHEESE')!;
}
