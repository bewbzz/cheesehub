/**
 * Token Backing utilities
 * Supports two methods:
 * 1. AtomicAssets native backing (WAX only - whitelisted tokens)
 * 2. WaxDAO packs.waxdao backing (any token including CHEESE)
 */

import { fetchTableRows } from './waxRpcFallback';

// Token presets with correct precision
export const BACKING_TOKENS = {
  CHEESE: {
    contract: 'cheeseburger',
    symbol: 'CHEESE',
    precision: 4,
  },
  WAX: {
    contract: 'eosio.token',
    symbol: 'WAX',
    precision: 8,
  },
} as const;

// WaxDAO backer contract for non-whitelisted token backing
export const WAXDAO_BACKER_CONTRACT = 'waxdaobacker';

export type BackingTokenKey = keyof typeof BACKING_TOKENS;

export interface BackedToken {
  quantity: string;
  token_contract: string;
}

export interface BackedAsset {
  asset_id: string;
  backed_tokens: BackedToken[];
}

export interface BackingConfig {
  tokenKey: BackingTokenKey | 'CUSTOM';
  customContract?: string;
  customSymbol?: string;
  customPrecision?: number;
  amountPerNFT: number;
}

/**
 * Format token amount with correct precision
 */
export function formatTokenAmount(
  amount: number,
  precision: number,
  symbol: string
): string {
  return `${amount.toFixed(precision)} ${symbol}`;
}

/**
 * Get token details from config
 */
export function getTokenDetails(config: BackingConfig): {
  contract: string;
  symbol: string;
  precision: number;
} {
  if (config.tokenKey === 'CUSTOM') {
    return {
      contract: config.customContract || '',
      symbol: config.customSymbol || '',
      precision: config.customPrecision || 4,
    };
  }
  return BACKING_TOKENS[config.tokenKey];
}

/**
 * Fetch backed tokens for an asset from atomicassets
 */
export async function fetchAssetBacking(assetId: string): Promise<BackedToken[]> {
  try {
    const response = await fetchTableRows<{ backed_tokens?: BackedToken[] }>({
      code: 'atomicassets',
      scope: 'atomicassets',
      table: 'assets',
      lower_bound: assetId,
      upper_bound: assetId,
      limit: 1,
    });

    if (response.rows.length > 0 && response.rows[0].backed_tokens) {
      return response.rows[0].backed_tokens;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch asset backing:', error);
    return [];
  }
}

/**
 * Build the actions needed to back NFTs with tokens
 * Transaction flow:
 * 1. announcedepo - Prepare deposit slot for the token symbol
 * 2. transfer - Send tokens to atomicassets with memo "deposit"
 * 3. backasset - Lock tokens from deposit into each NFT using native atomicassets action
 */
export function buildBackNftActions(
  owner: string,
  assetIds: string[],
  config: BackingConfig,
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  const { contract, symbol, precision } = getTokenDetails(config);
  const totalAmount = config.amountPerNFT * assetIds.length;
  const quantity = formatTokenAmount(totalAmount, precision, symbol);
  const perNftQuantity = formatTokenAmount(config.amountPerNFT, precision, symbol);
  
  // Symbol format for announcedepo: "precision,SYMBOL" (e.g., "4,CHEESE" or "8,WAX")
  const symbolToAnnounce = `${precision},${symbol}`;

  const actions = [];

  // 1. Announce deposit for the token symbol (only needed once per token type)
  actions.push({
    account: 'atomicassets',
    name: 'announcedepo',
    authorization: [permissionLevel],
    data: {
      owner,
      symbol_to_announce: symbolToAnnounce,
    },
  });

  // 2. Transfer total tokens to atomicassets with memo "deposit"
  actions.push({
    account: contract,
    name: 'transfer',
    authorization: [permissionLevel],
    data: {
      from: owner,
      to: 'atomicassets',
      quantity,
      memo: 'deposit',
    },
  });

  // 3. Back each NFT using native atomicassets::backasset action
  for (const assetId of assetIds) {
    actions.push({
      account: 'atomicassets',
      name: 'backasset',
      authorization: [permissionLevel],
      data: {
        payer: owner,
        asset_owner: owner,
        asset_id: parseInt(assetId),
        token_to_back: perNftQuantity,
      },
    });
  }

  return actions;
}

/**
 * Build actions to back NFTs via WaxDAO waxdaobacker contract
 * This method works with ANY token (CHEESE, WAX, etc.)
 * 
 * Transaction flow:
 * 1. announcedepo - Prepare deposit slot for the token symbol
 * 2. transfer - Send tokens to waxdaobacker with memo "deposit"
 * 3. backnft - Lock tokens from deposit into each NFT
 */
export function buildWaxdaoBackNftActions(
  owner: string,
  assetIds: string[],
  config: BackingConfig,
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  const { contract, symbol, precision } = getTokenDetails(config);
  const totalAmount = config.amountPerNFT * assetIds.length;
  const totalQuantity = formatTokenAmount(totalAmount, precision, symbol);
  const perNftQuantity = formatTokenAmount(config.amountPerNFT, precision, symbol);

  const actions = [];

  // 1. Announce deposit for the token
  actions.push({
    account: WAXDAO_BACKER_CONTRACT,
    name: 'announcedepo',
    authorization: [permissionLevel],
    data: {
      user: owner,
      tokens: [{
        quantity: totalQuantity,
        token_contract: contract,
      }],
    },
  });

  // 2. Transfer tokens to waxdaobacker with memo "deposit"
  actions.push({
    account: contract,
    name: 'transfer',
    authorization: [permissionLevel],
    data: {
      from: owner,
      to: WAXDAO_BACKER_CONTRACT,
      quantity: totalQuantity,
      memo: 'deposit',
    },
  });

  // 2. Back each NFT using waxdaobacker::backnft
  for (const assetId of assetIds) {
    actions.push({
      account: WAXDAO_BACKER_CONTRACT,
      name: 'backnft',
      authorization: [permissionLevel],
      data: {
        user: owner,
        asset_owner: owner,
        asset_id: parseInt(assetId),
        tokens_to_back: [{
          quantity: perNftQuantity,
          token_contract: contract,
        }],
      },
    });
  }

  return actions;
}

/**
 * Validate backing configuration
 */
export function validateBackingConfig(config: BackingConfig): string | null {
  if (config.amountPerNFT <= 0) {
    return 'Amount per NFT must be greater than 0';
  }

  if (config.tokenKey === 'CUSTOM') {
    if (!config.customContract || config.customContract.length === 0) {
      return 'Token contract is required for custom tokens';
    }
    if (!config.customSymbol || config.customSymbol.length === 0) {
      return 'Token symbol is required for custom tokens';
    }
    if (config.customPrecision === undefined || config.customPrecision < 0 || config.customPrecision > 18) {
      return 'Precision must be between 0 and 18';
    }
  }

  return null;
}

// ============================================================================
// BURN & CLAIM UTILITIES
// ============================================================================

export interface AssetWithBacking {
  asset_id: string;
  name: string;
  collection: string;
  template_id: string;
  image: string;
  backed_tokens: BackedToken[];
}

export interface ParsedToken {
  amount: number;
  symbol: string;
  precision: number;
  contract: string;
}

/**
 * Parse backed token quantity string to number
 * e.g., "100.0000 CHEESE" -> { amount: 100, symbol: "CHEESE", precision: 4 }
 */
export function parseTokenQuantity(quantity: string): Omit<ParsedToken, 'contract'> {
  const parts = quantity.trim().split(' ');
  if (parts.length !== 2) {
    throw new Error(`Invalid quantity format: ${quantity}`);
  }
  
  const [amountStr, symbol] = parts;
  const amount = parseFloat(amountStr);
  
  // Calculate precision from decimal places
  const decimalIndex = amountStr.indexOf('.');
  const precision = decimalIndex === -1 ? 0 : amountStr.length - decimalIndex - 1;
  
  return { amount, symbol, precision };
}

/**
 * Fetch backing for multiple assets in batch
 * Uses direct RPC calls to atomicassets contract
 */
export async function fetchMultipleAssetBackings(
  assetIds: string[]
): Promise<Map<string, BackedToken[]>> {
  const backingMap = new Map<string, BackedToken[]>();
  
  if (assetIds.length === 0) return backingMap;
  
  // Process in batches of 100 for performance
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < assetIds.length; i += BATCH_SIZE) {
    const batch = assetIds.slice(i, i + BATCH_SIZE);
    
    // Fetch each asset individually (atomicassets doesn't support batch query easily)
    const promises = batch.map(async (assetId) => {
      const backing = await fetchAssetBacking(assetId);
      return { assetId, backing };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ assetId, backing }) => {
      backingMap.set(assetId, backing);
    });
  }
  
  return backingMap;
}

/**
 * Calculate total backed value from multiple assets
 * Groups by token symbol and sums amounts
 */
export function calculateTotalBacking(
  assets: AssetWithBacking[]
): Map<string, { amount: number; contract: string; precision: number }> {
  const totals = new Map<string, { amount: number; contract: string; precision: number }>();
  
  for (const asset of assets) {
    for (const token of asset.backed_tokens) {
      const parsed = parseTokenQuantity(token.quantity);
      const existing = totals.get(parsed.symbol);
      
      if (existing) {
        existing.amount += parsed.amount;
      } else {
        totals.set(parsed.symbol, {
          amount: parsed.amount,
          contract: token.token_contract,
          precision: parsed.precision,
        });
      }
    }
  }
  
  return totals;
}

/**
 * Build atomicassets::burnasset action
 * Burning automatically releases backed tokens to the burner
 */
export function buildBurnAssetAction(
  owner: string,
  assetId: string,
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  return {
    account: 'atomicassets',
    name: 'burnasset',
    authorization: [permissionLevel],
    data: {
      asset_owner: owner,
      asset_id: parseInt(assetId),
    },
  };
}

/**
 * Build batch burn actions for multiple assets
 */
export function buildBatchBurnActions(
  owner: string,
  assetIds: string[],
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  return assetIds.map((assetId) => buildBurnAssetAction(owner, assetId, permissionLevel));
}
