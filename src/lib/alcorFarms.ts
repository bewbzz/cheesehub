// Alcor Farms library for interacting with swap.alcor contract
import { fetchTableRows } from './waxRpcFallback';

// Contract and table names
const ALCOR_SWAP_CONTRACT = 'swap.alcor';

// Types for Alcor farm data
export interface AlcorIncentive {
  id: number;
  creator: string;
  poolId: number;
  rewardToken: {
    contract: string;
    quantity: string;
    symbol: string;
    precision: number;
    amount: number;
  };
  totalReward: number;
  rewardPerSecond: number;
  startTime: number;
  endTime: number;
  totalStakedLiquidity: string;
  isActive: boolean;
}

export interface AlcorStakingPosition {
  id: number;
  owner: string;
  incentiveId: number;
  positionId: number;
  liquidity: string;
  stakedAt: number;
}

export interface AlcorStakeState {
  owner: string;
  incentiveId: number;
  positionId: number;
  liquidity: string;
  rewardPerLiquidityLast: string;
  pendingReward: number;
  lastUpdate: number;
}

export interface AlcorPosition {
  id: number;
  owner: string;
  pool: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
}

export interface AlcorPool {
  id: number;
  tokenA: {
    contract: string;
    quantity: string;
    symbol: string;
  };
  tokenB: {
    contract: string;
    quantity: string;
    symbol: string;
  };
  fee: number;
  sqrtPriceX64: string;
  tick: number;
  liquidity: string;
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
  incentiveEndsAt: number;
  isInRange: boolean;
  fee: number;
  lastUpdate: number;
}

// Parse WAX asset string (e.g., "123.45678901 WAX")
function parseAsset(assetStr: string): { amount: number; symbol: string; precision: number } {
  if (!assetStr) return { amount: 0, symbol: '', precision: 0 };
  const parts = assetStr.split(' ');
  const amount = parseFloat(parts[0]) || 0;
  const symbol = parts[1] || '';
  const decimalParts = parts[0].split('.');
  const precision = decimalParts[1]?.length || 0;
  return { amount, symbol, precision };
}

// Parse extended symbol (e.g., "8,WAX@eosio.token")
function parseExtendedSymbol(sym: string): { precision: number; symbol: string; contract: string } {
  const [precSym, contract] = sym.split('@');
  const [precision, symbol] = precSym.split(',');
  return {
    precision: parseInt(precision) || 0,
    symbol: symbol || '',
    contract: contract || '',
  };
}

/**
 * Fetch all incentives (farms) from swap.alcor
 */
export async function fetchIncentives(limit: number = 100): Promise<AlcorIncentive[]> {
  const result = await fetchTableRows<any>({
    code: ALCOR_SWAP_CONTRACT,
    scope: ALCOR_SWAP_CONTRACT,
    table: 'incentives',
    limit,
  });

  const now = Math.floor(Date.now() / 1000);

  return result.rows.map((row: any) => {
    const rewardParsed = parseAsset(row.reward?.quantity || '');
    const extSym = parseExtendedSymbol(row.reward?.extended_symbol || row.rewardToken?.sym || '');
    
    const startTime = row.startTime || 0;
    const endTime = row.endTime || 0;
    const duration = endTime - startTime;
    const rewardPerSecond = duration > 0 ? rewardParsed.amount / duration : 0;

    return {
      id: row.id,
      creator: row.creator || '',
      poolId: row.poolId || 0,
      rewardToken: {
        contract: row.reward?.contract || extSym.contract,
        quantity: row.reward?.quantity || '',
        symbol: rewardParsed.symbol || extSym.symbol,
        precision: rewardParsed.precision || extSym.precision,
        amount: rewardParsed.amount,
      },
      totalReward: rewardParsed.amount,
      rewardPerSecond,
      startTime,
      endTime,
      totalStakedLiquidity: row.stakedLiquidity || '0',
      isActive: now >= startTime && now <= endTime,
    };
  });
}

/**
 * Fetch user's staked positions in farms
 */
export async function fetchUserStakedPositions(accountName: string): Promise<AlcorStakingPosition[]> {
  const result = await fetchTableRows<any>({
    code: ALCOR_SWAP_CONTRACT,
    scope: ALCOR_SWAP_CONTRACT,
    table: 'stakingpos',
    index_position: 2,
    key_type: 'name',
    lower_bound: accountName,
    upper_bound: accountName,
    limit: 100,
  });

  return result.rows.map((row: any) => ({
    id: row.id,
    owner: row.owner,
    incentiveId: row.incentiveId,
    positionId: row.positionId,
    liquidity: row.liquidity || '0',
    stakedAt: row.stakedAt || 0,
  }));
}

/**
 * Fetch stake state for user's staked position (contains pending rewards)
 */
export async function fetchStakeState(incentiveId: number, positionId: number): Promise<AlcorStakeState | null> {
  // Stakes table is scoped by incentive ID
  const result = await fetchTableRows<any>({
    code: ALCOR_SWAP_CONTRACT,
    scope: String(incentiveId),
    table: 'stakes',
    lower_bound: String(positionId),
    upper_bound: String(positionId),
    limit: 1,
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const pendingParsed = parseAsset(row.pendingReward || '0');

  return {
    owner: row.owner || '',
    incentiveId,
    positionId: row.positionId || positionId,
    liquidity: row.liquidity || '0',
    rewardPerLiquidityLast: row.rewardPerLiquidityLast || '0',
    pendingReward: pendingParsed.amount,
    lastUpdate: row.lastUpdate || 0,
  };
}

/**
 * Fetch LP position details
 */
export async function fetchPosition(positionId: number): Promise<AlcorPosition | null> {
  const result = await fetchTableRows<any>({
    code: ALCOR_SWAP_CONTRACT,
    scope: ALCOR_SWAP_CONTRACT,
    table: 'positions',
    lower_bound: String(positionId),
    upper_bound: String(positionId),
    limit: 1,
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    owner: row.owner,
    pool: row.pool,
    tickLower: row.tickLower,
    tickUpper: row.tickUpper,
    liquidity: row.liquidity || '0',
  };
}

/**
 * Fetch pool details
 */
export async function fetchPool(poolId: number): Promise<AlcorPool | null> {
  const result = await fetchTableRows<any>({
    code: ALCOR_SWAP_CONTRACT,
    scope: ALCOR_SWAP_CONTRACT,
    table: 'pools',
    lower_bound: String(poolId),
    upper_bound: String(poolId),
    limit: 1,
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const tokenAParsed = parseAsset(row.tokenA?.quantity || '');
  const tokenBParsed = parseAsset(row.tokenB?.quantity || '');

  return {
    id: row.id,
    tokenA: {
      contract: row.tokenA?.contract || '',
      quantity: row.tokenA?.quantity || '',
      symbol: tokenAParsed.symbol,
    },
    tokenB: {
      contract: row.tokenB?.contract || '',
      quantity: row.tokenB?.quantity || '',
      symbol: tokenBParsed.symbol,
    },
    fee: row.fee || 0,
    sqrtPriceX64: row.sqrtPriceX64 || '0',
    tick: row.currSlot?.tick || 0,
    liquidity: row.currSlot?.liquidity || '0',
  };
}

/**
 * Calculate pending reward based on time elapsed
 */
export function calculateLiveReward(
  stakeState: AlcorStakeState,
  incentive: AlcorIncentive,
  currentTime: number
): number {
  if (!incentive.isActive) return stakeState.pendingReward;
  
  const elapsedSeconds = Math.max(0, currentTime - stakeState.lastUpdate);
  const totalStaked = BigInt(incentive.totalStakedLiquidity || '1');
  const userLiquidity = BigInt(stakeState.liquidity || '0');
  
  if (totalStaked === BigInt(0)) return stakeState.pendingReward;
  
  // Calculate user's share of rewards per second
  const userShare = Number(userLiquidity) / Number(totalStaked);
  const additionalReward = incentive.rewardPerSecond * elapsedSeconds * userShare;
  
  return stakeState.pendingReward + additionalReward;
}

/**
 * Check if position is in active price range
 */
export function isPositionInRange(position: AlcorPosition, pool: AlcorPool): boolean {
  return pool.tick >= position.tickLower && pool.tick < position.tickUpper;
}

// ============= Transaction Builders =============

export interface TransactionAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

/**
 * Build claim rewards action
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
