const HYPERION_ENDPOINT = 'https://wax.eosusa.io/v2/history/get_actions';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 10000;

export interface PowerupTransferAction {
  from: string;
  quantity: string;
}

export interface PowerupLeaderStats {
  rank: number;
  account: string;
  powerups: number;
  cheeseBurned: number;
}

export type PowerupSortMode = 'cheese' | 'powerups';

interface HyperionAction {
  act: {
    data: {
      from: string;
      to: string;
      quantity: string;
      memo: string;
    };
  };
}

interface HyperionResponse {
  actions: HyperionAction[];
  total: { value: number };
}

export async function fetchPowerupTransfers(): Promise<PowerupTransferAction[]> {
  const allActions: PowerupTransferAction[] = [];
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    const url = `${HYPERION_ENDPOINT}?act.account=cheeseburger&act.name=transfer&act.data.to=cheesepowerz&limit=${BATCH_SIZE}&skip=${skip}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);

    const data: HyperionResponse = await response.json();
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    for (const action of actions) {
      const d = action.act?.data;
      if (d?.from && d?.quantity) {
        allActions.push({
          from: d.from,
          quantity: d.quantity,
        });
      }
    }

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return allActions;
}

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

export function aggregatePowerupStats(actions: PowerupTransferAction[], sortBy: PowerupSortMode = 'cheese'): PowerupLeaderStats[] {
  const map = new Map<string, { powerups: number; cheeseBurned: number }>();

  for (const action of actions) {
    const existing = map.get(action.from) || { powerups: 0, cheeseBurned: 0 };
    existing.powerups += 1;
    existing.cheeseBurned += parseAsset(action.quantity);
    map.set(action.from, existing);
  }

  const entries = Array.from(map.entries()).map(([account, stats]) => ({
    rank: 0,
    account,
    ...stats,
  }));

  const sortFn = sortBy === 'powerups'
    ? (a: PowerupLeaderStats, b: PowerupLeaderStats) => b.powerups - a.powerups
    : (a: PowerupLeaderStats, b: PowerupLeaderStats) => b.cheeseBurned - a.cheeseBurned;

  const sorted = [...entries].sort(sortFn).slice(0, 10);
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
