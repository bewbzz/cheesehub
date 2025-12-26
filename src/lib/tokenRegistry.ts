// WAX Token Registry - All tokens supported by NFTHive drops
// Based on nfthivedrops contract supported tokens

export interface TokenConfig {
  symbol: string;
  contract: string;
  precision: number;
  displayName: string;
  logo?: string;
}

// Token registry with all supported WAX tokens from NFTHive
export const WAX_TOKENS: TokenConfig[] = [
  { symbol: 'WAX', contract: 'eosio.token', precision: 8, displayName: 'WAX' },
  { symbol: 'CHEESE', contract: 'cheeseburger', precision: 4, displayName: 'CHEESE' },
  { symbol: 'AQUA', contract: 'aquariuswax1', precision: 4, displayName: 'AQUA' },
  { symbol: 'HONEY', contract: 'hloweentoken', precision: 4, displayName: 'HONEY' },
  { symbol: 'AETHER', contract: 'aabormarket', precision: 8, displayName: 'AETHER' },
  { symbol: 'MORBS', contract: 'morbsbycraft', precision: 4, displayName: 'MORBS' },
  { symbol: 'LEEF', contract: 'leeftokeneth', precision: 8, displayName: 'LEEF' },
  { symbol: 'DHC', contract: 'cyphertokens', precision: 4, displayName: 'DHC' },
  { symbol: 'SHING', contract: 'shingtoken11', precision: 8, displayName: 'SHING' },
  { symbol: 'ZOMB', contract: 'darkcntrytkn', precision: 4, displayName: 'ZOMB' },
  { symbol: 'OMNI', contract: 'futlooptoken', precision: 4, displayName: 'OMNI' },
  { symbol: 'BROKE', contract: 'crptobrokers', precision: 8, displayName: 'BROKE' },
  { symbol: 'STREAM', contract: 'streamtokens', precision: 8, displayName: 'STREAM' },
  { symbol: 'WNG', contract: 'wikibldiogft', precision: 0, displayName: 'WNG' },
  { symbol: 'GOLD', contract: 'nftpandaboxx', precision: 4, displayName: 'GOLD' },
  { symbol: 'LIMBO', contract: 'limaborazor1', precision: 4, displayName: 'LIMBO' },
  { symbol: 'WXBOOTY', contract: 'thepiratexon', precision: 8, displayName: 'WXBOOTY' },
  { symbol: 'KCHAT', contract: 'kitechatmvp1', precision: 4, displayName: 'KCHAT' },
  { symbol: 'KPOINT', contract: 'kitechatmvp1', precision: 4, displayName: 'KPOINT' },
  { symbol: 'SSN', contract: 'wax.gg', precision: 4, displayName: 'SSN' },
  { symbol: 'BJ', contract: 'blackjacktkn', precision: 4, displayName: 'BJ' },
  { symbol: 'FOOD', contract: 'pixelyomifun', precision: 4, displayName: 'FOOD' },
  { symbol: 'QUAX', contract: 'quaxwaxtokn1', precision: 8, displayName: 'QUAX' },
  { symbol: 'HOUSE', contract: 'wax.gg', precision: 4, displayName: 'HOUSE' },
  { symbol: 'AMG', contract: 'aliencoinwax', precision: 4, displayName: 'AMG' },
  { symbol: 'NEFTY', contract: 'neftycoinhub', precision: 8, displayName: 'NEFTY' },
  { symbol: 'GUILD', contract: 'guildstoken', precision: 4, displayName: 'GUILD' },
  { symbol: 'AWC', contract: 'alienworldsc', precision: 4, displayName: 'AWC' },
  { symbol: 'TLM', contract: 'alien.worlds', precision: 4, displayName: 'TLM' },
  { symbol: 'DUST', contract: 'nftmintt.wax', precision: 4, displayName: 'DUST' },
  { symbol: 'VOID', contract: 'voidiomtoken', precision: 8, displayName: 'VOID' },
  { symbol: 'WOMBAT', contract: 'wombatitoken', precision: 4, displayName: 'WOMBAT' },
  { symbol: 'LSWAX', contract: 'dlogstoken11', precision: 8, displayName: 'LSWAX' },
  { symbol: 'CMX', contract: 'cmxtokenswap', precision: 8, displayName: 'CMX' },
  { symbol: 'BRWL', contract: 'brawlertokns', precision: 4, displayName: 'BRWL' },
  { symbol: 'CROWN', contract: 'crownedtokns', precision: 4, displayName: 'CROWN' },
  { symbol: 'MARTIA', contract: 'martiainvad1', precision: 4, displayName: 'MARTIA' },
  { symbol: 'CAIT', contract: 'caittoken111', precision: 4, displayName: 'CAIT' },
  { symbol: 'NEON', contract: 'neonstoicwax', precision: 8, displayName: 'NEON' },
  { symbol: 'WUFFI', contract: 'wuffi', precision: 8, displayName: 'WUFFI' },
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
