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
// WaxDAO proposal voting types
export const PROPOSAL_VOTING_TYPES = {
  YES_NO_ABSTAIN: 1,    // Standard 3-option voting
  MOST_VOTES_WINS: 2,   // Multi-option, highest wins
  RANKED_CHOICE: 3,     // Ranked preference voting
  TOKEN_TRANSFER: 4,    // Treasury withdrawal
  NFT_TRANSFER: 5,      // NFT transfer
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
  2: "passed",
  3: "rejected",
  4: "executed",
  5: "pending",  // Finalization pending
};

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
  status: "pending" | "active" | "passed" | "rejected" | "executed";
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

// Fetch DAOs where user is a member (has staked tokens/NFTs)
export async function fetchUserDaos(account: string): Promise<DaoInfo[]> {
  console.log("Fetching DAOs for user:", account);
  
  try {
    // Query the stakedtokens table scoped by the user to find all DAOs they've staked to
    const stakedResponse = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: account,
          table: "stakedtokens",
          limit: 100,
        }),
      }
    );
    
    const stakedData = await stakedResponse.json();
    console.log("User staked tokens data:", stakedData);
    
    // Also check stakedassets table for NFT staking
    const stakedNftResponse = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: DAO_CONTRACT,
          scope: account,
          table: "stakedassets",
          limit: 100,
        }),
      }
    );
    
    const stakedNftData = await stakedNftResponse.json();
    console.log("User staked NFTs data:", stakedNftData);
    
    // Collect unique DAO names from both tables
    const daoNames = new Set<string>();
    
    // From stakedtokens - each row has dao_name field
    for (const row of stakedData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) {
        daoNames.add(daoName);
      }
    }
    
    // From stakedassets - each row has dao_name field
    for (const row of stakedNftData.rows || []) {
      const daoName = row.dao_name || row.daoname || row.dao;
      if (daoName) {
        daoNames.add(daoName);
      }
    }
    
    if (daoNames.size === 0) {
      return [];
    }
    
    // Fetch full DAO info for each DAO the user is a member of
    const allDaos = await fetchAllDaos();
    return allDaos.filter(dao => daoNames.has(dao.dao_name));
    
  } catch (error) {
    console.error("Error fetching user DAOs:", error);
    return [];
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
    console.log("Proposals data:", data);
    
    const now = Math.floor(Date.now() / 1000);
    
    return (data.rows || []).map((row: Record<string, unknown>) => {
      const choices = row.choices as ProposalChoice[] || [];
      const outcome = row.outcome as number || 0;
      const endTime = row.end_time as number || 0;
      
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
      
      // Determine status based on outcome and end_time
      let status: "pending" | "active" | "passed" | "rejected" | "executed" = "pending";
      if ((outcome === 0 || outcome === 1) && endTime > now) {
        status = "active";  // Voting in progress
      } else if ((outcome === 0 || outcome === 1) && endTime <= now) {
        status = "pending"; // Voting ended but not yet finalized
      } else if (outcome === 2) {
        status = "passed";
      } else if (outcome === 3) {
        status = "rejected";
      } else if (outcome === 4) {
        status = "executed";
      } else {
        status = (OUTCOME_STATUS[outcome] as typeof status) || "pending";
      }
      
      // Determine voting type based on contract's proposal_type field
      // Contract uses: 0 = Yes/No/Abstain, 1 = Most Votes Wins, 2 = Token Transfer, 3 = NFT Transfer, 4 = Ranked Choice
      const contractProposalType = (row.proposal_type as number) ?? 0;
      const actions = (row.actions as ProposalAction[]) || [];
      
      let votingType: number;
      
      // Check for transfer proposals first (they use Yes/No voting but are categorized as TOKEN_TRANSFER)
      if (actions.some(a => a.action === "transfer")) {
        votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER; // 4
      } else {
        // Map contract proposal_type to our voting type constants
        switch (contractProposalType) {
          case 0:
            votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN; // 1
            break;
          case 1:
            // Check for [RANKED] marker in description to distinguish ranked choice from most votes wins
            const description = (row.description as string) || "";
            if (description.startsWith("[RANKED]")) {
              votingType = PROPOSAL_VOTING_TYPES.RANKED_CHOICE; // 3
            } else {
              votingType = PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS; // 2
            }
            break;
          case 2:
            votingType = PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER; // Token Transfer
            break;
          case 3:
            votingType = PROPOSAL_VOTING_TYPES.NFT_TRANSFER; // NFT Transfer
            break;
          case 4:
            // Legacy: proposal_type 4 was used for ranked choice, but contract overwrites choices to Yes/No/Abstain
            // Treat it as ranked choice for display purposes, but note the choices may be wrong from contract
            votingType = PROPOSAL_VOTING_TYPES.RANKED_CHOICE;
            break;
          default:
            votingType = PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN; // Default to Yes/No
        }
      }
      
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
        token_receivers: (row.token_receivers as { wax_account: string; quantity: string; contract: string }[]) || [],
        nft_receivers: (row.nft_receivers as { wax_account: string; asset_ids: string[] }[]) || [],
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

// Build action for creating a new DAO (Stake to DAO - Custodial)
// dao_type: 3 = Token Staking
export function buildCreateDaoAction(
  creator: string,
  config: {
    daoName: string;
    tokenContract: string;
    tokenSymbol: string;
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
  
  return {
    account: DAO_CONTRACT,
    name: "createdao",
    authorization: [{ actor: creator, permission: "active" }],
    data: {
      user: creator,
      daoname: config.daoName,
      dao_type: 4, // Stake Tokens (Custodial) - tokens transferred to dao.waxdao contract
      gov_token_contract: config.tokenContract || "",
      gov_token_symbol: config.tokenSymbol || "",
      gov_farm_name: "", // Not needed for Token Balance DAOs
      gov_schemas: [],
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
      proposal_type: 0, // Yes/No/Abstain
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
      proposal_type: 1, // Most Votes Wins
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
      description: `[RANKED] ${proposal.description}`, // Marker to identify ranked choice proposals
      proposal_type: 1, // Use Most Votes Wins type (1) to preserve custom choices
      choices: proposal.options.map((opt, idx) => ({ choice: idx, description: opt, total_votes: 0 })),
      actions: [],
      token_receivers: [],
      nft_receivers: [],
      proof_asset_ids: [],
    },
  };
}

// Build action for voting on a Yes/No/Abstain proposal
export function buildVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  vote: "yes" | "no" | "abstain",
  voteWeight?: string // Token quantity string for Type 4 DAOs (e.g., "540.14048487 WAX")
) {
  // Convert vote string to choice index (0=yes, 1=no, 2=abstain)
  const choiceMap: Record<string, number> = { yes: 0, no: 1, abstain: 2 };
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceMap[vote],
    asset_ids: [],
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
export function buildMultiOptionVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  choiceIndex: number,
  voteWeight?: string
) {
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceIndex,
    asset_ids: [],
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
export function buildRankedChoiceVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  choiceIndex: number, // Single choice index (same as multi-option)
  voteWeight?: string
) {
  const data: Record<string, unknown> = {
    user: voter,
    dao: daoName,
    proposal_id: proposalId,
    choice: choiceIndex,
    asset_ids: [],
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
      proposal_type: 2, // Token Transfer type
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
      proposal_type: 3, // NFT transfer type
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
    // First fetch all users to debug the table structure
    const response = await fetch("https://wax.eosphere.io/v1/chain/get_table_rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: true,
        code: DAO_CONTRACT,
        scope: daoName,
        table: "users",
        limit: 100,
      }),
    });
    const data = await response.json();
    console.log("Users table data for DAO", daoName, ":", data);
    
    // Check if user exists in any row (checking common field names)
    if (data.rows && data.rows.length > 0) {
      return data.rows.some((row: any) => 
        row.user === user || 
        row.account === user || 
        row.wallet === user ||
        row.name === user
      );
    }
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
