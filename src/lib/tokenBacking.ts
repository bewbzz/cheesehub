/**
 * Token Backing utilities for WaxDAO's backbywaxpls contract
 * Allows backing NFTs with tokens (CHEESE, WAX, etc.)
 */

import { fetchTableRows } from './waxRpcFallback';

export const BACKING_CONTRACT = 'backbywaxpls';

// Known backing contracts - different collections deploy their own versions
export const KNOWN_BACKING_CONTRACTS = [
  'backbywaxpls',  // Generic WaxDAO contract
  'backtokencon',  // Terraformers/HoodPunks/WaxyWojaks contract
] as const;

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
 * The assets table is scoped by owner account, not 'atomicassets'
 */
export async function fetchAssetBacking(assetId: string, owner: string): Promise<BackedToken[]> {
  try {
    console.log(`[Backing] Fetching asset ${assetId} (owner: ${owner})`);
    
    const response = await fetchTableRows<{ 
      asset_id: string;
      backed_tokens?: BackedToken[];
      collection_name?: string;
    }>({
      code: 'atomicassets',
      scope: owner,
      table: 'assets',
      lower_bound: assetId,
      upper_bound: assetId,
      limit: 1,
    });

    console.log(`[Backing] Response for ${assetId}:`, JSON.stringify(response, null, 2));

    if (response.rows.length > 0) {
      const row = response.rows[0];
      console.log(`[Backing] Asset ${assetId} backed_tokens:`, row.backed_tokens);
      
      if (row.backed_tokens && row.backed_tokens.length > 0) {
        return row.backed_tokens;
      }
    } else {
      console.warn(`[Backing] No row found for asset ${assetId}`);
    }
    return [];
  } catch (error) {
    console.error(`[Backing] Failed to fetch asset ${assetId}:`, error);
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

// ============================================================================
// WAXDAO TEMPLATE BACKING DETECTION
// ============================================================================

export interface TemplateBackingConfig {
  template_id: number;
  token_contract: string;
  quantity: string;
  enabled: boolean;
  backing_contract: string;  // Which contract holds this backing config
}

/**
 * Fetch template backing configurations from all known backing contracts
 * Different collections deploy their own backing contracts (backbywaxpls, backtokencon, etc.)
 * This detects NFTs that have WaxDAO backing configured at the template level
 */
export async function fetchTemplateBackingConfigs(
  templateIds: number[]
): Promise<Map<number, TemplateBackingConfig>> {
  const configMap = new Map<number, TemplateBackingConfig>();
  
  if (templateIds.length === 0) return configMap;
  
  // Remove duplicates
  const uniqueTemplateIds = [...new Set(templateIds)];
  
  console.log(`[TemplateBacking] Fetching configs for ${uniqueTemplateIds.length} unique templates from ${KNOWN_BACKING_CONTRACTS.length} contracts`);
  
  try {
    // Query each known backing contract
    for (const backingContract of KNOWN_BACKING_CONTRACTS) {
      // Skip templates we already found
      const remainingTemplates = uniqueTemplateIds.filter(id => !configMap.has(id));
      if (remainingTemplates.length === 0) break;
      
      console.log(`[TemplateBacking] Checking ${backingContract} for ${remainingTemplates.length} templates`);
      
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < remainingTemplates.length; i += BATCH_SIZE) {
        const batch = remainingTemplates.slice(i, i + BATCH_SIZE);
        
        // Fetch each template individually
        const promises = batch.map(async (templateId) => {
          try {
            const response = await fetchTableRows<{
              template_id: number;
              token_contract: string;
              quantity: string;
              token?: string;  // Some contracts use 'token' instead of 'quantity'
              maintenance?: boolean;
              enabled?: boolean;
            }>({
              code: backingContract,
              scope: backingContract,
              table: 'templates',
              lower_bound: templateId.toString(),
              upper_bound: templateId.toString(),
              limit: 1,
            });
            
            if (response.rows.length > 0) {
              const row = response.rows[0];
              // Check if this template actually matches
              if (row.template_id === templateId) {
                const quantity = row.quantity || row.token || '';
                return {
                  templateId,
                  config: {
                    template_id: row.template_id,
                    token_contract: row.token_contract,
                    quantity,
                    enabled: row.enabled !== false && row.maintenance !== true,
                    backing_contract: backingContract,
                  },
                };
              }
            }
            return null;
          } catch (error) {
            // Don't warn on individual failures - might just not exist on this contract
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach((result) => {
          if (result) {
            configMap.set(result.templateId, result.config);
            console.log(`[TemplateBacking] Found template ${result.templateId} on ${backingContract}: ${result.config.quantity}`);
          }
        });
        
        // Small delay between batches
        if (i + BATCH_SIZE < remainingTemplates.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }
    
    console.log(`[TemplateBacking] Found ${configMap.size} templates with backing configured`);
  } catch (error) {
    console.error('[TemplateBacking] Failed to fetch template configs:', error);
  }
  
  return configMap;
}

/**
 * Unified backing data that includes both direct and template backing
 */
export interface UnifiedBackingInfo {
  backed_tokens: BackedToken[];
  hasTemplateBacking: boolean;  // True if backing comes from template (needs claim first)
  backingContract?: string;     // Which contract to call for claimtokens
}

/**
 * Fetch unified backing for multiple assets
 * Checks both atomicassets backed_tokens AND WaxDAO template backing
 * Returns a map with backing info that seamlessly handles both sources
 */
export async function fetchUnifiedAssetBackings(
  assets: Array<{ asset_id: string; template_id: string | number }>,
  owner: string
): Promise<Map<string, UnifiedBackingInfo>> {
  const resultMap = new Map<string, UnifiedBackingInfo>();
  
  if (assets.length === 0 || !owner) return resultMap;
  
  console.log(`[UnifiedBacking] Starting fetch for ${assets.length} assets (owner: ${owner})`);
  
  // Step 1: Fetch direct atomicassets backing
  const assetIds = assets.map((a) => a.asset_id);
  const directBackingMap = await fetchMultipleAssetBackingsInternal(assetIds, owner);
  
  // Step 2: Extract unique template IDs for assets without direct backing
  const assetsNeedingTemplateCheck: Array<{ asset_id: string; template_id: number }> = [];
  
  for (const asset of assets) {
    const directBacking = directBackingMap.get(asset.asset_id) || [];
    if (directBacking.length === 0 && asset.template_id) {
      const templateId = typeof asset.template_id === 'string' 
        ? parseInt(asset.template_id, 10) 
        : asset.template_id;
      if (!isNaN(templateId) && templateId > 0) {
        assetsNeedingTemplateCheck.push({ asset_id: asset.asset_id, template_id: templateId });
      }
    }
  }
  
  // Step 3: Fetch template backing configs
  const templateIds = assetsNeedingTemplateCheck.map((a) => a.template_id);
  const templateConfigs = await fetchTemplateBackingConfigs(templateIds);
  
  // Step 4: Build unified result
  for (const asset of assets) {
    const directBacking = directBackingMap.get(asset.asset_id) || [];
    
    if (directBacking.length > 0) {
      // Has direct backing - already claimed/applied
      resultMap.set(asset.asset_id, {
        backed_tokens: directBacking,
        hasTemplateBacking: false,
      });
    } else {
      // Check for template backing
      const templateId = typeof asset.template_id === 'string' 
        ? parseInt(asset.template_id, 10) 
        : asset.template_id;
      const templateConfig = templateId ? templateConfigs.get(templateId) : undefined;
      
      if (templateConfig && templateConfig.enabled) {
        // Has template backing - needs claim before burn
        resultMap.set(asset.asset_id, {
          backed_tokens: [{
            quantity: templateConfig.quantity,
            token_contract: templateConfig.token_contract,
          }],
          hasTemplateBacking: true,
          backingContract: templateConfig.backing_contract,
        });
      } else {
        // No backing at all
        resultMap.set(asset.asset_id, {
          backed_tokens: [],
          hasTemplateBacking: false,
        });
      }
    }
  }
  
  const backedCount = Array.from(resultMap.values()).filter((b) => b.backed_tokens.length > 0).length;
  const templateBackedCount = Array.from(resultMap.values()).filter((b) => b.hasTemplateBacking).length;
  console.log(`[UnifiedBacking] Complete: ${backedCount} have backing (${templateBackedCount} from templates)`);
  
  return resultMap;
}

/**
 * Internal function to fetch direct atomicassets backing
 */
async function fetchMultipleAssetBackingsInternal(
  assetIds: string[],
  owner: string
): Promise<Map<string, BackedToken[]>> {
  const backingMap = new Map<string, BackedToken[]>();
  
  if (assetIds.length === 0 || !owner) return backingMap;
  
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < assetIds.length; i += BATCH_SIZE) {
    const batch = assetIds.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (assetId) => {
      const backing = await fetchAssetBacking(assetId, owner);
      return { assetId, backing };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ assetId, backing }) => {
      backingMap.set(assetId, backing);
    });
    
    if (i + BATCH_SIZE < assetIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  
  return backingMap;
}

/**
 * Legacy function - kept for backwards compatibility
 * Now wraps the unified backing function
 */
export async function fetchMultipleAssetBackings(
  assetIds: string[],
  owner: string
): Promise<Map<string, BackedToken[]>> {
  // This is the legacy version that only checks atomicassets
  return fetchMultipleAssetBackingsInternal(assetIds, owner);
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

/**
 * Build smart burn actions that include claim for template-backed NFTs
 * This combines claimtokens + burnasset in a single transaction where needed
 */
export function buildSmartBurnActions(
  owner: string,
  assets: Array<{ asset_id: string; hasTemplateBacking: boolean; backingContract?: string }>,
  permissionLevel: { actor: { toString: () => string }; permission: { toString: () => string } }
) {
  const actions: Array<{
    account: string;
    name: string;
    authorization: any[];
    data: any;
  }> = [];
  
  // First, add claimtokens for all template-backed assets
  for (const asset of assets) {
    if (asset.hasTemplateBacking && asset.backingContract) {
      actions.push({
        account: asset.backingContract,  // Use the correct contract for this asset
        name: 'claimtokens',
        authorization: [permissionLevel],
        data: {
          user: owner,
          asset_id: parseInt(asset.asset_id),
        },
      });
    }
  }
  
  // Then, add burnasset for all assets
  for (const asset of assets) {
    actions.push({
      account: 'atomicassets',
      name: 'burnasset',
      authorization: [permissionLevel],
      data: {
        asset_owner: owner,
        asset_id: parseInt(asset.asset_id),
      },
    });
  }
  
  return actions;
}
