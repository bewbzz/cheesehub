/**
 * Token Backing utilities for WaxDAO's backbywaxpls contract
 * Allows backing NFTs with tokens (CHEESE, WAX, etc.)
 */

import { fetchTableRows } from './waxRpcFallback';

export const BACKING_CONTRACT = 'backbywaxpls';

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
 * 1. announcedepo - Prepare deposit slots for each NFT
 * 2. transfer - Send tokens to atomicassets with memo "deposit"
 * 3. backnft - Execute backing via backbywaxpls contract
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

  const authorization = [permissionLevel];
  const actions = [];

  // 1. Announce deposit for each asset
  for (const assetId of assetIds) {
    actions.push({
      account: 'atomicassets',
      name: 'announcedepo',
      authorization: [permissionLevel],
      data: {
        owner,
        asset_ids: [assetId],
      },
    });
  }

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

  // 3. Back each NFT using backbywaxpls contract
  for (const assetId of assetIds) {
    actions.push({
      account: BACKING_CONTRACT,
      name: 'backnft',
      authorization: [permissionLevel],
      data: {
        user: owner,
        asset_id: parseInt(assetId),
        quantity: perNftQuantity,
        token_contract: contract,
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
