// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

import { getTokenConfig } from "@/lib/tokenRegistry";

export const DAO_CONTRACT = "dao.waxdao";

// Fee constants for DAO creation
export const DAO_CREATION_FEE = "250.00000000 WAX";

// Build action for announcing deposit (required before proposal payment)
export function buildAnnounceDepoAction(user: string) {
  return {
    account: DAO_CONTRACT,
    name: "announcedepo",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
    },
  };
}

// Build action for paying proposal cost
export function buildProposalCostAction(sender: string, proposalCost: string) {
  // proposalCost comes from DAO config like "100.00000000 WAX"
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      quantity: proposalCost,
      memo: "|proposal_payment|",
    },
  };
}

// Build action for paying DAO creation fee
export function buildDaoCreationFeeAction(sender: string) {
  return {
    account: "eosio.token",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      quantity: DAO_CREATION_FEE,
      memo: "|dao_payment|",
    },
  };
}

// Build action for asserting payment (required before createdao)
export function buildAssertPointAction(user: string) {
  return {
    account: DAO_CONTRACT,
    name: "assertpoint",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
    },
  };
}

// Build action for finalizing a proposal after voting ends
export function buildFinalizeProposalAction(user: string, daoName: string, proposalId: number) {
  return {
    account: DAO_CONTRACT,
    name: "finalize",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      proposal_id: proposalId,
    },
  };
}

// Build action for recounting votes (required before finalize for transfer proposals)
export function buildRecountProposalAction(user: string, daoName: string, proposalId: number) {
  return {
    account: DAO_CONTRACT,
    name: "recount",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      proposal_id: proposalId,
    },
  };
}


// DAO types from the contract
export const DAO_TYPES: Record<number, string> = {
  1: "Custodial NFT Farm",        // Requires gov_farm_name (waxdaofarmer)
  2: "Custodial Token Pool",      // Requires gov_farm_name (waxdaofarmer)
  3: "Stake to WaxDAO Pool",      // Stakes to external waxdaofarmer pool
  4: "Stake Tokens (Custodial)",  // Stakes directly to dao.waxdao contract
  5: "Hold NFTs (Non-Custodial)", // NFTs stay in wallet, no staking required
};

export const PROPOSER_TYPES: Record<number, string> = {
  0: "Authors Only",
  1: "Anyone",
  2: "Token Holders",
};

// Outcome codes from WaxDAO contract
// WaxDAO proposal voting types (internal app constants for display)
// Contract proposal_type values (what we send/receive from blockchain):
// 0 = Most Votes Wins (custom choices poll)
// 1 = Ranked Choice voting
// 2 = Token Transfer (treasury withdrawal)
// 3 = NFT Transfer (treasury NFT withdrawal)
// 4 = Yes/No/Abstain (standard 3-option poll)
export const PROPOSAL_VOTING_TYPES = {
  YES_NO_ABSTAIN: 1,    // Contract type: 4
  MOST_VOTES_WINS: 2,   // Contract type: 0
  RANKED_CHOICE: 3,     // Contract type: 1
  TOKEN_TRANSFER: 4,    // Contract type: 2
  NFT_TRANSFER: 5,      // Contract type: 3
} as const;

export const VOTING_TYPE_LABELS: Record<number, string> = {
  1: "Yes/No/Abstain",
  2: "Most Votes Wins",
  3: "Ranked Choice",
  4: "Token Transfer",
  5: "NFT Transfer",
};

export const OUTCOME_STATUS: Record<number, string> = {
  0: "active",   // Initial/voting state
  1: "active",   // Voting in progress
  2: "passed",   // Finalized - passed
  3: "rejected", // Finalized - rejected (didn't meet threshold)
  4: "executed", // Passed and executed
  5: "rejected", // Finalized - rejected/closed
  6: "expired",  // Old unfinalized proposal
};

// Threshold for marking unfinalized proposals as expired (30 days in seconds)
export const EXPIRY_THRESHOLD = 30 * 24 * 60 * 60;

export interface DaoInfo {
  dao_name: string;
  creator: string;
  description: string;
  logo: string;
  cover_image: string;
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

// Convert IPFS hash to full URL
export function getIpfsUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("Qm") || hash.startsWith("bafy")) {
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return hash;
}

export interface ProposalChoice {
  choice: number;
  description: string;
  total_votes: number | string;
}

export interface Proposal {
  proposal_id: number;
  dao_name: string;
  proposer: string;
  title: string;
  description: string;
  proposal_type: string;
  voting_type: number; // 1=yes/no/abstain, 2=most votes, 3=ranked choice, 4=token transfer
  status: "pending" | "active" | "passed" | "rejected" | "executed" | "expired" | "inconclusive";
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
  choices: ProposalChoice[]; // For multi-option and ranked choice
  start_time: string;
  end_time: string;
  end_time_ts: number;
  total_votes: number;
  actions: ProposalAction[];
  token_receivers?: TokenReceiver[]; // For token transfer proposals
  nft_receivers?: NFTReceiver[]; // For NFT transfer proposals
}

export interface TokenReceiver {
  wax_account: string;
  quantity: string;
  contract: string;
}

export interface NFTReceiver {
  wax_account: string;
  asset_ids: string[];
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

export interface UserVote {
  choice_index: number;  // Index of the choice voted for
  weight: number;        // Vote weight
  rankings?: number[];   // For ranked choice voting
}

export interface TreasuryBalance {
  contract: string;
  symbol: string;
  amount: number;
  precision: number;
}

export interface TreasuryNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

export interface StakedToken {
  balance: string;
  weight: number;
}

export interface StakedNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
}

export interface UserNFT {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}

export interface NFTTransferProposalData {
  recipient: string;
  assetIds: string[];
}

// Fetch DAO profiles from the daoprofiles table
interface DaoProfile {
  dao_name: string;
  description: string;
  avatar: string;
  cover_image: string;
}

async function fetchDaoProfiles(): Promise<Map<string, DaoProfile>> {
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
          table: "daoprofiles",
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    const profiles = new Map<string, DaoProfile>();
    
    for (const row of data.rows || []) {
      const daoName = (row.dao_name || row.daoname) as string;
      const profile = row.profile as { description?: string; avatar?: string; cover_image?: string } | undefined;
      profiles.set(daoName, {
        dao_name: daoName,
        description: (profile?.description || "") as string,
        avatar: (profile?.avatar || "") as string,
        cover_image: (profile?.cover_image || "") as string,
      });
    }
    
    return profiles;
  } catch (error) {
    console.error("Error fetching DAO profiles:", error);
    return new Map();
  }
}

// Fetch all DAOs from the contract
export async function fetchAllDaos(): Promise<DaoInfo[]> {
  try {
    const [daoResponse, profiles] = await Promise.all([
      fetch(
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
      ),
      fetchDaoProfiles()
    ]);
    
    const data = await daoResponse.json();
    console.log("Raw DAO data:", data);
    
    // Map the response to our interface based on actual contract fields
    return (data.rows || []).map((row: Record<string, unknown>) => {
      const daoName = row.daoname as string || "";
      const profile = profiles.get(daoName);
      
      return {
        dao_name: daoName,
        creator: row.creator as string || "",
        description: profile?.description || "",
        logo: profile?.avatar || "",
        cover_image: profile?.cover_image || "",
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
      };
    });
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

// Helper to fetch user's NFT collections for Type 5 DAO eligibility check
async function fetchUserNftCollections(account: string): Promise<Set<string>> {
  const collections = new Set<string>();
  let lower_bound = '';
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: "atomicassets",
          scope: account,
          table: "assets",
          limit: 1000,
          lower_bound,
        }),
      });

      const data = await response.json();
      for (const asset of data.rows || []) {
        collections.add(`${asset.collection_name}:${asset.schema_name}`);
      }

      hasMore = data.more && data.rows?.length > 0;
      if (hasMore && data.rows.length > 0) {
        lower_bound = String(BigInt(data.rows[data.rows.length - 1].asset_id) + 1n);
      }
    }
  } catch (error) {
    console.error("Error fetching user NFT collections:", error);
  }

  return collections;
}

// Fetch DAOs where user is a member (has staked tokens/NFTs or holds eligible NFTs for Type 5)
export async function fetchUserDaos(account: string): Promise<DaoInfo[]> {
  console.log("Fetching DAOs for user:", account);
  
  try {
    // Fetch all data in parallel for efficiency
    const [stakedResponse, stakedNftResponse, allDaos, userNftCollections] = await Promise.all([
      // Query the stakedtokens table scoped by the user
      fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: account,
          table: "stakedtokens",
          limit: 100,
        }),
      }),
      // Query stakedassets table for NFT staking
      fetch(`https://wax.eosusa.io/v1/chain/get_table_rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: account,
          table: "stakedassets",
          limit: 100,
        }),
      }),
      // Fetch all DAOs
      fetchAllDaos(),
      // Fetch user's NFT collections for Type 5 check
      fetchUserNftCollections(account),
    ]);
    
    const stakedData = await stakedResponse.json();
    console.log("User staked tokens data:", stakedData);
    
    const stakedNftData = await stakedNftResponse.json();
    console.log("User staked NFTs data:", stakedNftData);
    
    // Collect unique DAO names from staking tables
    const stakedDaoNames = new Set<string>();
    
    // From stakedtokens - each row has dao_name field
    for (const row of stakedData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) {
        stakedDaoNames.add(daoName);
      }
    }
    
    // From stakedassets - each row has dao_name field
    for (const row of stakedNftData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) {
        stakedDaoNames.add(daoName);
      }
    }
    
    // Filter DAOs: staked OR (Type 5 with matching NFTs)
    return allDaos.filter(dao => {
      // Check if user has staked to this DAO
      if (stakedDaoNames.has(dao.dao_name)) {
        return true;
      }
      
      // Check Type 5 DAOs: does user hold eligible NFTs?
      if (dao.dao_type === 5 && dao.gov_schemas?.length > 0) {
        return dao.gov_schemas.some(schema =>
          userNftCollections.has(`${schema.collection_name}:${schema.schema_name}`)
        );
      }
      
      return false;
    });
    
  } catch (error) {
    console.error("Error fetching user DAOs:", error);
    return [];
  }
}

// Fetch token_receivers from Hyperion history API for token transfer proposals
// This is needed because WaxDAO contract doesn't persist token_receivers in the proposals table
// Returns a map keyed by proposal title since Hyperion doesn't have proposal_id
async function fetchTokenReceiversFromHyperion(
  daoName: string
): Promise<Record<string, { wax_account: string; quantity: string; contract: string }[]>> {
  const result: Record<string, { wax_account: string; quantity: string; contract: string }[]> = {};
  
  try {
    // Query Hyperion for newproposal actions for this DAO
    const response = await fetch(
      `https://wax.eosusa.io/v2/history/get_actions?account=${DAO_CONTRACT}&filter=${DAO_CONTRACT}:newproposal&limit=500`
    );
    
    if (!response.ok) return result;
    
    const data = await response.json();
    console.log("Hyperion newproposal actions:", data.actions?.length || 0);
    
    // Extract token_receivers for token transfer proposals, keyed by title
    for (const action of data.actions || []) {
      const actData = action.act?.data;
      if (actData && actData.dao === daoName && actData.proposal_type === 4) {
        // Token transfer proposal for this DAO
        if (actData.token_receivers && actData.token_receivers.length > 0) {
          const title = (actData.title as string) || "";
          const receivers = actData.token_receivers.map((tr: Record<string, unknown>) => ({
            wax_account: (tr.wax_account as string) || "",
            quantity: (tr.quantity as string) || "",
            contract: (tr.contract as string) || "eosio.token",
          }));
          
          console.log(`Found Hyperion token transfer for DAO ${daoName}, title: "${title}"`, receivers);
          result[title] = receivers;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("Hyperion fetch error:", error);
    return result;
  }
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
          table: "proposals",
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    console.log("==================== PROPOSALS DATA ====================");
    console.log("Total proposals:", data.rows?.length || 0);
    
    // Log first proposal's all keys to understand structure
    if (data.rows && data.rows.length > 0) {
      const firstRow = data.rows[0];
      console.log("First proposal all keys:", Object.keys(firstRow));
      
      // Find any token transfer proposals and log their full structure
      data.rows.forEach((row: Record<string, unknown>) => {
        const pType = row.proposal_type as number;
        if (pType === 4) {
          console.log(`>>> TOKEN TRANSFER Proposal ${row.proposal_id}:`, {
            token_receivers: row.token_receivers,
            token_receivers_type: typeof row.token_receivers,
            token_receivers_isArray: Array.isArray(row.token_receivers),
            token_receivers_length: Array.isArray(row.token_receivers) ? row.token_receivers.length : 'N/A',
          });
        }
      });
    }
    console.log("=========================================================");
    
    const now = Math.floor(Date.now() / 1000);
    
    // Check if there are any token transfer proposals that need Hyperion data
    const hasTokenTransferProposals = (data.rows || []).some((row: Record<string, unknown>) => {
      const pType = row.proposal_type as number;
      const receivers = row.token_receivers as unknown[];
      return pType === 4 && (!receivers || receivers.length === 0);
    });
    
    // Fetch Hyperion data for token transfer proposals (keyed by title)
    let hyperionReceiversByTitle: Record<string, { wax_account: string; quantity: string; contract: string }[]> = {};
    if (hasTokenTransferProposals) {
      hyperionReceiversByTitle = await fetchTokenReceiversFromHyperion(daoName);
    }
    
    return (data.rows || []).map((row: Record<string, unknown>) => {
      const choices = row.choices as ProposalChoice[] || [];
      // outcome can be 0 which is valid, so check for undefined/null explicitly
      const outcome = typeof row.outcome === 'number' ? row.outcome : 0;
      const endTime = row.end_time as number || 0;
      
      console.log(`Proposal ${row.proposal_id} raw data: outcome=${row.outcome}, end_time=${endTime}, title=${row.title}`);
      
      // Extract vote counts from choices array
      let yesVotes = 0;
      let noVotes = 0;
      let abstainVotes = 0;
      
      choices.forEach((choice: ProposalChoice) => {
        const votes = typeof choice.total_votes === 'string' 
          ? parseInt(choice.total_votes) || 0 
          : choice.total_votes || 0;
        const choiceDesc = choice.description?.toLowerCase();
        if (choiceDesc === "yes") {
          yesVotes = votes;
        } else if (choiceDesc === "no") {
          noVotes = votes;
        } else if (choiceDesc === "abstain") {
          abstainVotes = votes;
        }
      });
      
      // Get contract proposal type early - needed for status determination
      // Contract types: 0=Most Votes Wins, 1=Ranked Choice, 2=Token Transfer, 3=NFT Transfer, 4=Yes/No/Abstain
      const contractProposalType = (row.proposal_type as number) ?? 0;
      
      // Determine status based on outcome and end_time
      // WaxDAO outcome codes: 0 = voting, 1 = voting, 2 = passed, 3 = rejected, 4 = executed, 5 = finalized (check votes)
      let status: "pending" | "active" | "passed" | "rejected" | "executed" | "expired" | "inconclusive" = "pending";
      
      // First check if outcome indicates already finalized
      if (outcome === 2 || outcome === 4 || outcome === 5) {
        // For Yes/No/Abstain proposals, check abstain-only condition FIRST
        if (contractProposalType === 4) {
          if (yesVotes === 0 && noVotes === 0) {
            if (abstainVotes > 0) {
              status = "inconclusive";
            } else {
              status = "rejected";
            }
          } else {
            status = outcome === 4 ? "executed" : (yesVotes > noVotes ? "passed" : "rejected");
          }
        } else if (contractProposalType === 0 || contractProposalType === 1) {
          const totalChoiceVotes = choices.reduce((sum: number, c: ProposalChoice) => {
            const votes = typeof c.total_votes === 'string' ? parseInt(c.total_votes) || 0 : c.total_votes || 0;
            return sum + votes;
          }, 0);
          status = outcome === 4 ? "executed" : (totalChoiceVotes > 0 ? "passed" : "rejected");
        } else {
          status = outcome === 4 ? "executed" : "passed";
        }
      } else if (outcome === 3) {
        status = "rejected";
      } else if (outcome >= 6) {
        // Other finalized states
        status = (OUTCOME_STATUS[outcome] as typeof status) || "rejected";
      } else {
        // outcome is 0 or 1 - need to check time and proposal type
        if (endTime > now) {
          status = "active";  // Voting still in progress
        } else if (endTime <= now) {
          // Voting has ended
          // For Most Votes Wins (0) and Ranked Choice (1), outcome=1 after finalization means "passed with winner"
          // For Yes/No (4), outcome stays 0/1 until explicitly finalized via finalize action
          if ((contractProposalType === 0 || contractProposalType === 1) && outcome === 1) {
            // Most Votes Wins / Ranked Choice with outcome=1 after end = finalized with winner
            const totalChoiceVotes = choices.reduce((sum: number, c: ProposalChoice) => {
              const votes = typeof c.total_votes === 'string' 
                ? parseInt(c.total_votes) || 0 
                : c.total_votes || 0;
              return sum + votes;
            }, 0);
            status = totalChoiceVotes > 0 ? "passed" : "rejected";
          } else {
            // Not finalized yet
            if (now - endTime > EXPIRY_THRESHOLD) {
              status = "expired"; // Old unfinalized proposal
            } else {
              status = "pending"; // Recently ended, awaiting finalization
            }
          }
        }
      }
      
      console.log(`Proposal ${row.proposal_id}: type=${contractProposalType}, outcome=${outcome}, calculated status=${status}`);
      
      const actions = (row.actions as ProposalAction[]) || [];
      
      let votingType: number;
      
      // Map contract proposal_type to our voting type constants
      switch (contractProposalType) {
        case 0:
          // Most Votes Wins (custom choices poll)
          votingType = PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS;
          break;
        case 1:
          // Ranked Choice voting
          votingType = PROPOSAL_VOTING_TYPES.RANKED_CHOICE;
          break;
        case 2:
          // Token Transfer (treasury withdrawal)
          votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER;
          break;
        case 3:
          // NFT Transfer (treasury NFT withdrawal)
          votingType = PROPOSAL_VOTING_TYPES.NFT_TRANSFER;
          break;
        case 4:
          // Yes/No/Abstain (standard poll)
          votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN;
          break;
        default:
          votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN;
      }
      
      // Fallback: Check for transfer actions in case contract type wasn't set correctly
      if (votingType === PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN && actions.some(a => a.action === "transfer")) {
        votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER;
      }
      
      // Get token_receivers from contract
      let tokenReceivers: { wax_account: string; quantity: string; contract: string }[] = [];
      const nftReceivers = (row.nft_receivers as { wax_account: string; asset_ids: string[] }[]) || [];
      
      // Log raw data for transfer types
      if (contractProposalType === 2 || contractProposalType === 3) {
        console.log(`Proposal ${row.proposal_id} (type ${contractProposalType}) raw fields:`, 
          Object.keys(row));
        console.log(`Proposal ${row.proposal_id} token_receivers field:`, row.token_receivers);
        console.log(`Proposal ${row.proposal_id} token_receivers isArray:`, Array.isArray(row.token_receivers));
        console.log(`Proposal ${row.proposal_id} token_receivers type:`, typeof row.token_receivers);
        console.log(`Proposal ${row.proposal_id} nft_receivers field:`, row.nft_receivers);
      }
      
      // Try to get token_receivers - handle both array and object cases
      if (row.token_receivers) {
        if (Array.isArray(row.token_receivers) && row.token_receivers.length > 0) {
          tokenReceivers = row.token_receivers as { wax_account: string; quantity: string; contract: string }[];
        } else if (typeof row.token_receivers === 'object') {
          // Single object or other format - check if it has the expected fields
          const tr = row.token_receivers as Record<string, unknown>;
          if (tr.wax_account && tr.quantity) {
            tokenReceivers = [{
              wax_account: tr.wax_account as string,
              quantity: tr.quantity as string,
              contract: (tr.contract as string) || 'eosio.token',
            }];
          }
        }
      }
      
      // Fallback: If token_receivers is empty for token transfer proposals,
      // it's a WaxDAO contract quirk - the data isn't persisted in the table.
      // We need to fetch from Hyperion history to get the original creation data.
      if (tokenReceivers.length === 0 && votingType === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER) {
        // Try to get from actions array first (legacy support)
        const transferActions = actions.filter(a => a.action === "transfer");
        if (transferActions.length > 0) {
          tokenReceivers = transferActions.map(action => {
            const data = action.data as Record<string, unknown>;
            return {
              wax_account: (data.to as string) || "",
              quantity: (data.quantity as string) || "",
              contract: action.contract || "eosio.token",
            };
          }).filter(r => r.wax_account && r.quantity);
          console.log(`Proposal ${row.proposal_id} extracted from actions:`, tokenReceivers);
        }
        
        // If still empty, use pre-fetched Hyperion data (lookup by title)
        if (tokenReceivers.length === 0) {
          const proposalTitle = (row.title as string) || "";
          const hyperionReceivers = hyperionReceiversByTitle[proposalTitle];
          if (hyperionReceivers && hyperionReceivers.length > 0) {
            tokenReceivers = hyperionReceivers;
            console.log(`Proposal ${row.proposal_id} fetched from Hyperion by title "${proposalTitle}":`, tokenReceivers);
          }
        }
      }
      
      console.log(`Proposal ${row.proposal_id} FINAL token_receivers:`, tokenReceivers);
      
      console.log(`Proposal ${row.proposal_id}: contract_type=${contractProposalType}, voting_type=${votingType}, choices=`, choices);
      
      return {
        proposal_id: (row.proposal_id as number) || (row.id as number) || 0,
        dao_name: daoName,
        proposer: (row.author as string) || (row.proposer as string) || "",
        title: (row.title as string) || "",
        description: ((row.description as string) || "").replace(/^\[RANKED\]\s*/, ""), // Strip marker for display
        proposal_type: String(contractProposalType),
        voting_type: votingType,
        status,
        yes_votes: yesVotes,
        no_votes: noVotes,
        abstain_votes: abstainVotes,
        choices: choices,
        start_time: (row.start_time as string) || "",
        end_time: endTime.toString(),
        end_time_ts: endTime,
        total_votes: (row.total_votes as number) || 0,
        actions: actions,
        token_receivers: tokenReceivers,
        nft_receivers: nftReceivers,
      };
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

// Fetch treasury balances for a DAO from the dao.waxdao contract's accounts table
export async function fetchDaoTreasury(daoName: string): Promise<TreasuryBalance[]> {
  const balances: TreasuryBalance[] = [];
  
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: DAO_CONTRACT,
          table: "tokenvault",
          scope: daoName,
          limit: 100,
          json: true,
        }),
      }
    );
    
    const data = await response.json();
    console.log(`Treasury balances for ${daoName}:`, data);
    
    if (data.rows && Array.isArray(data.rows)) {
      for (const row of data.rows) {
        // Each row has a balance field like "100.0000 WAX" or extended_asset format
        const balanceStr = typeof row.balance === 'string' 
          ? row.balance 
          : row.balance?.quantity || '';
        
        if (balanceStr) {
          const [amountStr, symbol] = balanceStr.split(" ");
          const amount = parseFloat(amountStr);
          const precision = amountStr.includes(".") ? amountStr.split(".")[1].length : 0;
          
          // Determine contract from row.contract field or extended_asset format
          const contract = row.contract || row.balance?.contract || 
            (symbol === 'WAX' ? 'eosio.token' : 
             symbol === 'WAXDAO' ? 'token.waxdao' : 'unknown');
          
          if (amount > 0) {
            balances.push({
              contract,
              symbol,
              amount,
              precision,
            });
          }
        }
      }
    }
    
    return balances;
  } catch (error) {
    console.error("Error fetching treasury:", error);
    return [];
  }
}

// DAO Type configuration interface
export interface DaoTypeConfig {
  daoType: number; // 1-5
  // For Type 4: Token Staking
  tokenContract?: string;
  tokenSymbol?: string;
  // For Types 1, 2, 3: Farm-based DAOs
  govFarmName?: string;
  // For Types 1, 2, 5: NFT-based DAOs
  govSchemas?: { collection_name: string; schema_name: string }[];
}

// Build action for creating a new DAO (supports all 5 types)
// dao_type: 1 = Custodial NFT Farm, 2 = Custodial Token Pool, 3 = Stake to WaxDAO Pool,
//           4 = Stake Tokens (Custodial), 5 = Hold NFTs (Non-Custodial)
export function buildCreateDaoAction(
  creator: string,
  config: {
    daoName: string;
    daoType?: number; // 1-5, default 4
    tokenContract?: string;
    tokenSymbol?: string;
    govFarmName?: string;
    govSchemas?: { collection_name: string; schema_name: string }[];
    threshold?: number;
    hoursPerProposal?: number;
    minimumWeight?: number;
    minimumVotes?: number;
    proposerType?: number;
    authors?: string[];
    proposalCost?: number;
  }
) {
  // Format proposal cost as WAX with 8 decimal places
  const proposalCostFormatted = `${(config.proposalCost || 0).toFixed(8)} WAX`;
  const daoType = config.daoType || 4;
  
  // Determine which fields to use based on DAO type
  // Type 1, 2, 3: Use gov_farm_name
  // Type 4: Use gov_token_contract and gov_token_symbol
  // Type 5: Use gov_schemas only (NFTs stay in wallet)
  const useToken = daoType === 4;
  const useFarm = [1, 2, 3].includes(daoType);
  const useSchemas = [1, 2, 5].includes(daoType);
  
  return {
    account: DAO_CONTRACT,
    name: "createdao",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      user: creator,
      daoname: config.daoName,
      dao_type: daoType,
      gov_token_contract: useToken ? (config.tokenContract || "") : "",
      gov_token_symbol: useToken ? (config.tokenSymbol || "") : "",
      gov_farm_name: useFarm ? (config.govFarmName || "null") : "null",
      gov_schemas: useSchemas ? (config.govSchemas || []) : [],
      threshold: config.threshold || 50.0,
      hours_per_proposal: config.hoursPerProposal || 72,
      minimum_weight: config.minimumWeight || 0,
      minimum_votes: config.minimumVotes || 1,
      proposer_type: config.proposerType || 1,
      authors: config.authors || [],
      proposal_cost: proposalCostFormatted,
    },
  };
}

// Build action for setting DAO profile (description + optional IPFS images)
export function buildSetProfileAction(
  user: string,
  daoName: string,
  description: string,
  avatar: string = "",
  coverImage: string = ""
) {
  return {
    account: DAO_CONTRACT,
    name: "setprofile",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      profile: {
        avatar: avatar || "",
        cover_image: coverImage || "",
        description: description || "",
        socials: {
          atomichub: "",
          discord: "",
          medium: "",
          telegram: "",
          twitter: "",
          waxdao: "",
          website: "",
          youtube: "",
        },
      },
    },
  };
}

// Build action for creating a Yes/No/Abstain proposal
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
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: 4, // Yes/No/Abstain (contract type 4)
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: proposal.actions || [],
      token_receivers: [],
      nft_receivers: [],
      proof_asset_ids: [],
    },
  };
}

// Build action for creating a Most Votes Wins proposal
export function buildMultiOptionProposalAction(
  proposer: string,
  daoName: string,
  proposal: {
    title: string;
    description: string;
    options: string[]; // Custom voting options
  }
) {
  return {
    account: DAO_CONTRACT,
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: 0, // Most Votes Wins (contract type 0)
      choices: proposal.options.map((opt, idx) => ({ choice: idx, description: opt, total_votes: 0 })),
      actions: [],
      token_receivers: [],
      nft_receivers: [],
      proof_asset_ids: [],
    },
  };
}

// Build action for creating a Ranked Choice proposal
export function buildRankedChoiceProposalAction(
  proposer: string,
  daoName: string,
  proposal: {
    title: string;
    description: string;
    options: string[]; // Options to rank
  }
) {
  return {
    account: DAO_CONTRACT,
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: 1, // Ranked Choice (contract type 1)
      choices: proposal.options.map((opt, idx) => ({ choice: idx, description: opt, total_votes: 0 })),
      actions: [],
      token_receivers: [],
      nft_receivers: [],
      proof_asset_ids: [],
    },
  };
}

// Build action for voting on a Yes/No/Abstain proposal
// assetIds: NFT asset IDs for Type 5 Hold NFT DAOs - each NFT = 1 vote weight
export function buildVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  vote: "yes" | "no" | "abstain",
  voteWeight?: string, // Token quantity string for Type 4 DAOs (e.g., "540.14048487 WAX")
  assetIds?: string[] // NFT asset IDs for Type 5 DAOs
) {
  // Convert vote string to choice index (0=yes, 1=no, 2=abstain)
  const choiceMap: Record<string, number> = { yes: 0, no: 1, abstain: 2 };
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceMap[vote],
    asset_ids: assetIds || [],
  };
  
  // Add weight for Type 4 Token Balance DAOs
  if (voteWeight) {
    data.weight = voteWeight;
  }
  
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data,
  };
}

// Build action for voting on a Most Votes Wins proposal (select one option)
// assetIds: NFT asset IDs for Type 5 Hold NFT DAOs
export function buildMultiOptionVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  choiceIndex: number,
  voteWeight?: string,
  assetIds?: string[]
) {
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceIndex,
    asset_ids: assetIds || [],
  };
  
  if (voteWeight) {
    data.weight = voteWeight;
  }
  
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data,
  };
}

// Build action for voting on a Ranked Choice proposal
// Note: WaxDAO contract doesn't support true ranked choice voting - it uses single-choice voting
// The "ranked choice" is a UI/display preference only, voting works the same as Most Votes Wins
// assetIds: NFT asset IDs for Type 5 Hold NFT DAOs
export function buildRankedChoiceVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  choiceIndex: number, // Single choice index (same as multi-option)
  voteWeight?: string,
  assetIds?: string[]
) {
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceIndex,
    asset_ids: assetIds || [],
  };
  
  if (voteWeight) {
    data.weight = voteWeight;
  }
  
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data,
  };
}

// Fetch NFTs that have already voted on a proposal (for Type 5 DAOs)
// Uses the votesbynft table, scoped by proposal ID
export async function fetchVotedNFTs(
  proposalId: number
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: proposalId.toString(),
          table: "votesbynft",
          limit: 1000,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Votes by NFT data:", data);
    
    // Each row has an asset_id field
    return (data.rows || []).map((row: { asset_id: string }) => row.asset_id);
  } catch (error) {
    console.error("Error fetching voted NFTs:", error);
    return [];
  }
}

// Fetch user's staked tokens in a DAO
// The stakedtokens table is scoped by USER with DAO as the primary key
export async function fetchUserStakedTokens(
  daoName: string,
  userAccount: string
): Promise<StakedToken | null> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: userAccount,  // Scope by USER
          table: "stakedtokens",
          lower_bound: daoName,  // Filter by DAO name
          upper_bound: daoName,
          limit: 1,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Staked tokens data:", data);
    
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      // Parse balance to get weight (integer representation)
      const balanceStr = row.balance || "0";
      const balanceParts = balanceStr.split(" ");
      const amount = parseFloat(balanceParts[0]) || 0;
      // Calculate weight based on precision (e.g., 8 decimals for WAX)
      const precision = balanceParts[0].includes(".") ? balanceParts[0].split(".")[1].length : 0;
      const weight = Math.floor(amount * Math.pow(10, precision));
      
      return {
        balance: balanceStr,
        weight: weight,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching staked tokens:", error);
    return null;
  }
}

// Fetch user's vote for a specific proposal
// Uses the votesbyprop table, scoped by proposal ID
export async function fetchUserVote(
  daoName: string,
  proposalId: number,
  userAccount: string
): Promise<UserVote | null> {
  console.log(`fetchUserVote called: dao=${daoName}, proposal=${proposalId}, user=${userAccount}`);
  
  try {
    // Query votesbyprop table with proposal ID as scope and user account as key
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: proposalId.toString(),
          table: "votesbyprop",
          lower_bound: userAccount,
          upper_bound: userAccount,
          limit: 1,
        }),
      }
    );

    const data = await response.json();
    console.log("votesbyprop query result:", { scope: proposalId, user: userAccount, data });

    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      console.log("Found user vote in votesbyprop:", row);
      // Note: The votesbyprop table only stores wallet/weight, NOT the choice_index
      // So we use -1 to indicate "voted but unknown choice" for blockchain-loaded votes
      const hasChoiceInfo = row.choice !== undefined || row.choice_index !== undefined || row.vote_option !== undefined;
      return {
        choice_index: hasChoiceInfo ? (row.choice ?? row.choice_index ?? row.vote_option) as number : -1,
        weight: parseInt(String(row.weight || row.vote_weight || 0)) || 0,
        rankings: (row.rankings || row.ranked_choices) as number[] | undefined,
      };
    }

    console.log("No vote found for user in votesbyprop");
    return null;
  } catch (error) {
    console.error("Error fetching user vote:", error);
    return null;
  }
}

// Check if user is registered to vote in a Type 4 Token Balance DAO
// These DAOs use a different table structure
export async function checkType4Registration(
  daoName: string,
  userAccount: string
): Promise<boolean> {
  // Try multiple possible table names for Type 4 DAOs
  const tablesToTry = ["voters", "tokenvoters", "balancevoters"];
  
  for (const table of tablesToTry) {
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
            table: table,
            lower_bound: userAccount,
            upper_bound: userAccount,
            limit: 1,
          }),
        }
      );
      
      const data = await response.json();
      
      // If we got a valid response (not an error), check for user record
      if (!data.error && data.rows) {
        console.log(`Type 4 registration check (${table}):`, data);
        if (data.rows.length > 0) {
          return true;
        }
      }
    } catch (error) {
      console.log(`Table ${table} check failed, trying next...`);
    }
  }
  
  // If all table checks fail, return true to allow voting attempt
  // The contract will reject if not actually registered
  console.log("Could not verify Type 4 registration via tables, allowing vote attempt");
  return true;
}

// Fetch user's staked NFTs in a DAO
export async function fetchUserStakedNFTs(
  daoName: string,
  userAccount: string
): Promise<StakedNFT[]> {
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
          table: "stakednfts",
          lower_bound: userAccount,
          upper_bound: userAccount,
          index_position: 2,
          key_type: "name",
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Staked NFTs data:", data);
    
    // For each staked NFT, we need to fetch asset details from AtomicAssets
    const stakedNFTs: StakedNFT[] = [];
    
    if (data.rows && data.rows.length > 0) {
      for (const row of data.rows) {
        const assetId = row.asset_id?.toString() || row.asset_ids?.[0]?.toString();
        if (assetId) {
          try {
            const assetResponse = await fetch(
              `https://wax.api.atomicassets.io/atomicassets/v1/assets/${assetId}`
            );
            const assetData = await assetResponse.json();
            
            if (assetData.success && assetData.data) {
              const asset = assetData.data;
              stakedNFTs.push({
                asset_id: assetId,
                name: asset.data?.name || asset.name || `NFT #${assetId}`,
                image: asset.data?.img || asset.data?.image || "",
                collection: asset.collection?.collection_name || "",
                schema: asset.schema?.schema_name || "",
              });
            }
          } catch {
            console.log(`Could not fetch asset ${assetId}`);
          }
        }
      }
    }
    
    return stakedNFTs;
  } catch (error) {
    console.error("Error fetching staked NFTs:", error);
    return [];
  }
}

// Fetch user's token balance with fallback for non-standard contracts
export async function fetchUserTokenBalance(
  contract: string,
  symbol: string,
  userAccount: string
): Promise<string> {
  // Try get_currency_balance first (works for most standard token contracts)
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_currency_balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: contract,
          account: userAccount,
          symbol: symbol,
        }),
      }
    );
    
    const data = await response.json();
    
    // Check if it's an error response
    if (data.error || data.code === 500) {
      // Fallback to get_table_rows
      return await fetchUserTokenBalanceFromTable(contract, symbol, userAccount);
    }
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return `0 ${symbol}`;
  } catch (error) {
    console.error("Error fetching token balance, trying fallback:", error);
    // Fallback to get_table_rows
    return await fetchUserTokenBalanceFromTable(contract, symbol, userAccount);
  }
}

// Fallback: fetch balance directly from contract's accounts table
async function fetchUserTokenBalanceFromTable(
  contract: string,
  symbol: string,
  userAccount: string
): Promise<string> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: contract,
          scope: userAccount,
          table: "accounts",
          limit: 100,
          json: true,
        }),
      }
    );
    
    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      // Find the balance matching the symbol
      for (const row of data.rows) {
        const balance = row.balance || row.quantity;
        if (balance && balance.includes(symbol)) {
          return balance;
        }
      }
    }
    return `0 ${symbol}`;
  } catch (error) {
    console.error("Error fetching token balance from table:", error);
    return `0 ${symbol}`;
  }
}

// Build actions for staking tokens (requires both staketokens action AND transfer in same tx)
export function buildStakeTokenActions(
  staker: string,
  daoName: string,
  amount: string,
  tokenContract: string
) {
  // Both actions must be in the same transaction
  return [
    // First: call staketokens to register/prepare the stake
    {
      account: DAO_CONTRACT,
      name: "staketokens",
      authorization: [{ actor: staker, permission: "active" }],
      data: {
        user: staker,
        dao: daoName,
      },
    },
    // Second: transfer the tokens
    {
      account: tokenContract,
      name: "transfer",
      authorization: [{ actor: staker, permission: "active" }],
      data: {
        from: staker,
        to: DAO_CONTRACT,
        quantity: amount,
        memo: `|stake_tokens|${daoName}|`,
      },
    },
  ];
}

// Legacy single action (deprecated - use buildStakeTokenActions instead)
export function buildStakeTokenAction(
  staker: string,
  daoName: string,
  amount: string,
  tokenContract: string
) {
  return {
    account: tokenContract,
    name: "transfer",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      from: staker,
      to: DAO_CONTRACT,
      quantity: amount,
      memo: `|stake_tokens|${daoName}|`,
    },
  };
}

// Build action for registering to vote in a Token Balance DAO (Type 4)
// This calls the staketokens action to create a record in the stakers table
export function buildRegisterForBalanceVotingAction(
  user: string,
  daoName: string,
) {
  // For Type 4 DAOs, call staketokens action to register (no actual tokens needed)
  return {
    account: DAO_CONTRACT,
    name: "staketokens",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
    },
  };
}

// Build action for unstaking tokens
export function buildUnstakeTokenAction(
  staker: string,
  daoName: string,
  amount: string
) {
  return {
    account: DAO_CONTRACT,
    name: "unstaketoken",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      dao: daoName,
      quantity: amount,
    },
  };
}

// Build action for staking NFTs
export function buildStakeNFTAction(
  staker: string,
  daoName: string,
  assetIds: string[]
) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      from: staker,
      to: DAO_CONTRACT,
      asset_ids: assetIds,
      memo: `stake|${daoName}`,
    },
  };
}

// Build action for unstaking NFTs
export function buildUnstakeNFTAction(
  staker: string,
  daoName: string,
  assetIds: string[]
) {
  return {
    account: DAO_CONTRACT,
    name: "unstakenft",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      daoname: daoName,
      asset_ids: assetIds,
    },
  };
}

// Build action for announcing token deposit (required before non-WAX token deposits)
export function buildTokenDepositAction(
  user: string,
  daoName: string,
  tokenSymbol: string,
  tokenPrecision: number,
  tokenContract: string
) {
  // EOSIO symbol format: "precision,SYMBOL" e.g. "4,CHEESE"
  const formattedSymbol = `${tokenPrecision},${tokenSymbol}`;
  return {
    account: DAO_CONTRACT,
    name: "tokendeposit",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user: user,
      dao: daoName,
      token_symbol: formattedSymbol,
      token_contract: tokenContract,
    },
  };
}

// Build action for depositing tokens to DAO treasury
export function buildDepositToTreasuryAction(
  sender: string,
  daoName: string,
  quantity: string,
  tokenContract: string
) {
  return {
    account: tokenContract,
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      quantity: quantity,
      memo: `|treasury_deposit|${daoName}|`,
    },
  };
}

// Token transfer action for proposals (to be executed when proposal passes)
export interface TokenTransferProposalData {
  recipient: string;
  amount: string;
  tokenSymbol: string;
  tokenContract: string;
}

// Build action for creating a token transfer proposal
export function buildTokenTransferProposalAction(
  proposer: string,
  daoName: string,
  proposal: {
    title: string;
    description: string;
    transfer: TokenTransferProposalData;
  }
) {
  // Token transfer proposals use the token_receivers field, not actions
  // Format the quantity with proper precision based on token registry
  const tokenConfig = getTokenConfig(proposal.transfer.tokenSymbol);
  
  // Format amount with correct precision
  let quantity: string;
  if (tokenConfig) {
    const amount = parseFloat(proposal.transfer.amount);
    quantity = `${amount.toFixed(tokenConfig.precision)} ${proposal.transfer.tokenSymbol}`;
  } else {
    // Fallback: assume the user provided the full formatted amount
    quantity = `${proposal.transfer.amount} ${proposal.transfer.tokenSymbol}`;
  }
  
  return {
    account: DAO_CONTRACT,
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: 2, // Token Transfer (contract type 2)
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: [],
      token_receivers: [{
        wax_account: proposal.transfer.recipient,
        quantity: quantity,
        contract: proposal.transfer.tokenContract,
      }],
      nft_receivers: [],
      proof_asset_ids: [],
    },
  };
}

// Fetch NFTs owned by a DAO treasury
// Alternative AtomicAssets API endpoints (fallbacks for reliability)
const ATOMIC_API_ENDPOINTS = [
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eu.eosamsterdam.net',
  'https://wax.api.atomicassets.io',
];

async function fetchFromAtomicAPI(path: string): Promise<Response> {
  let lastError: Error | null = null;
  
  for (const baseUrl of ATOMIC_API_ENDPOINTS) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      console.log(`API ${baseUrl} failed, trying next...`);
    }
  }
  
  throw lastError || new Error('All AtomicAssets API endpoints failed');
}

// Fetch asset IDs from the dao.waxdao nftvault table
async function fetchTreasuryAssetIds(daoName: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: DAO_CONTRACT,
          scope: daoName,
          table: "nftvault",
          limit: 1000,
          json: true,
        }),
      }
    );
    
    const json = await response.json();
    console.log("NFT vault data for", daoName, ":", json);
    
    if (!json.rows || json.rows.length === 0) {
      return [];
    }
    
    // Extract asset_ids from the rows (handle different possible field names)
    return json.rows.map((row: Record<string, unknown>) => 
      String(row.asset_id || row.assetid || row.id || "")
    ).filter((id: string) => id !== "");
  } catch (error) {
    console.error("Error fetching treasury asset IDs:", error);
    return [];
  }
}

export async function fetchDaoTreasuryNFTs(daoName: string): Promise<TreasuryNFT[]> {
  try {
    // Step 1: Get asset IDs from the nftvault table
    const assetIds = await fetchTreasuryAssetIds(daoName);
    
    if (assetIds.length === 0) {
      console.log("No NFTs in vault for", daoName);
      return [];
    }
    
    console.log("Found", assetIds.length, "NFTs in vault for", daoName, ":", assetIds);
    
    // Step 2: Fetch asset details from AtomicAssets using the IDs
    const response = await fetchFromAtomicAPI(
      `/atomicassets/v1/assets?ids=${assetIds.join(",")}&limit=1000`
    );
    
    const json = await response.json();
    
    if (!json.success || !json.data) {
      console.log("No asset details found for treasury NFTs");
      return [];
    }
    
    return json.data.map((asset: Record<string, unknown>) => {
      const data = asset.data as Record<string, string> || {};
      const collection = asset.collection as { collection_name: string } || { collection_name: "" };
      const schema = asset.schema as { schema_name: string } || { schema_name: "" };
      const template = asset.template as { template_id: string } || { template_id: "" };
      
      let image = data.img || data.image || "";
      if (image && !image.startsWith("http")) {
        if (image.startsWith("Qm") || image.startsWith("bafy")) {
          image = `https://ipfs.io/ipfs/${image}`;
        }
      }
      
      return {
        asset_id: asset.asset_id as string,
        name: data.name || asset.name as string || `NFT #${asset.asset_id}`,
        image,
        collection: collection.collection_name,
        schema: schema.schema_name,
        template_id: template.template_id,
      };
    });
  } catch (error) {
    console.error("Error fetching treasury NFTs:", error);
    return [];
  }
}

// Fetch user's NFTs for deposit to treasury
export async function fetchUserNFTs(userAccount: string): Promise<TreasuryNFT[]> {
  try {
    const response = await fetchFromAtomicAPI(
      `/atomicassets/v1/assets?owner=${userAccount}&limit=1000`
    );
    
    const json = await response.json();
    
    if (!json.success || !json.data) {
      return [];
    }
    
    return json.data.map((asset: Record<string, unknown>) => {
      const data = asset.data as Record<string, string> || {};
      const collection = asset.collection as { collection_name: string } || { collection_name: "" };
      const schema = asset.schema as { schema_name: string } || { schema_name: "" };
      const template = asset.template as { template_id: string } || { template_id: "" };
      
      let image = data.img || data.image || "";
      if (image && !image.startsWith("http")) {
        if (image.startsWith("Qm") || image.startsWith("bafy")) {
          image = `https://ipfs.io/ipfs/${image}`;
        }
      }
      
      return {
        asset_id: asset.asset_id as string,
        name: data.name || asset.name as string || `NFT #${asset.asset_id}`,
        image,
        collection: collection.collection_name,
        schema: schema.schema_name,
        template_id: template.template_id,
      };
    });
  } catch (error) {
    console.error("Error fetching user NFTs:", error);
    return [];
  }
}

// Build action for NFT deposit notification to DAO contract
export function buildNFTDepositAction(
  sender: string,
  daoName: string,
  assetIds: string[]
) {
  return {
    account: DAO_CONTRACT,
    name: "nftdeposit",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      user: sender,
      dao: daoName,
      asset_ids: assetIds,
    },
  };
}

// Build action for transferring NFTs to DAO treasury
export function buildDepositNFTToTreasuryAction(
  sender: string,
  daoName: string,
  assetIds: string[]
) {
  return {
    account: "atomicassets",
    name: "transfer",
    authorization: [{ actor: sender, permission: "active" }],
    data: {
      from: sender,
      to: DAO_CONTRACT,
      asset_ids: assetIds,
      memo: `|treasury_deposit|${daoName}|`,
    },
  };
}

// Build action for creating an NFT transfer proposal
export function buildNFTTransferProposalAction(
  proposer: string,
  daoName: string,
  proposal: {
    title: string;
    description: string;
    transfer: NFTTransferProposalData;
  }
) {
  return {
    account: DAO_CONTRACT,
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: 3, // NFT Transfer (contract type 3)
      choices: [
        { choice: 0, description: "Yes", total_votes: 0 },
        { choice: 1, description: "No", total_votes: 0 },
        { choice: 2, description: "Abstain", total_votes: 0 },
      ],
      actions: [],
      token_receivers: [],
      nft_receivers: [{
        wax_account: proposal.transfer.recipient,
        asset_ids: proposal.transfer.assetIds,
      }],
      proof_asset_ids: [],
    },
  };
}

// DAO Member interface
export interface DaoMember {
  user: string;
  dao: string;
}

// Fetch DAO members to check membership
export async function fetchDaoMembers(daoName: string): Promise<DaoMember[]> {
  try {
    const response = await fetch("https://wax.eosphere.io/v1/chain/get_table_rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true,
        code: DAO_CONTRACT,
        scope: daoName,
        table: "users",
        limit: 1000,
      }),
    });
    const data = await response.json();
    return data.rows || [];
  } catch (error) {
    console.error("Failed to fetch DAO members:", error);
    return [];
  }
}

// Check if a user is a member of a DAO
export async function checkDaoMembership(daoName: string, user: string): Promise<boolean> {
  try {
    // Check staking tables in parallel for efficiency
    const [stakedResponse, stakedNftsResponse] = await Promise.all([
      // Check 1: Staked tokens table (scoped by user) - for Token Staking DAOs
      fetch("https://wax.eosusa.io/v1/chain/get_table_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: user,
          table: "stakedtokens",
          limit: 100,
        }),
      }),
      // Check 2: Staked NFTs table (scoped by user) - for NFT-based DAOs
      fetch("https://wax.eosusa.io/v1/chain/get_table_rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: user,
          table: "stakedassets",
          limit: 100,
        }),
      }),
    ]);

    const [stakedData, stakedNftsData] = await Promise.all([
      stakedResponse.json(),
      stakedNftsResponse.json(),
    ]);
    
    console.log("Staked tokens for user", user, ":", stakedData);
    console.log("Staked NFTs for user", user, ":", stakedNftsData);
    
    // Check staked tokens
    if (stakedData.rows && stakedData.rows.length > 0) {
      const hasStakedToDao = stakedData.rows.some((row: any) => {
        const rowDao = row.dao_name || row.daoname || row.dao;
        return rowDao === daoName;
      });
      if (hasStakedToDao) {
        console.log("User", user, "has staked tokens for DAO", daoName);
        return true;
      }
    }

    // Check staked NFTs
    if (stakedNftsData.rows && stakedNftsData.rows.length > 0) {
      const hasStakedNftsToDao = stakedNftsData.rows.some((row: any) => {
        const rowDao = row.dao_name || row.daoname || row.dao;
        return rowDao === daoName;
      });
      if (hasStakedNftsToDao) {
        console.log("User", user, "has staked NFTs for DAO", daoName);
        return true;
      }
    }

    console.log("User", user, "is NOT a member of DAO", daoName);
    return false;
  } catch (error) {
    console.error("Failed to check DAO membership:", error);
    return false;
  }
}

// Build action for joining a DAO
export function buildJoinDaoAction(user: string, daoName: string) {
  return {
    account: DAO_CONTRACT,
    name: "joindao",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      dao: daoName,
    },
  };
}

// Build action for leaving a DAO
export function buildLeaveDaoAction(user: string, daoName: string) {
  return {
    account: DAO_CONTRACT,
    name: "leavedao",
    authorization: [{ actor: user, permission: "active" }],
    data: {
      user,
      dao: daoName,
    },
  };
}
