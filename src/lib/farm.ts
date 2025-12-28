// WaxDAO V2 Farm Contract Interface
// Contract: farms.waxdao

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
      memo: "|farm_payment|",
    },
  };
}

// Build action for paying farm creation fee with WAXDAO
export function buildFarmCreationFeeWaxdaoAction(sender: string) {
  return {
    account: "token.waxdao",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: FARM_CONTRACT,
      quantity: FARM_CREATION_FEES.WAXDAO,
      memo: "|farm_payment|",
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
      memo: "|farm_payment|",
    },
  };
}

// Build action for creating farm
export function buildCreateFarmAction(
  creator: string,
  farmName: string,
  logo: string,
  payoutInterval: number,
  expiration: number,
  rewardTokens: RewardToken[]
) {
  return {
    account: FARM_CONTRACT,
    name: "createfarm",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      logo,
      payout_interval: payoutInterval,
      expiration,
      reward_tokens: rewardTokens.map(t => ({
        contract: t.contract,
        symbol: `${t.precision},${t.symbol}`,
      })),
    },
  };
}

// Build action for adding a collection to the farm
export function buildAddCollectionAction(
  creator: string,
  farmName: string,
  collection: string,
  rewardPerHour: string
) {
  return {
    account: FARM_CONTRACT,
    name: "addcollection",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      collection_name: collection,
      hourly_rate: rewardPerHour,
    },
  };
}

// Build action for adding a schema to the farm
export function buildAddSchemaAction(
  creator: string,
  farmName: string,
  collection: string,
  schema: string,
  rewardPerHour: string
) {
  return {
    account: FARM_CONTRACT,
    name: "addschema",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      collection_name: collection,
      schema_name: schema,
      hourly_rate: rewardPerHour,
    },
  };
}

// Build action for adding a template to the farm
export function buildAddTemplateAction(
  creator: string,
  farmName: string,
  templateId: string,
  rewardPerHour: string
) {
  return {
    account: FARM_CONTRACT,
    name: "addtemplate",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      template_id: parseInt(templateId),
      hourly_rate: rewardPerHour,
    },
  };
}

// Build action for adding an attribute to the farm
export function buildAddAttributeAction(
  creator: string,
  farmName: string,
  attributeKey: string,
  attributeValue: string,
  rewardPerHour: string
) {
  return {
    account: FARM_CONTRACT,
    name: "addattribute",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      attribute_key: attributeKey,
      attribute_value: attributeValue,
      hourly_rate: rewardPerHour,
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

// Build action for extending farm expiration
export function buildExtendFarmAction(
  creator: string,
  farmName: string,
  newExpiration: number
) {
  return {
    account: FARM_CONTRACT,
    name: "extendfarm",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      farm_name: farmName,
      new_expiration: newExpiration,
    },
  };
}

// Build action for staking NFTs to a farm
export function buildStakeNftsAction(
  staker: string,
  farmName: string,
  assetIds: string[]
) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      from: staker,
      to: FARM_CONTRACT,
      asset_ids: assetIds,
      memo: `|stake|${farmName}|`,
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
      staker,
      farm_name: farmName,
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
      staker,
      farm_name: farmName,
    },
  };
}

// Fetch all V2 farms from the contract
export async function fetchAllFarms(): Promise<FarmInfo[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: "farms",
          limit: 200,
        }),
      }
    );

    const data = await response.json();
    console.log("Raw farm data:", data);

    const now = Math.floor(Date.now() / 1000);

    return (data.rows || []).map((row: Record<string, unknown>, index: number) => {
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
    return allFarms.filter(farm => farm.creator === account);
  } catch (error) {
    console.error("Error fetching user farms:", error);
    return [];
  }
}

// Fetch details for a specific farm
export async function fetchFarmDetails(farmName: string): Promise<FarmInfo | null> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: FARM_CONTRACT,
          scope: FARM_CONTRACT,
          table: "farms",
          lower_bound: farmName,
          upper_bound: farmName,
          limit: 1,
        }),
      }
    );

    const data = await response.json();
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
      
      // Parse reward pools
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
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: FARM_CONTRACT,
          scope: farmName,
          table: "stakes",
          index_position: 2,
          key_type: "name",
          lower_bound: account,
          upper_bound: account,
          limit: 100,
        }),
      }
    );

    const data = await response.json();
    return (data.rows || []).map((row: Record<string, unknown>) => ({
      asset_id: row.asset_id as string || "",
      staker: row.staker as string || "",
      farm_name: farmName,
      last_claim: row.last_claim as number || 0,
    }));
  } catch (error) {
    console.error("Error fetching user stakes:", error);
    return [];
  }
}

// Validate farm name format (12 chars, a-z, 1-5, periods)
export function validateFarmName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: "Farm name is required" };
  }
  if (name.length > 12) {
    return { valid: false, error: "Farm name must be 12 characters or less" };
  }
  if (!/^[a-z1-5.]+$/.test(name)) {
    return { valid: false, error: "Farm name can only contain a-z, 1-5, and periods" };
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    return { valid: false, error: "Farm name cannot start or end with a period" };
  }
  if (name.includes("..")) {
    return { valid: false, error: "Farm name cannot contain consecutive periods" };
  }
  return { valid: true };
}
