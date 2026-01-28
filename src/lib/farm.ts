// WaxDAO V2 Farm Contract Interface
// Contract: farms.waxdao

import { fetchTableRows } from "./waxRpcFallback";

export const FARM_CONTRACT = "farms.waxdao";

// Fee constants for farm creation
export const FARM_CREATION_FEES = {
  WAX: "250.00000000 WAX",
  WAXDAO: "25000.00000000 WAXDAO",
  WOJAK_COLLECTION: "ourwojaksart", // Can use 1 Wojak NFT
};

// Farm types based on stakable asset configuration
export const FARM_TYPES = {
  COLLECTIONS: "collections",
  SCHEMAS: "schemas",
  TEMPLATES: "templates",
  ATTRIBUTES: "attributes",
} as const;

export type FarmType = typeof FARM_TYPES[keyof typeof FARM_TYPES];

export const FARM_TYPE_LABELS: Record<FarmType, string> = {
  collections: "Collections",
  schemas: "Schemas",
  templates: "Templates",
  attributes: "Attributes",
};

// Payout interval options (in seconds)
export const PAYOUT_INTERVALS = [
  { label: "1 hour", value: 3600 },
  { label: "2 hours", value: 7200 },
  { label: "4 hours", value: 14400 },
  { label: "8 hours", value: 28800 },
  { label: "12 hours", value: 43200 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
];

// Validate farm name (must be 1-12 chars, a-z, 1-5, and .)
export function validateFarmName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: "Farm name is required" };
  }
  if (name.length > 12) {
    return { valid: false, error: "Farm name must be 12 characters or less" };
  }
  if (!/^[a-z1-5.]+$/.test(name)) {
    return { valid: false, error: "Farm name can only contain a-z, 1-5, and ." };
  }
  return { valid: true };
}

export interface StakableAsset {
  collection?: string;
  schema?: string;
  templateId?: string;
  attributeKey?: string;
  attributeValue?: string;
  rewardPerHour: number;
}

export interface RewardToken {
  contract: string;
  symbol: string;
  precision: number;
}

export interface FarmProfile {
  avatar?: string;
  cover_image?: string;
  description?: string;
}

export interface FarmSocials {
  website?: string;
  telegram?: string;
  discord?: string;
  twitter?: string;
  atomichub?: string;
  waxdao?: string;
  youtube?: string;
  medium?: string;
}

export interface FarmInfo {
  farm_name: string;
  creator: string;
  logo: string;
  description: string;
  staked_count: number;
  reward_pools: RewardPool[];
  expiration: number;
  payout_interval: number;
  last_payout: number;
  farm_type: number;
  time_created: number;
  is_active: boolean;
  status: number;
  profile?: FarmProfile;
  socials?: FarmSocials;
  id: number;
}

export interface FarmConfig {
  name: string;
  logo: string;
  description: string;
  farmType: FarmType;
  stakableAssets: StakableAsset[];
  rewardTokens: RewardToken[];
  payoutInterval: number;
  expirationDate: Date;
}

export interface RewardPool {
  contract: string;
  symbol: string;
  balance: string;
  precision: number;
  total_funds?: string;
  total_hourly_reward?: string;
}

export interface UserStake {
  asset_id: string;
  staker: string;
  farm_name: string;
  last_claim: number;
  claimable_balances?: Array<{ quantity: string; contract: string }>;
  rates_per_hour?: Array<{ quantity: string; contract: string }>;
  last_state_change?: number;
}

// Convert IPFS hash to full URL
export function getIpfsUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return hash;
}

// Farm type numeric values matching contract
export const FARM_TYPE_VALUES = {
  collections: 0,
  schemas: 1,
  templates: 2,
  attributes: 3,
} as const;

// Build action for assertpoint (required before fee payment)
export function buildAssertPointAction(user: string) {
  return {
    account: FARM_CONTRACT,
    name: "assertpoint",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
    },
  };
}

// Build action for paying farm creation fee with WAX
export function buildFarmCreationFeeWaxAction(sender: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAX,
      memo: "|create_farm|",
    },
  };
}

// Build action for paying farm creation fee with WAXDAO
export function buildFarmCreationFeeWaxdaoAction(sender: string) {
  return {
    account: "mdcryptonfts",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAXDAO,
      memo: "|create_farm|",
    },
  };
}

// Build action for paying farm creation fee with Wojak NFT
export function buildFarmCreationFeeWojakAction(sender: string, assetId: string) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      asset_ids: [assetId],
      memo: "|create_farm|",
    },
  };
}

// Build action for creating farm
export function buildCreateFarmAction(
  user: string,
  farmName: string,
  farmType: FarmType,
  hoursBetweenPayouts: number,
  rewardTokens: RewardToken[],
  profile: {
    avatar: string;
    cover_image: string;
    description: string;
  },
  socials: {
    website: string;
    telegram: string;
    discord: string;
    twitter: string;
    medium: string;
    youtube: string;
    atomichub: string;
    waxdao: string;
  }
) {
  return {
    account: FARM_CONTRACT,
    name: "createfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      farm_type: FARM_TYPE_VALUES[farmType],
      hours_between_payouts: hoursBetweenPayouts,
      reward_tokens: rewardTokens.map(t => ({
        contract: t.contract,
        token_symbol: `${t.precision},${t.symbol}`,
      })),
      profile,
      socials,
    },
  };
}

// RewardValue type for V2 farm stakable assets
export interface RewardValue {
  quantity: string;
  contract: string;
}

// Build action for setting template values (V2)
// The contract expects 'values' as an array of TEMPLATE_REWARD structs
// Each struct contains: template_id, collection_name, hourly_rewards (array of FUNGIBLE_TOKEN)
export function buildSetTemplateValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  templateId: number,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "settmpvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        template_id: templateId,
        collection_name: collectionName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting schema values (V2)
// The contract expects 'values' as an array of SCHEMA_REWARD structs
// Each struct contains: collection_name, schema_name, hourly_rewards (array of FUNGIBLE_TOKEN)
export function buildSetSchemaValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  schemaName: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setschvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        collection_name: collectionName,
        schema_name: schemaName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting collection values (V2)
// The contract expects 'values' as an array of COLLECTION_REWARD structs
// Each struct contains: collection_name, hourly_rewards (array of FUNGIBLE_TOKEN)
export function buildSetCollectionValuesAction(
  user: string,
  farmname: string,
  collectionName: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setcolvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        collection_name: collectionName,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for setting attribute values (V2)
// The contract expects 'values' as an array of ATTRIBUTE_REWARD structs
// Each struct contains: attribute_name, attribute_value, hourly_rewards (array of FUNGIBLE_TOKEN)
export function buildSetAttributeValuesAction(
  user: string,
  farmname: string,
  attributeName: string,
  attributeValue: string,
  rewardValues: RewardValue[]
) {
  return {
    account: FARM_CONTRACT,
    name: "setattvalues",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname,
      values: [{
        attribute_name: attributeName,
        attribute_value: attributeValue,
        hourly_rewards: rewardValues.map(rv => ({
          quantity: rv.quantity,
          contract: rv.contract,
        })),
      }],
    },
  };
}

// Build action for depositing reward tokens
export function buildAddRewardsAction(
  sender: string,
  farmName: string,
  tokenContract: string,
  quantity: string
) {
  return {
    account: tokenContract,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity,
      memo: `|deposit|${farmName}|`,
    },
  };
}

// Build action for opening a farm (sets expiration and activates it)
export function buildOpenFarmAction(
  creator: string,
  farmName: string,
  expiration: number
) {
  return {
    account: FARM_CONTRACT,
    name: "openfarm",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      user: creator,
      farmname: farmName,
      expiration,
    },
  };
}

// Build action for extending farm expiration
export function buildExtendFarmAction(
  user: string,
  farmName: string,
  newExpiration: number
) {
  return {
    account: FARM_CONTRACT,
    name: "extendfarm",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      farmname: farmName,
      expiration: newExpiration,
    },
  };
}

// Build action for staking NFTs to a farm
export function buildStakeNftsAction(
  staker: string,
  farmName: string,
  assetIds: string[]
) {
  // V2 farms use non-custodial staking - NFTs stay in wallet
  // Call farms.waxdao::stake directly instead of transferring
  return {
    account: FARM_CONTRACT,
    name: "stakenfts",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
      assets_to_stake: assetIds,
    },
  };
}

// Build action for unstaking NFTs from a farm
export function buildUnstakeNftsAction(
  staker: string,
  farmName: string,
  assetIds: string[]
) {
  return {
    account: FARM_CONTRACT,
    name: "unstake",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
      asset_ids: assetIds,
    },
  };
}

// Build action for claiming rewards
export function buildClaimRewardsAction(staker: string, farmName: string) {
  return {
    account: FARM_CONTRACT,
    name: "claim",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      farmname: farmName,
    },
  };
}

// Fetch all V2 farms from the contract
export async function fetchAllFarms(): Promise<FarmInfo[]> {
  try {
    // Fetch all farms in a single request - WAX tables support large limits
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "farms",
      limit: 500,
    });

    // Deduplicate by farm name in case of any RPC inconsistencies
    const seenFarmNames = new Set<string>();
    const uniqueRows: Record<string, unknown>[] = [];
    
    for (const row of (data.rows || [])) {
      const farmRow = row as Record<string, unknown>;
      const farmName = (farmRow.farmname || farmRow.farm_name || "") as string;
      
      if (farmName && !seenFarmNames.has(farmName)) {
        seenFarmNames.add(farmName);
        uniqueRows.push(farmRow);
      }
    }

    console.log(`Fetched ${uniqueRows.length} unique farms (raw: ${data.rows?.length || 0})`);

    const now = Math.floor(Date.now() / 1000);

    return uniqueRows.map((row: Record<string, unknown>, index: number) => {
      // Handle actual WaxDAO V2 farm structure
      const farmName = (row.farmname || row.farm_name || `farm_${index}`) as string;
      const expiration = (row.expiration || 0) as number;
      const stakedCount = (row.total_staked || 0) as number;
      const createdTime = (row.time_created || 0) as number;
      const hoursInterval = (row.hours_between_payouts || 1) as number;
      const payoutInterval = hoursInterval * 3600;
      const profile = row.profile as FarmProfile | undefined;
      const socials = row.socials as FarmSocials | undefined;
      const farmId = (row.id || index) as number;
      const status = (row.status || 0) as number;
      const farmType = (row.farm_type || 0) as number;
      
      // Parse reward pools from WaxDAO format
      const rawPools = row.reward_pools as Array<{
        total_funds?: string;
        contract?: string;
        total_hourly_reward?: string;
      }> || [];
      
      const rewardPools: RewardPool[] = rawPools.map(pool => {
        const fundsStr = pool.total_funds || "0";
        const parts = fundsStr.split(" ");
        const balance = parts[0] || "0";
        const symbol = parts[1] || "";
        const precision = balance.includes(".") ? balance.split(".")[1]?.length || 0 : 0;
        
        return {
          contract: pool.contract || "",
          symbol,
          balance,
          precision,
          total_funds: pool.total_funds,
          total_hourly_reward: pool.total_hourly_reward,
        };
      });
      
      return {
        farm_name: farmName,
        creator: (row.creator || "") as string,
        logo: profile?.avatar || "",
        description: profile?.description || "",
        staked_count: stakedCount,
        reward_pools: rewardPools,
        expiration,
        payout_interval: payoutInterval,
        last_payout: (row.last_state_change || 0) as number,
        farm_type: farmType,
        time_created: createdTime,
        is_active: status === 1 && expiration > now,
        status,
        profile,
        socials,
        id: farmId,
      };
    });
  } catch (error) {
    console.error("Error fetching farms:", error);
    return [];
  }
}

// Fetch farms created by a specific user
export async function fetchUserFarms(account: string): Promise<FarmInfo[]> {
  try {
    const allFarms = await fetchAllFarms();
    
    // Debug: log a sample of creators to verify field mapping
    if (allFarms.length > 0) {
      const sampleCreators = allFarms.slice(0, 5).map(f => ({ name: f.farm_name, creator: f.creator }));
      console.log("Sample farm creators:", sampleCreators, "Looking for:", account);
    }
    
    const userFarms = allFarms.filter(farm => farm.creator === account);
    console.log(`Found ${userFarms.length} farms for user ${account}`);
    return userFarms;
  } catch (error) {
    console.error("Error fetching user farms:", error);
    return [];
  }
}

// Fetch details for a specific farm
export async function fetchFarmDetails(farmName: string): Promise<FarmInfo | null> {
  try {
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "farms",
      lower_bound: farmName,
      upper_bound: farmName,
      limit: 1,
    });

    console.log("Farm detail data:", data);
    
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      const now = Math.floor(Date.now() / 1000);
      
      // Handle actual WaxDAO V2 farm structure
      const farmName = (row.farmname || row.farm_name || "") as string;
      const expiration = (row.expiration || 0) as number;
      const stakedCount = (row.total_staked || 0) as number;
      const createdTime = (row.time_created || 0) as number;
      const hoursInterval = (row.hours_between_payouts || 1) as number;
      const payoutInterval = hoursInterval * 3600;
      const profile = row.profile as FarmProfile | undefined;
      const socials = row.socials as FarmSocials | undefined;
      const farmId = (row.id || 0) as number;
      const status = (row.status || 0) as number;
      const farmType = (row.farm_type || 0) as number;
      
      // Parse reward pools from WaxDAO format
      const rawPools = row.reward_pools as Array<{
        total_funds?: string;
        contract?: string;
        total_hourly_reward?: string;
      }> || [];
      
      const rewardPools: RewardPool[] = rawPools.map(pool => {
        const fundsStr = pool.total_funds || "0";
        const parts = fundsStr.split(" ");
        const balance = parts[0] || "0";
        const symbol = parts[1] || "";
        const precision = balance.includes(".") ? balance.split(".")[1]?.length || 0 : 0;
        
        return {
          contract: pool.contract || "",
          symbol,
          balance,
          precision,
          total_funds: pool.total_funds,
          total_hourly_reward: pool.total_hourly_reward,
        };
      });
      
      return {
        farm_name: farmName,
        creator: (row.creator || "") as string,
        logo: profile?.avatar || "",
        description: profile?.description || "",
        staked_count: stakedCount,
        reward_pools: rewardPools,
        expiration,
        payout_interval: payoutInterval,
        last_payout: (row.last_state_change || 0) as number,
        farm_type: farmType,
        time_created: createdTime,
        is_active: status === 1 && expiration > now,
        status,
        profile,
        socials,
        id: farmId,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching farm details:", error);
    return null;
  }
}

// Fetch user's staked NFTs in a farm
export async function fetchUserStakes(
  account: string,
  farmName: string
): Promise<UserStake[]> {
  try {
    console.log("Querying staking data for", account, "in farm", farmName);
    
    // Strategy 0: Query 'stakers' table by USER (index 2), filter by farmname
    // This is the most reliable method - finds user's row directly regardless of table size
    try {
      const userIndexData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: FARM_CONTRACT,
        table: "stakers",
        index_position: 2,
        key_type: "name",
        lower_bound: account,
        upper_bound: account,
        limit: 100,
      });
      
      console.log(`[Strategy 0] stakers by user index for ${account}:`, userIndexData.rows?.length || 0, "rows");
      
      if (userIndexData.rows && userIndexData.rows.length > 0) {
        console.log("[Strategy 0] User's staking rows:", JSON.stringify(userIndexData.rows.slice(0, 3), null, 2));
        
        // Find the row matching this farm
        const farmRow = userIndexData.rows.find((row: Record<string, unknown>) => {
          return row.farmname === farmName || row.farm_name === farmName;
        });
        
        if (farmRow) {
          console.log("[Strategy 0] Found user's stake row for farm:", JSON.stringify(farmRow, null, 2));
          
          const stakedAssets = farmRow.asset_ids || farmRow.staked_assets || farmRow.assets || [];
          
          if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
            console.log(`[Strategy 0] Found ${stakedAssets.length} staked assets`);
            return stakedAssets.map((assetId: string | number) => ({
              asset_id: String(assetId),
              staker: account,
              farm_name: farmName,
              last_claim: Number(farmRow.last_claim || farmRow.last_state_change) || 0,
              claimable_balances: (farmRow.claimable_balances as Array<{ quantity: string; contract: string }>) || [],
              rates_per_hour: (farmRow.rates_per_hour as Array<{ quantity: string; contract: string }>) || [],
              last_state_change: Number(farmRow.last_state_change) || 0,
            }));
          }
        } else {
          console.log(`[Strategy 0] Farm ${farmName} not found in user's ${userIndexData.rows.length} staking rows`);
          // Log available farms
          const farms = userIndexData.rows.map((r: Record<string, unknown>) => r.farmname || r.farm_name);
          console.log("[Strategy 0] User's staked farms:", farms);
          // User is confirmed to have no stake in this specific farm - return early!
          console.log(`[Strategy 0] Early return - user not staked in ${farmName}`);
          return [];
        }
      } else {
        console.log(`[Strategy 0] Secondary index returned 0 rows for user ${account} - trying fallback strategies`);
        // Don't early return - WAX RPC secondary indexes are unreliable
        // Continue to Strategy 0b which searches actual table data
      }
    } catch (e) {
      console.log("[Strategy 0] Failed, falling back to other strategies:", e);
    }
    
    // Strategy 0b: Query 'stakers' table with reverse order (newest first) + pagination
    // For farms with 10k+ rows where secondary index doesn't work
    try {
      let foundRow = null;
      let nextKey: string | undefined = undefined;
      let iterations = 0;
      const MAX_ITERATIONS = 20; // Max 20k rows to search
      
      while (!foundRow && iterations < MAX_ITERATIONS) {
        const paginatedData = await fetchTableRows({
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: "stakers",
          reverse: true,
          limit: 1000,
          ...(nextKey ? { upper_bound: nextKey } : {}),
        });
        
        iterations++;
        
        if (iterations === 1) {
          console.log(`[Strategy 0b] Paginated stakers search, batch 1:`, paginatedData.rows?.length || 0, "rows");
        }
        
        if (paginatedData.rows && paginatedData.rows.length > 0) {
          // Find user's row for this farm
          const userRow = paginatedData.rows.find((row: Record<string, unknown>) => {
            return row.user === account && (row.farmname === farmName || row.farm_name === farmName);
          });
          
          if (userRow) {
            foundRow = userRow;
            console.log(`[Strategy 0b] Found user's stake in batch ${iterations}:`, JSON.stringify(userRow, null, 2));
            break;
          }
          
          // Continue pagination if more rows exist
          if (paginatedData.more && paginatedData.next_key) {
            nextKey = paginatedData.next_key;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      if (foundRow) {
        const stakedAssets = foundRow.asset_ids || foundRow.staked_assets || foundRow.assets || [];
        if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
          console.log(`[Strategy 0b] Found ${stakedAssets.length} staked assets after ${iterations} batches`);
          return stakedAssets.map((assetId: string | number) => ({
            asset_id: String(assetId),
            staker: account,
            farm_name: farmName,
            last_claim: Number(foundRow.last_claim || foundRow.last_state_change) || 0,
            claimable_balances: (foundRow.claimable_balances as Array<{ quantity: string; contract: string }>) || [],
            rates_per_hour: (foundRow.rates_per_hour as Array<{ quantity: string; contract: string }>) || [],
            last_state_change: Number(foundRow.last_state_change) || 0,
          }));
        }
      } else {
        console.log(`[Strategy 0b] User not found after ${iterations} batches`);
      }
    } catch (e) {
      console.log("[Strategy 0b] Failed:", e);
    }
    
    // Strategy 1: Query ALL rows from 'stakers' table with farm scope to see what's there
    try {
      const allFarmStakersData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakers",
        limit: 100,
      });
      
      console.log(`[Strategy 1] ALL stakers with scope=${farmName}:`, allFarmStakersData.rows?.length || 0, "rows");
      
      if (allFarmStakersData.rows && allFarmStakersData.rows.length > 0) {
        console.log("[Strategy 1] First 3 rows:", JSON.stringify(allFarmStakersData.rows.slice(0, 3), null, 2));
        
        // Find user's row - check both primary key and user field
        const userRow = allFarmStakersData.rows.find((row: Record<string, unknown>) => {
          // The primary key might be user name, or there might be a user/staker field
          const possibleUser = row.user || row.staker || row.owner || row.wallet || "";
          // Also check if the row key matches (for name-indexed tables)
          return possibleUser === account;
        });
        
        if (userRow) {
          console.log("[Strategy 1] Found user row:", JSON.stringify(userRow, null, 2));
          const stakedAssets = userRow.staked_assets || userRow.asset_ids || userRow.assets || userRow.nfts || [];
          
          if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
            console.log(`[Strategy 1] Found ${stakedAssets.length} staked assets`);
            return stakedAssets.map((assetId: string | number) => ({
              asset_id: String(assetId),
              staker: account,
              farm_name: farmName,
              last_claim: (userRow.last_claim as number) || 0,
            }));
          }
        } else {
          console.log(`[Strategy 1] User ${account} not in first ${allFarmStakersData.rows.length} rows`);
        }
      } else {
        console.log(`[Strategy 1] No stakers table with scope=${farmName} - trying 'stakednfts' table`);
        
        // Try stakednfts table with farm scope - get ALL rows
        const stakednftsAllData = await fetchTableRows({
          code: FARM_CONTRACT,
          scope: farmName,
          table: "stakednfts",
          limit: 100,
        });
        
        console.log(`[Strategy 1b] ALL stakednfts with scope=${farmName}:`, stakednftsAllData.rows?.length || 0, "rows");
        
        if (stakednftsAllData.rows && stakednftsAllData.rows.length > 0) {
          console.log("[Strategy 1b] First 3 rows:", JSON.stringify(stakednftsAllData.rows.slice(0, 3), null, 2));
        }
      }
    } catch (e) {
      console.log("[Strategy 1] Failed:", e);
    }
    
    // Strategy 2: Query 'stakednfts' table with farm scope, get ALL rows and filter by owner
    // This is for farms that store one row per staked NFT
    try {
      const stakednftsData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakednfts",
        limit: 1000,
      });
      
      console.log(`[Strategy 2] stakednfts table (${farmName} scope), total rows: ${stakednftsData.rows?.length || 0}`);
      
      if (stakednftsData.rows && stakednftsData.rows.length > 0) {
        // Log first row to see structure
        console.log("[Strategy 2] Sample row:", JSON.stringify(stakednftsData.rows[0], null, 2));
        
        // Filter by owner field
        const userRows = stakednftsData.rows.filter((row: Record<string, unknown>) => {
          const rowOwner = row.owner || row.staker || row.user || "";
          return rowOwner === account;
        });
        
        if (userRows.length > 0) {
          console.log(`[Strategy 2] Found ${userRows.length} staked NFTs for ${account}`);
          return userRows.map((row: Record<string, unknown>) => ({
            asset_id: String(row.asset_id),
            staker: account,
            farm_name: farmName,
            last_claim: (row.last_claim as number) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 2] Failed:", e);
    }
    
    // Strategy 3: Query 'stakednfts' with user account as scope
    try {
      const userScopeData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: account,
        table: "stakednfts",
        limit: 1000,
      });
      
      console.log(`[Strategy 3] stakednfts with user scope (${account}):`, userScopeData);
      
      if (userScopeData.rows && userScopeData.rows.length > 0) {
        console.log("[Strategy 3] Sample row:", JSON.stringify(userScopeData.rows[0], null, 2));
        
        // Filter by farm name
        const farmRows = userScopeData.rows.filter((row: Record<string, unknown>) => {
          const rowFarm = row.farmname || row.farm_name || "";
          return rowFarm === farmName;
        });
        
        if (farmRows.length > 0) {
          console.log(`[Strategy 3] Found ${farmRows.length} staked NFTs for farm ${farmName}`);
          return farmRows.map((row: Record<string, unknown>) => ({
            asset_id: String(row.asset_id),
            staker: account,
            farm_name: farmName,
            last_claim: (row.last_claim as number) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 3] Failed:", e);
    }
    
    // Strategy 4: Query 'stakers' with user account as scope (some contracts scope by user)
    try {
      const stakersUserData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: account,
        table: "stakers",
        limit: 100,
      });
      
      console.log(`[Strategy 4] stakers with user scope:`, stakersUserData);
      
      if (stakersUserData.rows && stakersUserData.rows.length > 0) {
        console.log("[Strategy 4] Sample row:", JSON.stringify(stakersUserData.rows[0], null, 2));
        
        // Find the row for this farm
        const farmRow = stakersUserData.rows.find((r: Record<string, unknown>) => 
          r.farm_name === farmName || r.farmname === farmName
        );
        
        if (farmRow) {
          const stakedAssets = farmRow.staked_assets || farmRow.asset_ids || farmRow.assets || farmRow.nfts || [];
          if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
            console.log(`[Strategy 4] Found ${stakedAssets.length} staked assets`);
            return stakedAssets.map((assetId: string | number) => ({
              asset_id: String(assetId),
              staker: account,
              farm_name: farmName,
              last_claim: (farmRow.last_claim as number) || 0,
            }));
          }
        }
      }
    } catch (e) {
      console.log("[Strategy 4] Failed:", e);
    }
    
    // Strategy 5: Query 'stakes' table with farm scope
    try {
      const stakesData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakes",
        limit: 1000,
      });
      
      console.log(`[Strategy 5] stakes table (${farmName} scope):`, stakesData);
      
      if (stakesData.rows && stakesData.rows.length > 0) {
        console.log("[Strategy 5] Sample row:", JSON.stringify(stakesData.rows[0], null, 2));
        
        const userRows = stakesData.rows.filter((row: Record<string, unknown>) => {
          const rowOwner = row.owner || row.staker || row.user || "";
          return rowOwner === account;
        });
        
        if (userRows.length > 0) {
          console.log(`[Strategy 5] Found ${userRows.length} stakes for ${account}`);
          return userRows.map((row: Record<string, unknown>) => ({
            asset_id: String(row.asset_id || ""),
            staker: account,
            farm_name: farmName,
            last_claim: (row.last_claim as number) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 5] Failed:", e);
    }
    
    // Strategy 6: Query 'stakers' table using secondary index by name (index 2)
    // Some contracts use secondary index to find stakers by wallet name
    try {
      const secondaryData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "stakers",
        index_position: 2,
        key_type: "name",
        lower_bound: account,
        upper_bound: account,
        limit: 10,
      });
      
      console.log(`[Strategy 6] stakers with secondary index:`, secondaryData);
      
      if (secondaryData.rows && secondaryData.rows.length > 0) {
        console.log("[Strategy 6] Sample row:", JSON.stringify(secondaryData.rows[0], null, 2));
        
        // Extract staked assets from the row(s)
        const allAssets: string[] = [];
        for (const row of secondaryData.rows) {
          const stakedAssets = row.staked_assets || row.asset_ids || row.assets || row.nfts || [];
          if (Array.isArray(stakedAssets)) {
            allAssets.push(...stakedAssets.map((a: string | number) => String(a)));
          }
          // Also check if this row itself represents a single staked asset
          if (row.asset_id) {
            allAssets.push(String(row.asset_id));
          }
        }
        
        if (allAssets.length > 0) {
          console.log(`[Strategy 6] Found ${allAssets.length} staked assets via secondary index`);
          return allAssets.map((assetId: string) => ({
            asset_id: assetId,
            staker: account,
            farm_name: farmName,
            last_claim: 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 6] Failed:", e);
    }
    
    // Strategy 7: Query V1 contract (waxdaofarmer) as fallback
    // Some farms may still use the old custodial staking system
    try {
      const v1Data = await fetchTableRows({
        code: "waxdaofarmer",
        scope: farmName,
        table: "stakers",
        lower_bound: account,
        upper_bound: account,
        limit: 1,
      });
      
      console.log(`[Strategy 7] V1 waxdaofarmer stakers table:`, v1Data);
      
      if (v1Data.rows && v1Data.rows.length > 0) {
        const stakerRow = v1Data.rows[0];
        console.log("[Strategy 7] V1 staker row:", JSON.stringify(stakerRow, null, 2));
        
        const stakedAssets = stakerRow.staked_assets || stakerRow.asset_ids || stakerRow.assets || [];
        if (Array.isArray(stakedAssets) && stakedAssets.length > 0) {
          console.log(`[Strategy 7] Found ${stakedAssets.length} staked assets in V1 contract`);
          return stakedAssets.map((assetId: string | number) => ({
            asset_id: String(assetId),
            staker: account,
            farm_name: farmName,
            last_claim: (stakerRow.last_claim as number) || 0,
          }));
        }
      }
    } catch (e) {
      console.log("[Strategy 7] V1 fallback failed:", e);
    }
    
    console.log("No staked NFTs found for", account, "in farm", farmName, "- check console for detailed query results");
    return [];
  } catch (error) {
    console.error("Error fetching user stakes:", error);
    return [];
  }
}

// Stakable template with hourly rate
export interface RewardRate {
  quantity: string;
  contract?: string;
}

export interface StakableTemplate {
  template_id: number;
  collection: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableSchema {
  collection: string;
  schema: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableCollection {
  collection: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

export interface StakableAttribute {
  attribute_name: string;
  attribute_value: string;
  hourly_rate: string;
  hourly_rates?: RewardRate[];
}

// Fetch stakable collections/schemas/templates for a farm
export interface FarmStakableConfig {
  collections: StakableCollection[];
  schemas: StakableSchema[];
  templates: StakableTemplate[];
  attributes: StakableAttribute[];
}

// Helper to fetch collection names for template IDs from AtomicHub
async function fetchTemplateCollections(templateIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (templateIds.length === 0) return map;

  try {
    const ids = templateIds.join(",");
    const response = await fetch(`https://wax.api.atomicassets.io/atomicassets/v1/templates?ids=${ids}&limit=100`);
    const data = await response.json();
    
    if (data.success && data.data) {
      for (const template of data.data) {
        const templateId = parseInt(template.template_id);
        const collection = template.collection?.collection_name || "";
        if (collection) {
          map.set(templateId, collection);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching template collections from AtomicHub:", error);
  }
  
  return map;
}

export async function fetchFarmStakableConfig(farmName: string): Promise<FarmStakableConfig> {
  const config: FarmStakableConfig = {
    collections: [],
    schemas: [],
    templates: [],
    attributes: [],
  };

  try {
    // WaxDAO V2 uses these specific table names:
    // valuesbytemp - template rewards
    // valuesbysch - schema rewards  
    // valuesbycol - collection rewards
    // valuesbyatt - attribute rewards

    // Fetch templates from valuesbytemp
    try {
      const templatesData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbytemp",
        limit: 500,
      });
      
      if (templatesData.rows && templatesData.rows.length > 0) {
        const rawTemplates = templatesData.rows.map((r: Record<string, unknown>) => {
          // Handle reward_values array format: [{quantity: "0.50000000 BLUE", contract: "..."}]
          let hourlyRate = String(r.hourly_rate || r.rate || r.staking_value || r.reward || "0");
          let hourlyRates: RewardRate[] = [];
          
          // Check for reward_values (array format)
          const rewardValues = r.reward_values as Array<{ quantity?: string; contract?: string }> | undefined;
          if (rewardValues && Array.isArray(rewardValues) && rewardValues.length > 0) {
            if (rewardValues[0].quantity) {
              hourlyRate = rewardValues[0].quantity;
            }
            hourlyRates = rewardValues.map(rv => ({
              quantity: rv.quantity || "0",
              contract: rv.contract || "",
            }));
          }
          
          return {
            template_id: Number(r.template_id || r.templateid || r.id || 0),
            collection: String(r.collection_name || r.collection || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
        
        // For templates missing collection, fetch from AtomicHub
        const missingCollectionIds = rawTemplates
          .filter((t: StakableTemplate) => !t.collection)
          .map((t: StakableTemplate) => t.template_id);
        
        if (missingCollectionIds.length > 0) {
          const collectionMap = await fetchTemplateCollections(missingCollectionIds);
          config.templates = rawTemplates.map((t: StakableTemplate) => ({
            ...t,
            collection: t.collection || collectionMap.get(t.template_id) || "",
          }));
        } else {
          config.templates = rawTemplates;
        }
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbytemp table`);
    }

    // Fetch schemas from valuesbysch
    try {
      const schemasData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbysch",
        limit: 500,
      });
      console.log(`[Farm ${farmName}] valuesbysch:`, schemasData);
      
      if (schemasData.rows && schemasData.rows.length > 0) {
        config.schemas = schemasData.rows.map((r: Record<string, unknown>) => {
          // Handle reward_values array format: [{quantity: "0.50000000 BLUE", contract: "..."}]
          let hourlyRate = String(r.hourly_rate || r.rate || r.staking_value || "0");
          let hourlyRates: RewardRate[] = [];
          const rewardValues = r.reward_values as Array<{ quantity?: string; contract?: string }> | undefined;
          if (rewardValues && rewardValues.length > 0) {
            if (rewardValues[0].quantity) {
              hourlyRate = rewardValues[0].quantity;
            }
            hourlyRates = rewardValues.map(rv => ({
              quantity: rv.quantity || "0",
              contract: rv.contract || "",
            }));
          }
          return {
            collection: String(r.collection_name || r.collection || ""),
            schema: String(r.schema_name || r.schema || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbysch table`);
    }

    // Fetch collections from valuesbycol
    try {
      const collectionsData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbycol",
        limit: 500,
      });
      console.log(`[Farm ${farmName}] valuesbycol:`, collectionsData);
      
      if (collectionsData.rows && collectionsData.rows.length > 0) {
        config.collections = collectionsData.rows.map((r: Record<string, unknown>) => {
          // Handle reward_values array format: [{quantity: "0.50000000 BLUE", contract: "..."}]
          let hourlyRate = String(r.hourly_rate || r.rate || r.staking_value || "0");
          let hourlyRates: RewardRate[] = [];
          const rewardValues = r.reward_values as Array<{ quantity?: string; contract?: string }> | undefined;
          if (rewardValues && rewardValues.length > 0) {
            if (rewardValues[0].quantity) {
              hourlyRate = rewardValues[0].quantity;
            }
            hourlyRates = rewardValues.map(rv => ({
              quantity: rv.quantity || "0",
              contract: rv.contract || "",
            }));
          }
          return {
            collection: String(r.collection_name || r.collection || r.name || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbycol table`);
    }

    // Fetch attributes from valuesbyatt
    try {
      const attributesData = await fetchTableRows({
        code: FARM_CONTRACT,
        scope: farmName,
        table: "valuesbyatt",
        limit: 500,
      });
      console.log(`[Farm ${farmName}] valuesbyatt:`, attributesData);
      
      if (attributesData.rows && attributesData.rows.length > 0) {
        config.attributes = attributesData.rows.map((r: Record<string, unknown>) => {
          // Handle reward_values array format: [{quantity: "0.50000000 BLUE", contract: "..."}]
          let hourlyRate = String(r.hourly_rate || r.rate || r.staking_value || "0");
          let hourlyRates: RewardRate[] = [];
          const rewardValues = r.reward_values as Array<{ quantity?: string; contract?: string }> | undefined;
          if (rewardValues && rewardValues.length > 0) {
            if (rewardValues[0].quantity) {
              hourlyRate = rewardValues[0].quantity;
            }
            hourlyRates = rewardValues.map(rv => ({
              quantity: rv.quantity || "0",
              contract: rv.contract || "",
            }));
          }
          return {
            attribute_name: String(r.attribute_name || r.attr_name || r.key || ""),
            attribute_value: String(r.attribute_value || r.attr_value || r.value || ""),
            hourly_rate: hourlyRate,
            hourly_rates: hourlyRates.length > 0 ? hourlyRates : undefined,
          };
        });
      }
    } catch (e) {
      console.log(`[Farm ${farmName}] No valuesbyatt table`);
    }

  } catch (error) {
    console.error("Error fetching farm stakable config:", error);
  }

  return config;
}

// Fetch user's pending rewards for a farm
export interface PendingReward {
  symbol: string;
  amount: number;
  precision: number;
  contract?: string;
}

export async function fetchPendingRewards(account: string, farmName: string): Promise<PendingReward[]> {
  try {
    // Strategy 1: Query stakers table by farmname index (index 3) and filter by user
    const data = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "stakers",
      index_position: 3,
      key_type: "name",
      lower_bound: farmName,
      upper_bound: farmName,
      limit: 500,
    });
    
    console.log("Stakers table for rewards (by farmname index):", data);
    
    if (data.rows && data.rows.length > 0) {
      // Find the row matching this user
      const userRow = data.rows.find((row: Record<string, unknown>) => 
        row.user === account
      );
      
      if (userRow && userRow.claimable_balances && Array.isArray(userRow.claimable_balances)) {
        // Parse the claimable_balances array of { quantity, contract } objects
        return userRow.claimable_balances.map((b: { quantity: string; contract: string }) => {
          const parts = b.quantity.split(" ");
          const amount = parseFloat(parts[0]) || 0;
          const symbol = parts[1] || "";
          const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
          return { symbol, amount, precision };
        });
      }
    }
    
    // Strategy 2: Fallback - query by user index (index 2)
    const data2 = await fetchTableRows({
      code: FARM_CONTRACT,
      scope: FARM_CONTRACT,
      table: "stakers",
      index_position: 2,
      key_type: "name",
      lower_bound: account,
      upper_bound: account,
      limit: 100,
    });
    
    console.log("Stakers table for rewards (by user index):", data2);
    
    if (data2.rows && data2.rows.length > 0) {
      const farmRow = data2.rows.find((row: Record<string, unknown>) => 
        row.farmname === farmName || row.farm_name === farmName
      );
      
      if (farmRow && farmRow.claimable_balances && Array.isArray(farmRow.claimable_balances)) {
        return farmRow.claimable_balances.map((b: { quantity: string; contract: string }) => {
          const parts = b.quantity.split(" ");
          const amount = parseFloat(parts[0]) || 0;
          const symbol = parts[1] || "";
          const precision = parts[0].includes(".") ? parts[0].split(".")[1]?.length || 0 : 0;
          return { symbol, amount, precision };
        });
      }
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching pending rewards:", error);
    return [];
  }
}

// Update the NFTStaking component to use the new interfaces
export function getCollectionNames(config: FarmStakableConfig): string[] {
  const collections = new Set<string>();
  
  config.collections.forEach(c => collections.add(c.collection));
  config.schemas.forEach(s => collections.add(s.collection));
  config.templates.forEach(t => collections.add(t.collection));
  
  return Array.from(collections);
}
