// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

export const DAO_CONTRACT = "dao.waxdao";

export interface DaoInfo {
  dao_name: string;
  description: string;
  logo: string;
  token_contract: string;
  token_symbol: string;
  custodians: string[];
  proposal_count: number;
  member_count: number;
  treasury_balance: string;
  created_at: string;
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

export interface Custodian {
  account: string;
  dao_name: string;
  permissions: string[];
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
          table: "daos", // Table name may need adjustment
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Raw DAO data:", data);
    
    // Map the response to our interface - field names may need adjustment
    return (data.rows || []).map((row: Record<string, unknown>) => ({
      dao_name: row.dao_name || row.dac_id || row.name || "",
      description: row.description || row.memo || "",
      logo: row.logo || row.logo_url || "",
      token_contract: row.token_contract || "",
      token_symbol: row.token_symbol || row.symbol || "",
      custodians: row.custodians || [],
      proposal_count: row.proposal_count || 0,
      member_count: row.member_count || 0,
      treasury_balance: row.treasury_balance || "0",
      created_at: row.created_at || "",
    }));
  } catch (error) {
    console.error("Error fetching DAOs:", error);
    return [];
  }
}

// Fetch details for a specific DAO
export async function fetchDaoDetails(daoName: string): Promise<DaoInfo | null> {
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
          table: "config", // Table name may need adjustment
          limit: 1,
        }),
      }
    );
    
    const data = await response.json();
    console.log("DAO details:", data);
    
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      return {
        dao_name: daoName,
        description: row.description || "",
        logo: row.logo || "",
        token_contract: row.token_contract || "",
        token_symbol: row.token_symbol || "",
        custodians: row.custodians || [],
        proposal_count: row.proposal_count || 0,
        member_count: row.member_count || 0,
        treasury_balance: row.treasury_balance || "0",
        created_at: row.created_at || "",
      };
    }
    return null;
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
