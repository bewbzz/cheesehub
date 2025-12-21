// Local DAO profile data for descriptions and metadata not stored on-chain
export interface DaoProfile {
  description: string;
  logo?: string;
}

export const DAO_PROFILES: Record<string, DaoProfile> = {
  "aarmetaverse": {
    description: `AarMetaverse DAO is the official decentralized governance hub for the AarMetaverse game ecosystem on the WAX blockchain. Token holders can vote on key game mechanics, seasonal rewards, new NFT integrations, and token distribution rules. Community participation drives the evolution of the project.

1 AAR = 1 vote

Proposals require 1000 AAR to be submitted

All AAR holders can vote on open proposals`,
  },
  // Add more DAO profiles here as needed
};

export function getDaoProfile(daoName: string): DaoProfile | undefined {
  return DAO_PROFILES[daoName.toLowerCase()];
}
