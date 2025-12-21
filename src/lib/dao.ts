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

// Outcome codes from WaxDAO contract
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
  status: "pending" | "active" | "passed" | "rejected" | "executed";
  yes_votes: number;
  no_votes: number;
  abstain_votes: number;
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
      
      return {
        proposal_id: (row.proposal_id as number) || (row.id as number) || 0,
        dao_name: daoName,
        proposer: (row.author as string) || (row.proposer as string) || "",
        title: (row.title as string) || "",
        description: (row.description as string) || "",
        proposal_type: (row.proposal_type as string) || (row.type as string) || "standard",
        status,
        yes_votes: yesVotes,
        no_votes: noVotes,
        abstain_votes: abstainVotes,
        start_time: (row.start_time as string) || "",
        end_time: endTime.toString(),
        end_time_ts: endTime,
        total_votes: (row.total_votes as number) || 0,
        actions: (row.actions as ProposalAction[]) || [],
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
    name: "createprop",
    authorization: [{ actor: proposer, permission: "active" }],
    data: {
      proposer,
      dao_name: daoName,
      title: proposal.title,
      description: proposal.description,
      proposal_type: "transfer",
      actions: [transferAction],
    },
  };
}
