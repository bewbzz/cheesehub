// Nullers Leaderboard - fetches logburn actions from Hyperion and aggregates stats

const HYPERION_ENDPOINT = 'https://wax.eosusa.io/v2/history/get_actions';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 10000; // safety cap

export interface LogburnAction {
  caller: string;
  cheese_burned: string;
  cheese_reward: string;
  wax_claimed: string;
}

export interface NullerStats {
  rank: number;
  account: string;
  burns: number;
  cheeseNulled: number;
  rewardsEarned: number;
}

export type SortMode = 'cheese' | 'burns' | 'rewards';

interface HyperionAction {
  act: {
    data: {
      caller: string;
      cheese_burned: string;
      cheese_reward: string;
      wax_claimed: string;
    };
  };
}

interface HyperionResponse {
  actions: HyperionAction[];
  total: { value: number };
}

export async function fetchLogburnActions(): Promise<LogburnAction[]> {
  const allActions: LogburnAction[] = [];
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    const url = `${HYPERION_ENDPOINT}?act.account=cheeseburner&act.name=logburn&limit=${BATCH_SIZE}&skip=${skip}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);

    const data: HyperionResponse = await response.json();
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    for (const action of actions) {
      const d = action.act?.data;
      if (d?.caller) {
        allActions.push({
          caller: d.caller,
          cheese_burned: d.cheese_burned || '0',
          cheese_reward: d.cheese_reward || '0',
          wax_claimed: d.wax_claimed || '0',
        });
      }
    }

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return allActions;
}

export function aggregateNullerStats(actions: LogburnAction[], sortBy: SortMode = 'cheese'): NullerStats[] {
  const map = new Map<string, { burns: number; cheeseNulled: number; rewardsEarned: number }>();

  for (const action of actions) {
    const existing = map.get(action.caller) || { burns: 0, cheeseNulled: 0, rewardsEarned: 0 };
    existing.burns += 1;
    existing.cheeseNulled += parseFloat(action.cheese_burned) || 0;
    existing.rewardsEarned += parseFloat(action.cheese_reward) || 0;
    map.set(action.caller, existing);
  }

  const entries = Array.from(map.entries()).map(([account, stats]) => ({
    rank: 0,
    account,
    ...stats,
  }));

  return sortNullers(entries, sortBy);
}

export function sortNullers(entries: NullerStats[], sortBy: SortMode): NullerStats[] {
  const sortFn = sortBy === 'burns'
    ? (a: NullerStats, b: NullerStats) => b.burns - a.burns
    : sortBy === 'rewards'
      ? (a: NullerStats, b: NullerStats) => b.rewardsEarned - a.rewardsEarned
      : (a: NullerStats, b: NullerStats) => b.cheeseNulled - a.cheeseNulled;

  const sorted = [...entries].sort(sortFn).slice(0, 10);
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
