import { NFTHIVE_CONFIG, CHEESE_CONFIG } from './waxConfig';

export type DropType = 'mint-on-demand' | 'premint';

export interface DropFormData {
  dropType: DropType;
  collectionName: string;
  templateId: string;
  name: string;
  description: string;
  price: number;
  maxClaimable: number;
  accountLimit: number;
  startTime: Date;
  endTime: Date;
  isHidden: boolean;
  priceRecipient: string;
  // Pre-mint specific
  assetIds: string[];
}

export interface PriceRecipient {
  account: string;
  share: number;
}

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
  const listingPrice = `${data.price.toFixed(CHEESE_CONFIG.tokenPrecision)} ${CHEESE_CONFIG.tokenSymbol}`;
  const settlementSymbol = `${CHEESE_CONFIG.tokenPrecision},${CHEESE_CONFIG.tokenSymbol}`;
  
  const priceRecipients: PriceRecipient[] = [
    { 
      account: data.priceRecipient || account, 
      share: 1 
    }
  ];

  // For pre-mint drops: template_id = -1, assets_to_mint contains the asset IDs
  // For mint-on-demand: template_id = actual ID, assets_to_mint is empty
  const isPremint = data.dropType === 'premint';
  const templateId = isPremint ? -1 : parseInt(data.templateId);
  const assetsToMint = isPremint ? data.assetIds : [];

  return {
    account: NFTHIVE_CONFIG.dropContract,
    name: 'createdrop',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      authorized_account: account,
      collection_name: data.collectionName,
      template_id: templateId,
      listing_prices: [listingPrice],
      settlement_symbol: settlementSymbol,
      price_recipients: priceRecipients,
      max_claimable: data.maxClaimable,
      account_limit: data.accountLimit,
      account_limit_cooldown: 0,
      start_time: Math.floor(data.startTime.getTime() / 1000),
      end_time: Math.floor(data.endTime.getTime() / 1000),
      display_data: JSON.stringify({
        name: data.name,
        description: data.description,
      }),
      is_hidden: data.isHidden ? 1 : 0,
      auth_required: 0,
      pool_id: 0,
      assets_to_mint: assetsToMint,
      tokens_to_back: [],
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
  
  if (data.price <= 0) {
    return 'Price must be greater than 0';
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
