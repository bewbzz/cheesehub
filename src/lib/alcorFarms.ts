// Alcor Farms library for interacting with Alcor Exchange API and swap.alcor contract

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
 * Fetch incentive details from Alcor API to get reward token contract
 */
export async function fetchIncentiveDetails(incentiveId: number): Promise<any | null> {
  try {
    const response = await fetch(`${ALCOR_API_BASE}/farms/${incentiveId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch incentive ${incentiveId}:`, error);
    return null;
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

// ============= Transaction Builders =============

export interface TransactionAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

/**
 * Build claim rewards action for a specific incentive
 */
export function buildClaimRewardsAction(
  accountName: string,
  incentiveIds: number[]
): TransactionAction[] {
  return incentiveIds.map(incentiveId => ({
    account: ALCOR_SWAP_CONTRACT,
    name: 'getreward',
    authorization: [{ actor: accountName, permission: 'active' }],
    data: {
      owner: accountName,
      incentiveId,
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
      positionId,
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
 */
export function buildIncreaseLiquidityAction(
  accountName: string,
  positionId: number,
  tokenAContract: string,
  tokenAQuantity: string,
  tokenBContract: string,
  tokenBQuantity: string,
  slippage: number = 0.5
): TransactionAction[] {
  // Calculate min amounts with slippage
  const slippageMultiplier = 1 - slippage / 100;
  
  const tokenAAmount = parseFloat(tokenAQuantity.split(' ')[0]);
  const tokenASymbol = tokenAQuantity.split(' ')[1];
  const tokenADecimals = tokenAQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenA = (tokenAAmount * slippageMultiplier).toFixed(tokenADecimals) + ' ' + tokenASymbol;
  
  const tokenBAmount = parseFloat(tokenBQuantity.split(' ')[0]);
  const tokenBSymbol = tokenBQuantity.split(' ')[1];
  const tokenBDecimals = tokenBQuantity.split(' ')[0].split('.')[1]?.length || 0;
  const minTokenB = (tokenBAmount * slippageMultiplier).toFixed(tokenBDecimals) + ' ' + tokenBSymbol;

  return [
    // Transfer token A
    {
      account: tokenAContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenAQuantity,
        memo: '',
      },
    },
    // Transfer token B
    {
      account: tokenBContract,
      name: 'transfer',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        from: accountName,
        to: ALCOR_SWAP_CONTRACT,
        quantity: tokenBQuantity,
        memo: '',
      },
    },
    // Add liquidity to existing position
    {
      account: ALCOR_SWAP_CONTRACT,
      name: 'addliqaliid',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        owner: accountName,
        posId: positionId,
        desiredA: tokenAQuantity,
        desiredB: tokenBQuantity,
        minA: minTokenA,
        minB: minTokenB,
      },
    },
  ];
}
