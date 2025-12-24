import { NFTHIVE_CONFIG, CHEESE_CONFIG } from './waxConfig';

export interface DropFormData {
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
}

export interface PriceRecipient {
  account: string;
  share: number;
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

  return {
    account: NFTHIVE_CONFIG.dropContract,
    name: 'createdrop',
    authorization: [{ actor: account, permission: 'active' }],
    data: {
      authorized_account: account,
      collection_name: data.collectionName,
      template_id: parseInt(data.templateId),
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
      assets_to_mint: [],
      tokens_to_back: [],
    },
  };
}

/**
 * Validate drop form data before submission
 */
export function validateDropFormData(data: DropFormData): string | null {
  if (!data.collectionName.trim()) {
    return 'Collection name is required';
  }
  
  if (!data.templateId.trim()) {
    return 'Template ID is required';
  }
  
  const templateIdNum = parseInt(data.templateId);
  if (isNaN(templateIdNum) || templateIdNum <= 0) {
    return 'Template ID must be a positive number';
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
