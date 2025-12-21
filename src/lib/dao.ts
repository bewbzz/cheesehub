// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

export const DAO_CONTRACT = "dao.waxdao";

// DAO types from the contract
export const DAO_TYPES: Record<number, string> = {
  1: "Staking Farm",
  2: "NFT Farm", 
  3: "Token Staking",
  4: "Token Balance",
  5: "NFT Holding",
};

export const PROPOSER_TYPES: Record<number, string> = {
  0: "Authors Only",
  1: "Anyone",
  2: "Token Holders",
};

export interface DaoInfo {
  dao_name: string;
  creator: string;
  description: string;
  logo: string;
  token_contract: string;
  token_symbol: string;
  dao_type: number;
  proposer_type: number;
  threshold: number;
  hours_per_proposal: number;
  minimum_weight: number;
  minimum_votes: number;
  proposal_cost: string;
  authors: string[];
  gov_schemas: { collection_name: string; schema_name: string }[];
  time_created: number;
  status: number;
}

export interface Proposal {
  proposal_id: number;
  dao_name: string;
  proposer: string;
  title: string;
  description: string;
  proposal_type: string;
  status: "pending" | "active" | "passed" | "rejected" | "executed";
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  start_time: string;
  end_time: string;
  actions: ProposalAction[];
}

export interface ProposalAction {
  contract: string;
  action: string;
  data: Record<string, unknown>;
}

export interface Vote {
  voter: string;
  proposal_id: number;
  vote: "yes" | "no" | "abstain";
  weight: number;
  timestamp: string;
}

// Fetch all DAOs from the contract
export async function fetchAllDaos(): Promise<DaoInfo[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: DAO_CONTRACT,
          table: "daos",
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Raw DAO data:", data);
    
    // Map the response to our interface based on actual contract fields
    return (data.rows || []).map((row: Record<string, unknown>) => ({
      dao_name: row.daoname as string || "",
      creator: row.creator as string || "",
      description: "", // Not stored on-chain
      logo: "", // Not stored on-chain - could fetch from IPFS/external source
      token_contract: row.gov_token_contract as string || "",
      token_symbol: row.gov_token_symbol as string || "",
      dao_type: row.dao_type as number || 0,
      proposer_type: row.proposer_type as number || 0,
      threshold: parseFloat(row.threshold as string) || 0,
      hours_per_proposal: row.hours_per_proposal as number || 0,
      minimum_weight: typeof row.minimum_weight === 'string' 
        ? parseInt(row.minimum_weight) 
        : row.minimum_weight as number || 0,
      minimum_votes: row.minimum_votes as number || 0,
      proposal_cost: row.proposal_cost as string || "0",
      authors: row.authors as string[] || [],
      gov_schemas: row.gov_schemas as { collection_name: string; schema_name: string }[] || [],
      time_created: row.time_created as number || 0,
      status: row.status as number || 0,
    }));
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    return [];
  }
}

// Fetch details for a specific DAO
export async function fetchDaoDetails(daoName: string): Promise<DaoInfo | null> {
  try {
    const allDaos = await fetchAllDaos();
    return allDaos.find(dao => dao.dao_name === daoName) || null;
  } catch (error) {
    console.error("Error fetching DAO details:", error);
    return null;
  }
}

// Fetch DAOs where user is a member or custodian
export async function fetchUserDaos(account: string): Promise<DaoInfo[]> {
  // This will need to query membership tables
  // For now, return empty and we'll implement once we know the table structure
  console.log("Fetching DAOs for user:", account);
  return [];
}

// Fetch proposals for a DAO
export async function fetchProposals(daoName: string): Promise<Proposal[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: daoName,
          table: "proposals", // Table name may need adjustment
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Proposals data:", data);
    
    return (data.rows || []).map((row: Record<string, unknown>) => ({
      proposal_id: row.proposal_id || row.id || 0,
      dao_name: daoName,
      proposer: row.proposer || "",
      title: row.title || "",
      description: row.description || "",
      proposal_type: row.proposal_type || row.type || "standard",
      status: row.status || "pending",
      yes_votes: row.yes_votes || row.votes_for || 0,
      no_votes: row.no_votes || row.votes_against || 0,
      abstain_votes: row.abstain_votes || 0,
      start_time: row.start_time || "",
      end_time: row.end_time || "",
      actions: row.actions || [],
    }));
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

// Build action for creating a new DAO
export function buildCreateDaoAction(
  creator: string,
  config: {
    daoName: string;
    description: string;
    logo: string;
    tokenContract: string;
    tokenSymbol: string;
  }
) {
  return {
    account: DAO_CONTRACT,
    name: "createdao", // Action name may need adjustment
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      creator,
      dao_name: config.daoName,
      description: config.description,
      logo: config.logo,
      token_contract: config.tokenContract,
      token_symbol: config.tokenSymbol,
    },
  };
}

// Build action for creating a proposal
export function buildCreateProposalAction(
  proposer: string,
  daoName: string,
  proposal: {
    title: string;
    description: string;
    proposalType: string;
    actions?: ProposalAction[];
  }
) {
  return {
    account: DAO_CONTRACT,
    name: "createprop", // Action name may need adjustment
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      proposer,
      dao_name: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: proposal.proposalType,
      actions: proposal.actions || [],
    },
  };
}

// Build action for voting on a proposal
export function buildVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  vote: "yes" | "no" | "abstain"
) {
  return {
    account: DAO_CONTRACT,
    name: "vote", // Action name may need adjustment
    authorization: [{ actor: voter, permission: "active" }],
    data: {
      voter,
      dao_name: daoName,
      proposal_id: proposalId,
      vote,
    },
  };
}
