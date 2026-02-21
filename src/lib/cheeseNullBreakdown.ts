// Fetches per-contract null breakdown from Hyperion

const HYPERION_ENDPOINT = 'https://wax.eosusa.io/v2/history/get_actions';
const BATCH_SIZE = 1000;
const MAX_ACTIONS = 50000;

const NULL_CONTRACTS = ['cheeseburner', 'cheesefeefee', 'cheesepowerz'] as const;

export interface NullBreakdownEntry {
  contract: string;
  amount: number;
  percent: number;
}

function parseAsset(str: string): number {
  if (!str) return 0;
  return parseFloat(str.split(' ')[0]) || 0;
}

async function fetchContractNulled(account: string): Promise<number> {
  let total = 0;
  let skip = 0;

  while (skip < MAX_ACTIONS) {
    const url = `${HYPERION_ENDPOINT}?act.account=cheeseburger&act.name=transfer&transfer.from=${account}&transfer.to=eosio.null&limit=${BATCH_SIZE}&skip=${skip}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Hyperion API error: ${response.status}`);

    const data = await response.json();
    const actions = data.actions;

    if (!actions || actions.length === 0) break;

    for (const action of actions) {
      const quantity = action.act?.data?.quantity;
      if (quantity) {
        total += parseAsset(quantity);
      }
    }

    if (actions.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }

  return total;
}

export async function fetchNullBreakdown(): Promise<NullBreakdownEntry[]> {
  const results = await Promise.all(
    NULL_CONTRACTS.map(async (contract) => ({
      contract,
      amount: await fetchContractNulled(contract),
    }))
  );

  const grandTotal = results.reduce((sum, r) => sum + r.amount, 0);

  return results.map((r) => ({
    ...r,
    percent: grandTotal > 0 ? (r.amount / grandTotal) * 100 : 0,
  }));
}
