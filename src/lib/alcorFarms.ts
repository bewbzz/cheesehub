// Alcor Farms library for interacting with Alcor Exchange API and swap.alcor contract
import { waxRpcCall } from './waxRpcFallback';

// Contract name for transactions
const ALCOR_SWAP_CONTRACT = 'swap.alcor';
const ALCOR_API_BASE = 'https://wax.alcor.exchange/api/v2';

// Types for Alcor farm data from API
export interface AlcorApiFarmPosition {
  posId: number;
  stakingWeight: string;
  rewards: number;
  userRewardPerTokenPaid: string;
  incentiveId: number;
  incentive: number;
  pool: number;
  poolStats: number;
  farmedReward: string; // e.g., "7.0782 CHEESE"
  userSharePercent: number;
  dailyRewards: string; // e.g., "22.541921902499997 CHEESE"
}

export interface AlcorApiPosition {
  id: number;
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  pool: number;
  inRange: boolean;
  amountA: string; // e.g., "3.69155112 PASTA"
  amountB: string; // e.g., "7.28122035 WAX"
  feesA: string;
  feesB: string;
  totalValue: number;
}

export interface AlcorFarmPosition {
  positionId: number;
  incentiveId: number;
  poolId: number;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokenA: {
    contract: string;
    symbol: string;
    amount: number;
  };
  tokenB: {
    contract: string;
    symbol: string;
    amount: number;
  };
  rewardToken: {
    contract: string;
    symbol: string;
    precision: number;
  };
  pendingReward: number;
  rewardPerSecond: number;
  rewardShare: number;
  dailyEarnRate: number;
  dailyRewardsDisplay: string;
  incentiveEndsAt: number;
  isInRange: boolean;
  fee: number;
  lastUpdate: number;
  farmedRewardDisplay: string;
}

// Unstaked incentive that a position could be staked to
export interface UnstakedIncentive {
  incentiveId: number;
  poolId: number;
  rewardToken: {
    contract: string;
    symbol: string;
    precision: number;
  };
  totalReward: number;
  rewardPerDay: number;
}

// Parse WAX asset string (e.g., "123.45678901 WAX")
function parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } {
  if (!assetStr) return { amount: 0, symbol: '', precision: 0 };
  const parts = assetStr.trim().split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const decimalParts = parts[0].split('.');
  const precision = decimalParts[1]?.length || 0;
  return { amount, symbol, precision };
}

/**
 * Fetch user's staked farm positions from Alcor API
 */
export async function fetchUserStakedFarms(accountName: string): Promise<AlcorApiFarmPosition[]> {
  try {
    const response = await fetch(`${ALCOR_API_BASE}/account/${accountName}/farms`);
    if (!response.ok) {
      console.warn(`Alcor farms API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch Alcor farms:', error);
    return [];
  }
}

/**
 * Fetch user's LP positions from Alcor API
 */
export async function fetchUserPositions(accountName: string): Promise<AlcorApiPosition[]> {
  try {
    const response = await fetch(`${ALCOR_API_BASE}/account/${accountName}/positions`);
    if (!response.ok) {
      console.warn(`Alcor positions API returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch Alcor positions:', error);
    return [];
  }
}

/**
 * Fetch pool details from Alcor API
 */
export async function fetchPoolDetails(poolId: number): Promise<any | null> {
  try {
    const response = await fetch(`${ALCOR_API_BASE}/swap/pools/${poolId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch pool ${poolId}:`, error);
    return null;
  }
}

/**
 * Fetch incentive details from blockchain to get reward token contract
 */
export async function fetchIncentiveDetails(incentiveId: number): Promise<any | null> {
  try {
    // Query the incentives table on swap.alcor contract by primary key (id)
    const result = await waxRpcCall('/v1/chain/get_table_rows', {
      json: true,
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'incentives',
      lower_bound: incentiveId,
      upper_bound: incentiveId,
      limit: 1,
    }) as { rows?: any[] };
    
    if (!result?.rows?.[0]) return null;
    
    const incentive = result.rows[0];
    // Transform to expected format
    return {
      id: incentive.id,
      pool: incentive.poolId,
      reward: {
        contract: incentive.rewardToken?.contract || '',
        quantity: incentive.rewardToken?.quantity || '0.00000000 TOKEN',
      },
      periodFinish: incentive.periodFinish,
    };
  } catch (error) {
    console.error(`Failed to fetch incentive ${incentiveId}:`, error);
    return null;
  }
}

/**
 * Fetch all active incentives for a specific pool from blockchain
 */
export async function fetchPoolIncentives(poolId: number): Promise<any[]> {
  console.log(`[fetchPoolIncentives] Fetching incentives for pool ${poolId}`);
  try {
    // Query the incentives table on swap.alcor contract using secondary index (by pool)
    const result = await waxRpcCall('/v1/chain/get_table_rows', {
      json: true,
      code: ALCOR_SWAP_CONTRACT,
      scope: ALCOR_SWAP_CONTRACT,
      table: 'incentives',
      index_position: 2, // Secondary index by poolId
      key_type: 'i64',
      lower_bound: poolId,
      upper_bound: poolId,
      limit: 100,
    }) as { rows?: any[] };
    
    console.log(`[fetchPoolIncentives] Pool ${poolId} returned ${result?.rows?.length || 0} rows`);
    
    if (!result?.rows) return [];
    
    // Filter for active incentives (not finished - check if endTime > now)
    const now = Math.floor(Date.now() / 1000);
    const active = result.rows.filter((incentive: any) => {
      // Check if incentive is still active
      const endTime = incentive.periodFinish || incentive.endTime || 0;
      return endTime > now;
    });
    
    console.log(`[fetchPoolIncentives] Pool ${poolId}: ${active.length} active incentives out of ${result.rows.length} total`);
    return active;
  } catch (error) {
    console.error(`Failed to fetch pool ${poolId} incentives from chain:`, error);
    return [];
  }
}

/**
 * Combine farm positions with LP position details
 */
export async function fetchUserStakedFarmsWithDetails(accountName: string): Promise<AlcorFarmPosition[]> {
  // Fetch farms and positions in parallel
  const [farmPositions, lpPositions] = await Promise.all([
    fetchUserStakedFarms(accountName),
    fetchUserPositions(accountName),
  ]);

  if (farmPositions.length === 0) {
    return [];
  }

  // Create a map of position ID to LP position details
  const positionMap = new Map<number, AlcorApiPosition>();
  lpPositions.forEach(pos => positionMap.set(pos.id, pos));

  // Fetch unique pool details and incentive details in parallel
  const uniquePoolIds = [...new Set(farmPositions.map(f => f.pool))];
  const uniqueIncentiveIds = [...new Set(farmPositions.map(f => f.incentiveId))];
  
  const poolDetails = new Map<number, any>();
  const incentiveDetails = new Map<number, any>();
  
  await Promise.all([
    // Fetch pool details
    ...uniquePoolIds.map(async (poolId) => {
      const pool = await fetchPoolDetails(poolId);
      if (pool) poolDetails.set(poolId, pool);
    }),
    // Fetch incentive details for reward token contracts
    ...uniqueIncentiveIds.map(async (incentiveId) => {
      const incentive = await fetchIncentiveDetails(incentiveId);
      if (incentive) incentiveDetails.set(incentiveId, incentive);
    }),
  ]);

  // Combine data
  const result: AlcorFarmPosition[] = [];

  for (const farm of farmPositions) {
    const lpPosition = positionMap.get(farm.posId);
    const pool = poolDetails.get(farm.pool);
    const incentive = incentiveDetails.get(farm.incentiveId);

    // Parse farmed reward (e.g., "7.0782 CHEESE")
    const farmedReward = parseAsset(farm.farmedReward);
    const dailyRewards = parseAsset(farm.dailyRewards);

    // Parse LP position amounts
    const amountA = lpPosition ? parseAsset(lpPosition.amountA) : { amount: 0, symbol: 'TOKEN A', precision: 4 };
    const amountB = lpPosition ? parseAsset(lpPosition.amountB) : { amount: 0, symbol: 'TOKEN B', precision: 4 };

    // Get token contracts from pool data
    const tokenAContract = pool?.tokenA?.contract || '';
    const tokenBContract = pool?.tokenB?.contract || '';
    // Get reward contract from incentive details
    const rewardContract = incentive?.reward?.contract || '';

    result.push({
      positionId: farm.posId,
      incentiveId: farm.incentiveId,
      poolId: farm.pool,
      liquidity: farm.stakingWeight,
      tickLower: lpPosition?.tickLower ?? 0,
      tickUpper: lpPosition?.tickUpper ?? 0,
      tokenA: {
        contract: tokenAContract,
        symbol: amountA.symbol,
        amount: amountA.amount,
      },
      tokenB: {
        contract: tokenBContract,
        symbol: amountB.symbol,
        amount: amountB.amount,
      },
      rewardToken: {
        contract: rewardContract,
        symbol: farmedReward.symbol,
        precision: farmedReward.precision,
      },
      pendingReward: farmedReward.amount,
      rewardPerSecond: dailyRewards.amount / 86400,
      rewardShare: farm.userSharePercent,
      dailyEarnRate: dailyRewards.amount,
      dailyRewardsDisplay: farm.dailyRewards,
      incentiveEndsAt: 0, // API doesn't provide this directly
      isInRange: lpPosition?.inRange ?? true,
      fee: 0, // Would need pool data for this
      lastUpdate: Math.floor(Date.now() / 1000),
      farmedRewardDisplay: farm.farmedReward,
    });
  }

  return result;
}

// Parse WAX asset string to get precision
function getAssetPrecision(assetStr: string): number {
  if (!assetStr) return 8;
  const parts = assetStr.trim().split(' ');
  const decimalParts = parts[0].split('.');
  return decimalParts[1]?.length || 0;
}

/**
 * Fetch unstaked incentives for a position (incentives available but not staked to)
 */
export async function fetchUnstakedIncentivesForPosition(
  positionId: number,
  poolId: number,
  stakedIncentiveIds: number[]
): Promise<UnstakedIncentive[]> {
  const allIncentives = await fetchPoolIncentives(poolId);
  
  // Filter out already staked incentives
  const unstakedIncentives = allIncentives.filter(
    (incentive: any) => !stakedIncentiveIds.includes(incentive.id)
  );
  
  return unstakedIncentives.map((incentive: any) => {
    const rewardAsset = incentive.reward?.quantity || '0.00000000 TOKEN';
    const rewardParts = rewardAsset.split(' ');
    const precision = getAssetPrecision(rewardAsset);
    
    return {
      incentiveId: incentive.id,
      poolId: incentive.pool || poolId,
      rewardToken: {
        contract: incentive.reward?.contract || '',
        symbol: rewardParts[1] || 'TOKEN',
        precision,
      },
      totalReward: parseFloat(rewardParts[0]) || 0,
      rewardPerDay: incentive.rewardPerDay || 0,
    };
  });
}

// ============= Transaction Builders =============

export interface TransactionAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

/**
 * Build claim rewards action for a specific incentive
 * Requires both incentiveId and posId (position ID)
 */
export function buildClaimRewardsAction(
  accountName: string,
  claims: Array<{ incentiveId: number; posId: number }>
): TransactionAction[] {
  return claims.map(({ incentiveId, posId }) => ({
    account: ALCOR_SWAP_CONTRACT,
    name: 'getreward',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      incentiveId,
      posId,
    },
  }));
}

/**
 * Build unstake action
 */
export function buildUnstakeAction(
  accountName: string,
  incentiveId: number,
  positionId: number
): TransactionAction {
  return {
    account: ALCOR_SWAP_CONTRACT,
    name: 'unstake',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      owner: accountName,
      incentiveId,
      posId: positionId,
    },
  };
}

/**
 * Build stake action
 */
export function buildStakeAction(
  accountName: string,
  incentiveId: number,
  positionId: number
): TransactionAction {
  return {
    account: ALCOR_SWAP_CONTRACT,
    name: 'stake',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      owner: accountName,
      incentiveId,
      positionId,
    },
  };
}

/**
 * Build increase liquidity action (add to LP position)
 * NOTE: Alcor uses concentrated liquidity (Uniswap V3 style).
 * To add liquidity to an existing position, use the addliquid action with the same tick range.
 * This requires knowing the position's tickLower and tickUpper values.
 */
export function buildIncreaseLiquidityAction(
  accountName: string,
  positionId: number,
  poolId: number,
  tickLower: number,
  tickUpper: number,
  tokenAContract: string,
  tokenAQuantity: string,
  tokenBContract: string,
  tokenBQuantity: string
): TransactionAction[] {
  // Parse amounts for min values (apply 10% slippage like Alcor does)
  const slippageMultiplier = 0.90;
  
  const tokenAAmount = parseFloat(tokenAQuantity.split(' ')[0]);
  const tokenASymbol = tokenAQuantity.split(' ')[1];
  const tokenADecimals = tokenAQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenA = (tokenAAmount * slippageMultiplier).toFixed(tokenADecimals) + ' ' + tokenASymbol;
  
  const tokenBAmount = parseFloat(tokenBQuantity.split(' ')[0]);
  const tokenBSymbol = tokenBQuantity.split(' ')[1];
  const tokenBDecimals = tokenBQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenB = (tokenBAmount * slippageMultiplier).toFixed(tokenBDecimals) + ' ' + tokenBSymbol;

  return [
    // Transfer token A with "deposit" memo (required by Alcor)
    {
      account: tokenAContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenAQuantity,
        memo: 'deposit',
      },
    },
    // Transfer token B with "deposit" memo (required by Alcor)
    {
      account: tokenBContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenBQuantity,
        memo: 'deposit',
      },
    },
    // Add liquidity with same tick range as existing position
    // deadline: 0 means no deadline (like Alcor uses)
    {
      account: ALCOR_SWAP_CONTRACT,
      name: 'addliquid',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        poolId,
        owner: accountName,
        tokenADesired: tokenAQuantity,
        tokenBDesired: tokenBQuantity,
        tickLower,
        tickUpper,
        tokenAMin: minTokenA,
        tokenBMin: minTokenB,
        deadline: 0,
      },
    },
  ];
}
