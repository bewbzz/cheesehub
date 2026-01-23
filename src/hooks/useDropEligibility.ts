import { useState, useEffect, useCallback } from 'react';
import type { DropAuthRequirement } from '@/types/drop';

interface EligibilityResult {
  isEligible: boolean;
  isChecking: boolean;
  matchingAssetIds: string[];
  requirementsSummary: string[];
  error: string | null;
}

interface OwnedAsset {
  asset_id: string;
  collection_name: string;
  schema_name: string;
  template_id: number;
}

interface NFTHiveAuthRequirement {
  filter_type: number;
  collection_name?: string;
  schema_name?: string;
  template_id?: number;
  authorized_account?: string;
  logic_operator?: number;
}

// Try NFTHive's indexed REST API first (most reliable)
async function fetchAuthFromNFTHiveAPI(dropId: string): Promise<DropAuthRequirement[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `https://wax-api.hivebp.io/api/drops/${dropId}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[Auth] NFTHive API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`[Auth] NFTHive API response for drop ${dropId}:`, data);
    
    // Parse auth_requirements from API response if available
    if (data.auth_requirements && Array.isArray(data.auth_requirements)) {
      console.log(`[Auth] Found ${data.auth_requirements.length} requirements from NFTHive API`);
      return data.auth_requirements.map((req: NFTHiveAuthRequirement) => ({
        type: req.authorized_account ? 'account' 
            : req.filter_type === 2 ? 'template' 
            : req.filter_type === 1 ? 'schema'
            : 'collection',
        collectionName: req.collection_name,
        schemaName: req.schema_name,
        templateId: req.template_id,
        authorizedAccount: req.authorized_account,
        logicOperator: req.logic_operator === 1 ? 'or' : 'and',
      } as DropAuthRequirement));
    }
    
    // Some API responses have 'auths' instead
    if (data.auths && Array.isArray(data.auths)) {
      console.log(`[Auth] Found ${data.auths.length} requirements from NFTHive API (auths field)`);
      return data.auths.map((req: NFTHiveAuthRequirement) => ({
        type: req.authorized_account ? 'account' 
            : req.filter_type === 2 ? 'template' 
            : req.filter_type === 1 ? 'schema'
            : 'collection',
        collectionName: req.collection_name,
        schemaName: req.schema_name,
        templateId: req.template_id,
        authorizedAccount: req.authorized_account,
        logicOperator: req.logic_operator === 1 ? 'or' : 'and',
      } as DropAuthRequirement));
    }
    
    console.log('[Auth] NFTHive API response had no auth_requirements or auths field');
  } catch (error) {
    console.warn('[Auth] NFTHive API failed:', error);
  }
  return [];
}

/**
 * Hook to check if user is eligible for an auth-required drop
 */
export function useDropEligibility(
  dropId: string | undefined,
  authRequired: boolean | undefined,
  authRequirements: DropAuthRequirement[] | undefined,
  accountName: string | null
): EligibilityResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [matchingAssetIds, setMatchingAssetIds] = useState<string[]>([]);
  const [requirementsSummary, setRequirementsSummary] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    // If not auth required, always eligible
    if (!authRequired) {
      setIsEligible(true);
      setRequirementsSummary([]);
      return;
    }

    // If auth required but requirements not yet loaded, assume not eligible (still loading)
    if (!authRequirements || authRequirements.length === 0) {
      setIsEligible(false);
      setRequirementsSummary([]);
      return;
    }

    // Skip if not connected
    if (!accountName) {
      setIsEligible(false);
      setRequirementsSummary(buildRequirementsSummary(authRequirements));
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      // Fetch user's NFT holdings directly from on-chain
      const ownedAssets = await fetchUserAssets(accountName);

      // Check each requirement - determine logic operator (default AND)
      const matchingIds: string[] = [];
      const logicOperator = authRequirements[0]?.logicOperator || 'and';
      let requirementResults: boolean[] = [];

      for (const req of authRequirements) {
        let requirementMet = false;
        
        if (req.type === 'account') {
          // Account whitelist - check if user is the authorized account
          requirementMet = accountName === req.authorizedAccount;
        } else {
          // NFT-based requirement
          const matching = findMatchingAssets(ownedAssets, req);
          if (matching.length > 0) {
            matchingIds.push(...matching.map(a => a.asset_id));
            requirementMet = true;
          }
        }
        
        requirementResults.push(requirementMet);
      }

      // Determine overall eligibility based on logic operator
      const isEligibleResult = logicOperator === 'or' 
        ? requirementResults.some(r => r) 
        : requirementResults.every(r => r);

      setIsEligible(isEligibleResult);
      setMatchingAssetIds([...new Set(matchingIds)]);
      setRequirementsSummary(buildRequirementsSummary(authRequirements));
    } catch (err) {
      console.error('Error checking drop eligibility:', err);
      setError(err instanceof Error ? err.message : 'Failed to check eligibility');
      setIsEligible(false);
    } finally {
      setIsChecking(false);
    }
  }, [authRequired, authRequirements, accountName]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  return {
    isEligible,
    isChecking,
    matchingAssetIds,
    requirementsSummary,
    error,
  };
}

/**
 * Fetch user's owned assets from on-chain atomicassets contract
 */
async function fetchUserAssets(owner: string): Promise<OwnedAsset[]> {
  const { fetchTableRows } = await import('@/lib/waxRpcFallback');

  const assets: OwnedAsset[] = [];
  let more = true;
  let nextKey = '';

  while (more) {
    const result = await fetchTableRows<{
      asset_id: string;
      collection_name: string;
      schema_name: string;
      template_id: number;
    }>({
      code: 'atomicassets',
      scope: owner,
      table: 'assets',
      limit: 1000,
      lower_bound: nextKey,
    });

    for (const row of result.rows) {
      assets.push({
        asset_id: row.asset_id,
        collection_name: row.collection_name,
        schema_name: row.schema_name,
        template_id: row.template_id,
      });
    }

    more = result.more || false;
    if (result.rows.length > 0) {
      nextKey = String(BigInt(result.rows[result.rows.length - 1].asset_id) + BigInt(1));
    } else {
      more = false;
    }
  }

  return assets;
}

/**
 * Find assets matching a specific requirement
 */
function findMatchingAssets(
  assets: OwnedAsset[],
  requirement: DropAuthRequirement
): OwnedAsset[] {
  // Account type doesn't have matching assets
  if (requirement.type === 'account') {
    return [];
  }
  
  return assets.filter(asset => {
    // Must match collection
    if (asset.collection_name !== requirement.collectionName) {
      return false;
    }

    // If schema specified, must match
    if (requirement.schemaName && asset.schema_name !== requirement.schemaName) {
      return false;
    }

    // If template specified, must match
    if (requirement.templateId && asset.template_id !== requirement.templateId) {
      return false;
    }

    return true;
  });
}

/**
 * Build human-readable summary of requirements
 */
function buildRequirementsSummary(requirements: DropAuthRequirement[]): string[] {
  return requirements.map(req => {
    if (req.type === 'account') {
      return `Whitelisted account: ${req.authorizedAccount}`;
    }
    if (req.templateId) {
      return `Template #${req.templateId} from ${req.collectionName}`;
    }
    if (req.schemaName) {
      return `Any "${req.schemaName}" NFT from ${req.collectionName}`;
    }
    return `Any NFT from ${req.collectionName}`;
  });
}

/**
 * Fetch auth requirements for a specific drop from nfthivedrops contract
 * Uses NFTHive REST API first (most reliable), then falls back to on-chain RPC
 */
export async function fetchDropAuthRequirements(dropId: string): Promise<DropAuthRequirement[]> {
  const numericDropId = parseInt(dropId, 10);
  if (isNaN(numericDropId)) {
    console.error('[Auth] Invalid dropId:', dropId);
    return [];
  }

  // Strategy 1: Try NFTHive's indexed REST API first (most reliable)
  console.log(`[Auth] Trying NFTHive API for drop ${dropId}...`);
  const apiResult = await fetchAuthFromNFTHiveAPI(dropId);
  if (apiResult.length > 0) {
    console.log(`[Auth] Got ${apiResult.length} requirements from NFTHive API`);
    return apiResult;
  }

  // Strategy 2: Try on-chain with secondary index (drop_id)
  console.log(`[Auth] NFTHive API returned no results, trying on-chain RPC...`);
  const { fetchTableRows } = await import('@/lib/waxRpcFallback');
  
  try {
    const result = await fetchTableRows<{
      drop_id: number;
      filter_type: number;
      collection_name: string;
      schema_name: string;
      template_id: number;
      authorized_account: string;
      logic_operator: number;
    }>({
      code: 'nfthivedrops',
      scope: 'nfthivedrops',
      table: 'auths',
      index_position: 2,
      key_type: 'i64',
      lower_bound: String(numericDropId),
      upper_bound: String(numericDropId),
      limit: 100,
    }, 20000);  // 20 second timeout

    if (result.rows && result.rows.length > 0) {
      console.log(`[Auth] On-chain secondary index returned ${result.rows.length} rows`);
      return result.rows.map(row => {
        let type: 'collection' | 'schema' | 'template' | 'account';
        
        if (row.authorized_account && row.authorized_account !== '') {
          type = 'account';
        } else if (row.filter_type === 2) {
          type = 'template';
        } else if (row.filter_type === 1) {
          type = 'schema';
        } else {
          type = 'collection';
        }

        return {
          type,
          collectionName: row.collection_name || undefined,
          schemaName: row.schema_name || undefined,
          templateId: row.template_id || undefined,
          authorizedAccount: row.authorized_account || undefined,
          logicOperator: row.logic_operator === 1 ? 'or' : 'and',
        };
      });
    }
  } catch (error) {
    console.warn('[Auth] Secondary index query failed:', error);
  }

  // Strategy 3: Try fetching a range and filter client-side (last resort)
  console.log(`[Auth] Secondary index failed, trying range query...`);
  try {
    const result = await fetchTableRows<{
      drop_id: number;
      filter_type: number;
      collection_name: string;
      schema_name: string;
      template_id: number;
      authorized_account: string;
      logic_operator: number;
    }>({
      code: 'nfthivedrops',
      scope: 'nfthivedrops',
      table: 'auths',
      limit: 500,
    }, 25000);  // 25 second timeout for larger fetch

    if (result.rows && result.rows.length > 0) {
      // Filter client-side to exact drop_id
      const matchingRows = result.rows.filter(row => row.drop_id === numericDropId);
      console.log(`[Auth] Range query found ${matchingRows.length} matching rows out of ${result.rows.length} total`);
      
      if (matchingRows.length > 0) {
        return matchingRows.map(row => {
          let type: 'collection' | 'schema' | 'template' | 'account';
          
          if (row.authorized_account && row.authorized_account !== '') {
            type = 'account';
          } else if (row.filter_type === 2) {
            type = 'template';
          } else if (row.filter_type === 1) {
            type = 'schema';
          } else {
            type = 'collection';
          }

          return {
            type,
            collectionName: row.collection_name || undefined,
            schemaName: row.schema_name || undefined,
            templateId: row.template_id || undefined,
            authorizedAccount: row.authorized_account || undefined,
            logicOperator: row.logic_operator === 1 ? 'or' : 'and',
          };
        });
      }
    }
  } catch (error) {
    console.warn('[Auth] Range query also failed:', error);
  }

  console.warn(`[Auth] All strategies failed for drop ${dropId}`);
  return [];
}
