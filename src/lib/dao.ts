// WaxDAO DAO Contract Interface
// Contract: dao.waxdao

export const DAO_CONTRACT = "dao.waxdao";

// Fee constants for DAO creation
export const DAO_CREATION_FEE = "250.00000000 WAX";

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
      memo: "dao creation fee",
    },
  };
}

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

// Outcome codes from WaxDAO contract
// WaxDAO proposal voting types
export const PROPOSAL_VOTING_TYPES = {
  YES_NO_ABSTAIN: 1,    // Standard 3-option voting
  MOST_VOTES_WINS: 2,   // Multi-option, highest wins
  RANKED_CHOICE: 3,     // Ranked preference voting
  TOKEN_TRANSFER: 4,    // Treasury withdrawal
} as const;

export const VOTING_TYPE_LABELS: Record<number, string> = {
  1: "Yes/No/Abstain",
  2: "Most Votes Wins",
  3: "Ranked Choice",
  4: "Token Transfer",
  5: "NFT Transfer",
};

export const OUTCOME_STATUS: Record<number, string> = {
  0: "pending",
  1: "pending",
  2: "passed",
  3: "rejected",
  4: "executed",
  5: "active",
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
  choice_name: string;
  total_votes: string;
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
        const votes = parseInt(choice.total_votes) || 0;
        if (choice.choice_name?.toLowerCase() === "yes") {
          yesVotes = votes;
        } else if (choice.choice_name?.toLowerCase() === "no") {
          noVotes = votes;
        } else if (choice.choice_name?.toLowerCase() === "abstain") {
          abstainVotes = votes;
        }
      });
      
      // Determine status based on outcome and end_time
      let status: "pending" | "active" | "passed" | "rejected" | "executed" = "pending";
      if (outcome === 5 && endTime > now) {
        status = "active";
      } else if (outcome === 5 && endTime <= now) {
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
      
      // Determine voting type based on choices or proposal_type
      let votingType = (row.voting_type as number) || 1;
      const proposalType = (row.proposal_type as string) || (row.type as string) || "standard";
      
      // If proposal has actions with transfer, it's a token transfer
      const actions = (row.actions as ProposalAction[]) || [];
      if (actions.some(a => a.action === "transfer")) {
        votingType = 4;
      } else if (choices.length > 3) {
        // More than 3 choices suggests multi-option or ranked
        votingType = (row.voting_type as number) || 2;
      }
      
      return {
        proposal_id: (row.proposal_id as number) || (row.id as number) || 0,
        dao_name: daoName,
        proposer: (row.author as string) || (row.proposer as string) || "",
        title: (row.title as string) || "",
        description: (row.description as string) || "",
        proposal_type: proposalType,
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
      };
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return [];
  }
}

// Fetch treasury balances for a DAO
export async function fetchDaoTreasury(daoName: string): Promise<TreasuryBalance[]> {
  const balances: TreasuryBalance[] = [];
  
  // Common token contracts to check
  const tokenContracts = [
    { contract: "eosio.token", symbol: "WAX" },
    { contract: "token.waxdao", symbol: "WAXDAO" },
  ];
  
  try {
    // Fetch WAX balance
    for (const token of tokenContracts) {
      try {
        const response = await fetch(
          `https://wax.eosusa.io/v1/chain/get_currency_balance`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: token.contract,
              account: daoName,
              symbol: token.symbol,
            }),
          }
        );
        
        const data = await response.json();
        console.log(`Treasury ${token.symbol} for ${daoName}:`, data);
        
        if (Array.isArray(data) && data.length > 0) {
          // Parse balance string like "100.0000 WAX"
          const balanceStr = data[0];
          const [amountStr, symbol] = balanceStr.split(" ");
          const amount = parseFloat(amountStr);
          const precision = amountStr.includes(".") ? amountStr.split(".")[1].length : 0;
          
          if (amount > 0) {
            balances.push({
              contract: token.contract,
              symbol,
              amount,
              precision,
            });
          }
        }
      } catch (err) {
        console.log(`No ${token.symbol} balance for ${daoName}`);
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
      dao_type: 3, // Token Staking
      gov_token_contract: config.tokenContract || "",
      gov_token_symbol: config.tokenSymbol || "",
      gov_farm_name: null,
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
      proposal_type: proposal.proposalType === "yesnoabs" ? 0 : proposal.proposalType === "mostvotes" ? 1 : 2,
      choices: [],
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
      proposal_type: 1,
      choices: [],
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
      proposal_type: 2,
      choices: [],
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
  vote: "yes" | "no" | "abstain"
) {
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data: {
      voter,
      dao_name: daoName,
      proposal_id: proposalId,
      vote,
    },
  };
}

// Build action for voting on a Most Votes Wins proposal (select one option)
export function buildMultiOptionVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  choiceIndex: number // Index of the selected choice
) {
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data: {
      voter,
      dao_name: daoName,
      proposal_id: proposalId,
      choice: choiceIndex,
    },
  };
}

// Build action for voting on a Ranked Choice proposal
export function buildRankedChoiceVoteAction(
  voter: string,
  daoName: string,
  proposalId: number,
  rankings: number[] // Array of choice indices in order of preference
) {
  return {
    account: DAO_CONTRACT,
    name: "vote",
    authorization: [{ actor: voter, permission: "active" }],
    data: {
      voter,
      dao_name: daoName,
      proposal_id: proposalId,
      rankings,
    },
  };
}

// Fetch user's staked tokens in a DAO
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
          scope: daoName,
          table: "stakers",
          lower_bound: userAccount,
          upper_bound: userAccount,
          limit: 1,
        }),
      }
    );
    
    const data = await response.json();
    console.log("Staked tokens data:", data);
    
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      return {
        balance: row.balance || "0",
        weight: parseInt(row.weight) || 0,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching staked tokens:", error);
    return null;
  }
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

// Fetch user's token balance
export async function fetchUserTokenBalance(
  contract: string,
  symbol: string,
  userAccount: string
): Promise<string> {
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
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return `0 ${symbol}`;
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return `0 ${symbol}`;
  }
}

// Build action for staking tokens
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
      memo: `stake|${daoName}`,
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
    name: "unstake",
    authorization: [{ actor: staker, permission: "active" }],
    data: {
      user: staker,
      daoname: daoName,
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
      to: daoName,
      quantity: quantity,
      memo: "treasury deposit",
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
  // The proposal includes the transfer action that will be executed if passed
  const transferAction: ProposalAction = {
    contract: proposal.transfer.tokenContract,
    action: "transfer",
    data: {
      from: daoName,
      to: proposal.transfer.recipient,
      quantity: proposal.transfer.amount,
      memo: `DAO proposal: ${proposal.title}`,
    },
  };

  return {
    account: DAO_CONTRACT,
    name: "newproposal",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      user: proposer,
      dao: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: "transfer",
      actions: [transferAction],
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
      choices: [],
      actions: [],
      token_receivers: [],
      nft_receivers: [{
        receiver: proposal.transfer.recipient,
        asset_ids: proposal.transfer.assetIds,
      }],
      proof_asset_ids: [],
    },
  };
}
