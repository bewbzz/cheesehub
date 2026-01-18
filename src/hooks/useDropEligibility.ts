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
    // Skip if not auth required or no requirements
    if (!authRequired || !authRequirements || authRequirements.length === 0) {
      setIsEligible(true);
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

      // Check each requirement
      const matchingIds: string[] = [];
      let allRequirementsMet = true;

      for (const req of authRequirements) {
        const matching = findMatchingAssets(ownedAssets, req);
        if (matching.length > 0) {
          matchingIds.push(...matching.map(a => a.asset_id));
        } else {
          allRequirementsMet = false;
        }
      }

      setIsEligible(allRequirementsMet);
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
 */
export async function fetchDropAuthRequirements(dropId: string): Promise<DropAuthRequirement[]> {
  const { fetchTableRows } = await import('@/lib/waxRpcFallback');

  try {
    const result = await fetchTableRows<{
      drop_id: number;
      authorized_account: string;
      logic_operator: number;
      filter_type: number; // 0=collection, 1=schema, 2=template
      collection_name: string;
      schema_name: string;
      template_id: number;
    }>({
      code: 'nfthivedrops',
      scope: 'nfthivedrops',
      table: 'auths',
      index_position: 2,
      key_type: 'i64',
      lower_bound: dropId,
      upper_bound: dropId,
      limit: 100,
    });

    return result.rows.map(row => {
      const type: 'collection' | 'schema' | 'template' = 
        row.filter_type === 2 ? 'template' : 
        row.filter_type === 1 ? 'schema' : 'collection';

      return {
        type,
        collectionName: row.collection_name,
        schemaName: row.schema_name || undefined,
        templateId: row.template_id || undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching drop auth requirements:', error);
    return [];
  }
}
