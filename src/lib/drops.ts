import { NFTHIVE_CONFIG } from './waxConfig';
import { getTokenConfig, formatTokenAmount, getSettlementSymbol, WAX_TOKENS } from './tokenRegistry';

export type DropType = 'mint-on-demand' | 'premint';

export interface TokenBacking {
  symbol: string;
  amount: string;
}

export interface PriceOption {
  token: string;
  amount: number;
}

export interface DropFormData {
  dropType: DropType;
  collectionName: string;
  templateId: string;
  name: string;
  description: string;
  prices: PriceOption[];
  maxClaimable: number;
  accountLimit: number;
  startTime: Date;
  endTime: Date;
  isHidden: boolean;
  priceRecipient: string;
  // Pre-mint specific
  assetIds: string[];
  // Token backing
  tokensToBack: TokenBacking[];
}

export interface PriceRecipient {
  account: string;
  share: number;
}

// Re-export for convenience
export { WAX_TOKENS, getTokenConfig } from './tokenRegistry';

/**
 * Build the boost action for nft.hive contract
 * This reserves RAM for mint-on-demand drops
 * Required before createdrop action
 */
export function buildBoostAction(account: string) {
  return {
    account: NFTHIVE_CONFIG.boostContract,
    name: 'boost',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      booster: account,
    },
  };
}

/**
 * Build transfer action to deposit NFTs to nfthivedrops for pre-mint drops
 */
export function buildTransferAction(account: string, assetIds: string[]) {
  return {
    account: 'atomicassets',
    name: 'transfer',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      from: account,
      to: NFTHIVE_CONFIG.dropContract,
      asset_ids: assetIds,
      memo: 'deposit',
    },
  };
}

/**
 * Build the createdrop action for nfthivedrops contract
 * Based on transaction: 2961df8064cb302b47751d7e5f7bf4cf2b62d00f0036249a8fca9a8e36366783
 */
export function buildCreateDropAction(
  account: string,
  data: DropFormData
) {
  // Build listing prices from all price options
  const listingPrices = data.prices
    .filter(p => p.amount > 0)
    .map(p => formatTokenAmount(p.amount, p.token));
  
  // Settlement symbol uses the first (primary) token
  const primaryPrice = data.prices[0];
  const settlementSymbol = getSettlementSymbol(primaryPrice.token);
  
  const priceRecipients: PriceRecipient[] = [
    { 
      account: data.priceRecipient || account, 
      share: 1 
    }
  ];

  // For pre-mint drops: assets_to_mint is empty (NFTs already transferred)
  // For mint-on-demand: assets_to_mint contains the template info as an object
  const isPremint = data.dropType === 'premint';
  const templateId = isPremint ? -1 : parseInt(data.templateId);
  
  // Format tokens_to_back from form data
  const tokensToBack = data.tokensToBack
    .filter(t => t.symbol && t.amount && parseFloat(t.amount) > 0)
    .map(t => {
      const config = getTokenConfig(t.symbol);
      if (!config) throw new Error(`Unknown token: ${t.symbol}`);
      return {
        token_contract: config.contract,
        token_symbol: `${config.precision},${t.symbol}`,
        token_amount: formatTokenAmount(parseFloat(t.amount), t.symbol)
      };
    });

  // Build assets_to_mint with nested template info for mint-on-demand
  const assetsToMint = isPremint 
    ? [] 
    : [{ 
        template_id: templateId,
        pool_id: 0,
        tokens_to_back: tokensToBack
      }];

  // Debug logging to verify action structure
  console.log('🧀 Building drop action:', {
    dropType: data.dropType,
    templateId,
    collectionName: data.collectionName,
    isPremint,
    assetsToMint,
    tokensToBack,
    prices: listingPrices,
  });

  return {
    account: NFTHIVE_CONFIG.dropContract,
    name: 'createdrop',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      authorized_account: account,
      collection_name: data.collectionName,
      assets_to_mint: assetsToMint,
      listing_prices: listingPrices,
      settlement_symbol: settlementSymbol,
      price_recipients: priceRecipients,
      auth_required: false,
      max_claimable: data.maxClaimable,
      account_limit: data.accountLimit,
      account_limit_cooldown: 0,
      start_time: Math.floor(data.startTime.getTime() / 1000),
      end_time: Math.floor(data.endTime.getTime() / 1000),
      display_data: JSON.stringify({
        name: data.name,
        description: data.description,
      }),
      is_hidden: data.isHidden,
    },
  };
}

/**
 * Build all actions needed for a complete drop creation
 * - Mint-on-demand: boost + createdrop
 * - Pre-mint: transfer + createdrop
 */
export function buildDropCreationActions(
  account: string,
  data: DropFormData
) {
  if (data.dropType === 'premint') {
    return [
      buildTransferAction(account, data.assetIds), // Action 1: Transfer NFTs to contract
      buildCreateDropAction(account, data)          // Action 2: Create drop
    ];
  }
  
  return [
    buildBoostAction(account),           // Action 1: Reserve RAM
    buildCreateDropAction(account, data) // Action 2: Create drop
  ];
}

/**
 * Validate drop form data before submission
 */
export function validateDropFormData(data: DropFormData): string | null {
  if (!data.collectionName.trim()) {
    return 'Collection name is required';
  }
  
  // Template ID only required for mint-on-demand
  if (data.dropType === 'mint-on-demand') {
    if (!data.templateId.trim()) {
      return 'Template ID is required for mint-on-demand drops';
    }
    
    const templateIdNum = parseInt(data.templateId);
    if (isNaN(templateIdNum) || templateIdNum <= 0) {
      return 'Template ID must be a positive number';
    }
  }
  
  // Asset IDs required for pre-mint
  if (data.dropType === 'premint') {
    if (!data.assetIds || data.assetIds.length === 0) {
      return 'Please select at least one NFT for pre-mint drop';
    }
  }
  
  if (!data.name.trim()) {
    return 'Drop name is required';
  }
  
  if (!data.prices || data.prices.length === 0) {
    return 'At least one price is required';
  }
  
  const validPrices = data.prices.filter(p => p.amount > 0);
  if (validPrices.length === 0) {
    return 'At least one price must be greater than 0';
  }
  
  // Validate each price has a valid token
  for (const price of validPrices) {
    const config = getTokenConfig(price.token);
    if (!config) {
      return `Unknown token: ${price.token}`;
    }
  }
  
  if (data.maxClaimable <= 0) {
    return 'Max claimable must be greater than 0';
  }
  
  if (data.accountLimit <= 0) {
    return 'Account limit must be greater than 0';
  }
  
  if (data.startTime >= data.endTime) {
    return 'End time must be after start time';
  }
  
  if (data.priceRecipient && !/^[a-z1-5.]{1,12}$/.test(data.priceRecipient)) {
    return 'Invalid price recipient account name';
  }
  
  return null;
}
