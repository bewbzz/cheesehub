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

// NFTHive API endpoint patterns to try
const NFTHIVE_API_PATTERNS = [
  (id: string) => `https://nfthive.io/api/drop/${id}`,
  (id: string) => `https://wax-api.hivebp.io/api/drop/${id}`,
  (id: string) => `https://wax-api.hivebp.io/nfthivedrops/drops/${id}`,
  (id: string) => `https://wax-api.hivebp.io/api/v1/drops/${id}`,
  (id: string) => `https://wax-api.hivebp.io/api/drops/${id}`,
];

// Hyperion endpoints for history queries
const HYPERION_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
  'https://wax.eosphere.io',
  'https://wax.blokcrafters.io',
  'https://hyperion.wax.eosrio.io',
];

function parseAuthRequirements(auths: NFTHiveAuthRequirement[]): DropAuthRequirement[] {
  return auths.map((req) => ({
    type: req.authorized_account && req.authorized_account !== ''
      ? 'account'
      : req.filter_type === 2
      ? 'template'
      : req.filter_type === 1
      ? 'schema'
      : 'collection',
    collectionName: req.collection_name,
    schemaName: req.schema_name,
    templateId: req.template_id,
    authorizedAccount: req.authorized_account,
    logicOperator: req.logic_operator === 1 ? 'or' : 'and',
  } as DropAuthRequirement));
}

// Strategy 1: Try multiple NFTHive API endpoint patterns
async function fetchAuthFromNFTHiveAPI(dropId: string): Promise<DropAuthRequirement[]> {
  for (const pattern of NFTHIVE_API_PATTERNS) {
    const url = pattern(dropId);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Try different response structures
      const auths = data.auth_requirements || data.auths || data.eligibility || data.requirements;
      if (auths && Array.isArray(auths) && auths.length > 0) {
        console.log(`[Auth] Found ${auths.length} requirements from ${url}`);
        return parseAuthRequirements(auths);
      }
    } catch (error) {
      // Try next pattern
    }
  }
  console.warn('[Auth] All NFTHive API patterns failed');
  return [];
}

// Strategy 2: Query Hyperion history for setauth actions
async function fetchAuthFromHyperion(dropId: string): Promise<DropAuthRequirement[]> {
  const numericDropId = parseInt(dropId, 10);
  
  for (const endpoint of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // Query for setauth actions on this drop - use drop_id filter in URL when supported
      const url = `${endpoint}/v2/history/get_actions?account=nfthivedrops&filter=nfthivedrops:setauth&limit=200`;
      console.log(`[Auth] Trying Hyperion ${endpoint}...`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.actions && Array.isArray(data.actions)) {
        // Filter to actions for this specific drop_id
        const matchingActions = data.actions.filter((action: { act?: { data?: { drop_id?: number } } }) => 
          action.act?.data?.drop_id === numericDropId
        );
        
        if (matchingActions.length > 0) {
          console.log(`[Auth] Found ${matchingActions.length} setauth actions from Hyperion ${endpoint}`);
          return matchingActions.map((action: { act: { data: NFTHiveAuthRequirement } }) => {
            const d = action.act.data;
            return {
              type: d.authorized_account && d.authorized_account !== ''
                ? 'account'
                : d.filter_type === 2
                ? 'template'
                : d.filter_type === 1
                ? 'schema'
                : 'collection',
              collectionName: d.collection_name,
              schemaName: d.schema_name,
              templateId: d.template_id,
              authorizedAccount: d.authorized_account,
              logicOperator: d.logic_operator === 1 ? 'or' : 'and',
            } as DropAuthRequirement;
          });
        }
      }
    } catch (error) {
      console.warn(`[Auth] Hyperion ${endpoint} failed:`, error);
    }
  }
  console.warn('[Auth] All Hyperion endpoints failed');
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

  // Strategy 1: Try NFTHive's REST API patterns first
  console.log(`[Auth] Trying NFTHive API patterns for drop ${dropId}...`);
  const apiResult = await fetchAuthFromNFTHiveAPI(dropId);
  if (apiResult.length > 0) {
    return apiResult;
  }

  // Strategy 2: Try Hyperion history API for setauth actions
  console.log(`[Auth] Trying Hyperion history for drop ${dropId}...`);
  const hyperionResult = await fetchAuthFromHyperion(dropId);
  if (hyperionResult.length > 0) {
    return hyperionResult;
  }

  // Strategy 3: Try on-chain with secondary index (drop_id)
  console.log(`[Auth] Trying on-chain RPC for drop ${dropId}...`);
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

  // Strategy 4: Try fetching a range and filter client-side (last resort)
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
