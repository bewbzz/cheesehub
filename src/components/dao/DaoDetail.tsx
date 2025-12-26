import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DaoInfo, Proposal, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs, TreasuryBalance, TreasuryNFT, DAO_TYPES, PROPOSER_TYPES, getIpfsUrl, checkDaoMembership, fetchDaoMembers, DaoMember, UserVote, fetchUserVote, fetchDaoTotalStakedWeight } from "@/lib/dao";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";
import { DaoStaking } from "./DaoStaking";
import { TreasuryDeposit } from "./TreasuryDeposit";
import { TreasuryNFTDeposit } from "./TreasuryNFTDeposit";
import { useWax } from "@/context/WaxContext";
import { saveVote, getVotesForDao } from "@/lib/voteStorage";
import { 
  Users, 
  FileText, 
  Coins, 
  Plus, 
  Loader2, 
  Clock, 
  Vote, 
  Shield,
  History,
  ChevronRight,
  Wallet,
  ImageIcon,
  UserPlus,
  UserMinus,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DaoDetailProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
}

type Section = "info" | "stake" | "new-proposal" | "active" | "past" | "treasury" | "members";

interface MenuItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function DaoDetail({ dao: initialDao, open, onClose }: DaoDetailProps) {
  const { isConnected, accountName, joinDao, leaveDao } = useWax();
  const [dao, setDao] = useState<DaoInfo>(initialDao);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [treasury, setTreasury] = useState<TreasuryBalance[]>([]);
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [members, setMembers] = useState<DaoMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  // Track which proposals the user has voted on (persists in localStorage per account)
  const [votedProposals, setVotedProposals] = useState<Record<number, UserVote>>({});

  // Update dao when initialDao changes
  useEffect(() => {
    setDao(initialDao);
  }, [initialDao]);

  // Fetch total staked weight for the DAO
  useEffect(() => {
    async function loadTotalStakedWeight() {
      if (open && dao.dao_name) {
        const totalWeight = await fetchDaoTotalStakedWeight(dao.dao_name);
        setDao(prev => ({ ...prev, total_staked_weight: totalWeight }));
      }
    }
    loadTotalStakedWeight();
  }, [open, dao.dao_name]);

  // Load votes from localStorage when account changes
  useEffect(() => {
    if (accountName) {
      const storedVotes = getVotesForDao(accountName, dao.dao_name);
      console.log("Loaded votes from localStorage:", storedVotes);
      setVotedProposals(storedVotes);
    } else {
      setVotedProposals({});
    }
  }, [accountName, dao.dao_name]);

  // Function to record a vote and refresh proposals
  const handleVote = async (proposalId: number, vote: UserVote) => {
    // Save to state
    setVotedProposals(prev => ({ ...prev, [proposalId]: vote }));
    
    // Persist to localStorage
    if (accountName) {
      saveVote(accountName, dao.dao_name, proposalId, vote);
    }
    
    // Wait a bit for blockchain to process, then reload proposals to get updated vote counts
    await new Promise(resolve => setTimeout(resolve, 2000));
    loadProposals();
  };

  // Token Balance DAOs (type 4) don't require explicit joining
  const isTokenBalanceDao = dao.dao_type === 4;

  useEffect(() => {
    if (open) {
      loadProposals();
      setActiveSection("info");
      // Skip membership check for Token Balance DAOs - anyone with tokens can participate
      if (!isTokenBalanceDao) {
        checkMembership();
      }
    }
  }, [open, dao.dao_name, accountName, isTokenBalanceDao]);

  useEffect(() => {
    if (activeSection === "treasury" && treasury.length === 0) {
      loadTreasury();
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "members" && members.length === 0) {
      loadMembers();
    }
  }, [activeSection]);

  async function checkMembership() {
    if (!accountName) {
      setIsMember(false);
      return;
    }
    setMembershipLoading(true);
    try {
      const result = await checkDaoMembership(dao.dao_name, accountName);
      setIsMember(result);
    } catch (error) {
      console.error("Failed to check membership:", error);
    } finally {
      setMembershipLoading(false);
    }
  }

  async function loadMembers() {
    setMembersLoading(true);
    try {
      const data = await fetchDaoMembers(dao.dao_name);
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleJoinDao() {
    setMembershipLoading(true);
    try {
      const result = await joinDao(dao.dao_name);
      if (result) {
        setIsMember(true);
        loadMembers();
      }
    } finally {
      setMembershipLoading(false);
    }
  }

  async function handleLeaveDao() {
    setMembershipLoading(true);
    try {
      const result = await leaveDao(dao.dao_name);
      if (result) {
        setIsMember(false);
        loadMembers();
      }
    } finally {
      setMembershipLoading(false);
    }
  }

  async function loadProposals() {
    setLoading(true);
    try {
      const data = await fetchProposals(dao.dao_name);
      setProposals(data);
      
      // Fetch existing votes from blockchain for connected user
      if (accountName) {
        console.log("Fetching votes for user:", accountName, "dao:", dao.dao_name);
        
        // First, load any locally stored votes (these have complete choice_index info)
        const localVotes = getVotesForDao(accountName, dao.dao_name);
        console.log("Loaded local votes:", localVotes);
        
        const existingVotes: Record<number, UserVote> = {};
        
        // Fetch votes in parallel for better performance
        const votePromises = data.map(async (proposal) => {
          try {
            console.log("Checking vote for proposal:", proposal.proposal_id);
            const vote = await fetchUserVote(dao.dao_name, proposal.proposal_id, accountName);
            console.log("Vote result for proposal", proposal.proposal_id, ":", vote);
            if (vote) {
              return { proposalId: proposal.proposal_id, vote };
            }
          } catch (err) {
            console.error("Error fetching vote for proposal", proposal.proposal_id, ":", err);
          }
          return null;
        });
        
        const votes = await Promise.all(votePromises);
        votes.forEach((result) => {
          if (result) {
            const proposalId = result.proposalId;
            const blockchainVote = result.vote;
            
            // Check if we have a locally stored vote with complete choice info
            const localVote = localVotes[proposalId];
            if (localVote && localVote.choice_index !== -1) {
              // Prefer local vote as it has the complete choice_index
              // But use blockchain weight as it's authoritative
              existingVotes[proposalId] = {
                ...localVote,
                weight: blockchainVote.weight, // Use blockchain weight as truth
              };
              console.log(`Using local vote for proposal ${proposalId}:`, existingVotes[proposalId]);
            } else {
              existingVotes[proposalId] = blockchainVote;
            }
          }
        });
        
        console.log("Merged votes (local + blockchain):", existingVotes);
        if (Object.keys(existingVotes).length > 0) {
          setVotedProposals(prev => ({ ...prev, ...existingVotes }));
        }
      }
    } catch (error) {
      console.error("Failed to load proposals:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTreasury() {
    setTreasuryLoading(true);
    try {
      const [tokenData, nftData] = await Promise.all([
        fetchDaoTreasury(dao.dao_name),
        fetchDaoTreasuryNFTs(dao.dao_name)
      ]);
      setTreasury(tokenData);
      setTreasuryNFTs(nftData);
    } catch (error) {
      console.error("Failed to load treasury:", error);
    } finally {
      setTreasuryLoading(false);
    }
  }

  const tokenDisplay = dao.token_symbol !== "0,NULL" 
    ? dao.token_symbol.split(",")[1] 
    : null;

  const createdDate = dao.time_created 
    ? new Date(dao.time_created * 1000).toLocaleDateString()
    : "Unknown";

  const activeProposals = proposals.filter((p) => p.status === "active");
  // Include pending (ended but not finalized), passed, rejected, executed in past proposals
  const pastProposals = proposals.filter((p) => p.status !== "active");

  // Type 5 (Non-Custodial NFTs) don't require staking UI
  // Type 4 (Token Balance) needs the tab for registration
  const showStakingTab = dao.dao_type !== 5;

  const menuItems: MenuItem[] = [
    { id: "info", label: "DAO Info", icon: <Shield className="h-4 w-4" /> },
    ...(showStakingTab ? [{ id: "stake" as Section, label: "Stake", icon: <Wallet className="h-4 w-4" /> }] : []),
    { id: "new-proposal", label: "New Proposal", icon: <Plus className="h-4 w-4" /> },
    { id: "active", label: "Active Proposals", icon: <Vote className="h-4 w-4" />, badge: activeProposals.length },
    { id: "past", label: "Past Proposals", icon: <History className="h-4 w-4" />, badge: pastProposals.length },
    { id: "treasury", label: "Treasury", icon: <Coins className="h-4 w-4" /> },
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50 pr-12">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-cheese/10 flex items-center justify-center shrink-0 overflow-hidden">
              {dao.logo ? (
                <img 
                  src={getIpfsUrl(dao.logo)} 
                  alt={dao.dao_name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Users className={cn("h-6 w-6 text-cheese", dao.logo && "hidden")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl truncate">{dao.dao_name}</DialogTitle>
                <Badge variant="outline" className="text-cheese border-cheese/30 shrink-0">
                  {DAO_TYPES[dao.dao_type] || "Unknown"}
                </Badge>
                {isConnected && (
                  isTokenBalanceDao ? (
                    <Badge className="bg-cheese/20 text-cheese border-cheese/30 shrink-0">
                      <Coins className="h-3 w-3 mr-1" />
                      Token Holder
                    </Badge>
                  ) : isMember ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Member
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      Not a Member
                    </Badge>
                  )
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">
                  Created by {dao.creator} on {createdDate}
                </p>
              </div>
            </div>
            {/* Join/Leave Button - Not shown for Token Balance DAOs */}
            {isConnected && !isTokenBalanceDao && (
              <div className="shrink-0">
                {membershipLoading ? (
                  <Button size="sm" disabled>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </Button>
                ) : isMember ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleLeaveDao}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <UserMinus className="h-4 w-4 mr-1" />
                    Leave
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={handleJoinDao}
                    className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Join DAO
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90vh-100px)]">
          {/* Sidebar Navigation */}
          <div className="w-48 border-r border-border/50 bg-muted/20 shrink-0">
            <nav className="p-2 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    activeSection === item.id
                      ? "bg-cheese/10 text-cheese font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                  {activeSection === item.id && (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1 min-w-0 overflow-hidden">
            <div className="p-4 overflow-hidden" style={{ maxWidth: 'calc(100% - 2rem)' }}>
              {/* Loading State */}
              {loading && activeSection !== "info" && activeSection !== "new-proposal" && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-cheese" />
                </div>
              )}

              {/* DAO Info Section */}
              {activeSection === "info" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-cheese" />
                    DAO Information
                  </h3>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Vote className="h-4 w-4 mx-auto text-cheese mb-1" />
                      <p className="text-lg font-bold">{(dao.threshold ?? 0).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Pass Threshold</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Clock className="h-4 w-4 mx-auto text-cheese mb-1" />
                      <p className="text-lg font-bold">{dao.hours_per_proposal ?? 0}h</p>
                      <p className="text-xs text-muted-foreground">Vote Duration</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <FileText className="h-4 w-4 mx-auto text-cheese mb-1" />
                      <p className="text-lg font-bold">{proposals.length}</p>
                      <p className="text-xs text-muted-foreground">Total Proposals</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <Coins className="h-4 w-4 mx-auto text-cheese mb-1" />
                      <p className="text-lg font-bold truncate text-sm">{dao.proposal_cost ?? "0"}</p>
                      <p className="text-xs text-muted-foreground">Proposal Cost</p>
                    </div>
                  </div>

                  {/* Governance Settings */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Governance Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between p-2 bg-background/50 rounded">
                        <span className="text-muted-foreground">DAO Type:</span>
                        <span className="font-medium">{DAO_TYPES[dao.dao_type]}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-background/50 rounded">
                        <span className="text-muted-foreground">Who can propose:</span>
                        <span className="font-medium">{PROPOSER_TYPES[dao.proposer_type]}</span>
                      </div>
                      {tokenDisplay && (
                        <div className="flex justify-between p-2 bg-background/50 rounded">
                          <span className="text-muted-foreground">Token:</span>
                          <span className="font-medium">{tokenDisplay} ({dao.token_contract})</span>
                        </div>
                      )}
                      <div className="flex justify-between p-2 bg-background/50 rounded">
                        <span className="text-muted-foreground">Min votes required:</span>
                        <span className="font-medium">{(dao.minimum_votes ?? 0).toLocaleString()}</span>
                      </div>
                      {dao.authors && dao.authors.length > 0 && (
                        <div className="flex justify-between p-2 bg-background/50 rounded col-span-full">
                          <span className="text-muted-foreground">Authors:</span>
                          <span className="font-medium">{dao.authors.join(", ")}</span>
                        </div>
                      )}
                      {dao.gov_schemas && dao.gov_schemas.length > 0 && (
                        <div className="p-2 bg-background/50 rounded col-span-full">
                          <span className="text-muted-foreground">NFT Collections: </span>
                          <span className="font-medium">
                            {dao.gov_schemas.map(s => `${s.collection_name}/${s.schema_name}`).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Section */}
                  {dao.description && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {dao.description}
                      </p>
                    </div>
                  )}

                  {/* Cover Image Section */}
                  {dao.cover_image && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-cheese" />
                        Cover Image
                      </h4>
                      <div className="rounded-lg overflow-hidden">
                        <img 
                          src={getIpfsUrl(dao.cover_image)} 
                          alt={`${dao.dao_name} cover`}
                          className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(getIpfsUrl(dao.cover_image), '_blank')}
                          title="Click to view full size"
                          onError={(e) => {
                            (e.currentTarget.parentElement?.parentElement as HTMLElement)?.classList.add('hidden');
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stake Section */}
              {activeSection === "stake" && showStakingTab && (
                <DaoStaking dao={dao} />
              )}

              {/* New Proposal Section */}
              {activeSection === "new-proposal" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Plus className="h-5 w-5 text-cheese" />
                    Create New Proposal
                  </h3>
                  <CreateProposal
                    daoName={dao.dao_name}
                    proposalCost={dao.proposal_cost}
                    onSuccess={() => {
                      loadProposals();
                      setActiveSection("active");
                    }}
                    onCancel={() => setActiveSection("info")}
                  />
                </div>
              )}

              {/* Active Proposals Section */}
              {activeSection === "active" && !loading && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Vote className="h-5 w-5 text-cheese" />
                      Active Proposals
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => setActiveSection("new-proposal")}
                      className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </div>
                  {activeProposals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Vote className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No active proposals</p>
                      <Button
                        variant="link"
                        onClick={() => setActiveSection("new-proposal")}
                        className="text-cheese"
                      >
                        Create the first one
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 w-full max-w-full overflow-hidden">
                      {activeProposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.proposal_id}
                          proposal={proposal}
                          dao={dao}
                          initialVote={votedProposals[proposal.proposal_id] || null}
                          onVote={handleVote}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Past Proposals Section */}
              {activeSection === "past" && !loading && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-cheese" />
                    Past Proposals
                  </h3>
                  {pastProposals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No past proposals yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 w-full max-w-full overflow-hidden">
                      {pastProposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.proposal_id}
                          proposal={proposal}
                          dao={dao}
                          initialVote={votedProposals[proposal.proposal_id] || null}
                          onVote={handleVote}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Treasury Section */}
              {activeSection === "treasury" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Coins className="h-5 w-5 text-cheese" />
                      Treasury
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadTreasury}
                      disabled={treasuryLoading}
                    >
                      {treasuryLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Refresh"
                      )}
                    </Button>
                  </div>

                  {/* Treasury Balances */}
                  {treasuryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-cheese" />
                    </div>
                  ) : treasury.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                      <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No Treasury Balance</p>
                      <p className="text-sm">Deposit tokens below to fund this DAO</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {treasury.map((balance, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-cheese/10 flex items-center justify-center">
                              <Coins className="h-5 w-5 text-cheese" />
                            </div>
                            <div>
                              <p className="font-medium">{balance.symbol}</p>
                              <p className="text-xs text-muted-foreground">{balance.contract}</p>
                            </div>
                          </div>
                          <p className="text-lg font-bold">{balance.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Treasury NFTs */}
                  {!treasuryLoading && treasuryNFTs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-cheese" />
                        <h4 className="font-medium text-sm">NFTs in Treasury</h4>
                        <Badge variant="secondary" className="text-xs">{treasuryNFTs.length}</Badge>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                        {treasuryNFTs.map((nft) => (
                          <div
                            key={nft.asset_id}
                            className="relative aspect-square rounded-lg overflow-hidden border border-border/50"
                          >
                            {nft.image ? (
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                              <p className="text-[8px] text-white truncate">{nft.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Token Deposit Form */}
                  <TreasuryDeposit 
                    daoName={dao.dao_name} 
                    onSuccess={loadTreasury}
                  />

                  {/* NFT Deposit Form */}
                  <TreasuryNFTDeposit 
                    daoName={dao.dao_name} 
                    onSuccess={loadTreasury}
                  />

                  {/* Withdrawal Info */}
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">How to withdraw from treasury?</p>
                    <p>Create a <span className="text-cheese font-medium">Token Transfer</span> or <span className="text-cheese font-medium">NFT Transfer</span> proposal. Once the proposal passes, the assets will be transferred to the specified recipient.</p>
                  </div>
                </div>
              )}

              {/* Members Section */}
              {activeSection === "members" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-cheese" />
                      {isTokenBalanceDao ? "Participants" : "Members"}
                      {!isTokenBalanceDao && members.length > 0 && (
                        <Badge variant="secondary">{members.length}</Badge>
                      )}
                    </h3>
                    {!isTokenBalanceDao && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadMembers}
                        disabled={membersLoading}
                      >
                        {membersLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Token Balance DAO Info */}
                  {isTokenBalanceDao && (
                    <div className="space-y-4">
                      <div className="p-4 bg-cheese/10 rounded-lg border border-cheese/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-10 w-10 rounded-full bg-cheese/20 flex items-center justify-center">
                            <Coins className="h-5 w-5 text-cheese" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Token Balance DAO</p>
                            <p className="text-sm text-muted-foreground">No membership required</p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This is a <span className="text-cheese font-medium">Token Balance DAO</span>. 
                          Anyone holding <span className="font-medium text-foreground">{tokenDisplay || "the governance token"}</span> can 
                          participate in voting. Your voting power is determined by your token balance at the time of voting.
                        </p>
                      </div>

                      {/* DAO Authors Section for Token Balance DAOs */}
                      {dao.authors && dao.authors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground font-medium">DAO Authors (can create proposals)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {dao.authors.map((author) => (
                              <div
                                key={author}
                                className="flex items-center gap-2 p-3 bg-cheese/10 rounded-lg border border-cheese/20"
                              >
                                <div className="h-8 w-8 rounded-full bg-cheese/20 flex items-center justify-center">
                                  <Shield className="h-4 w-4 text-cheese" />
                                </div>
                                <span className="font-medium truncate">{author}</span>
                                <Badge variant="outline" className="ml-auto text-xs border-cheese/30 text-cheese">Author</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Non-Token Balance DAO Members */}
                  {!isTokenBalanceDao && (
                    <>
                      {/* DAO Authors Section */}
                      {dao.authors && dao.authors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground font-medium">DAO Authors (can create proposals)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {dao.authors.map((author) => (
                              <div
                                key={author}
                                className="flex items-center gap-2 p-3 bg-cheese/10 rounded-lg border border-cheese/20"
                              >
                                <div className="h-8 w-8 rounded-full bg-cheese/20 flex items-center justify-center">
                                  <Shield className="h-4 w-4 text-cheese" />
                                </div>
                                <span className="font-medium truncate">{author}</span>
                                <Badge variant="outline" className="ml-auto text-xs border-cheese/30 text-cheese">Author</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Joined Members Section */}
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">
                          Joined Members {members.length > 0 && `(${members.length})`}
                        </p>
                        {membersLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-cheese" />
                          </div>
                        ) : members.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="font-medium">No Members Yet</p>
                            <p className="text-sm">Be the first to join this DAO!</p>
                            {isConnected && !isMember && (
                              <Button
                                size="sm"
                                onClick={handleJoinDao}
                                className="mt-3 bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                                disabled={membershipLoading}
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Join DAO
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {members.map((member) => (
                              <div
                                key={member.user}
                                className={cn(
                                  "flex items-center gap-2 p-3 rounded-lg",
                                  member.user === accountName 
                                    ? "bg-green-500/10 border border-green-500/20" 
                                    : "bg-muted/50"
                                )}
                              >
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center",
                                  member.user === accountName ? "bg-green-500/20" : "bg-muted"
                                )}>
                                  <Users className={cn(
                                    "h-4 w-4",
                                    member.user === accountName ? "text-green-500" : "text-muted-foreground"
                                  )} />
                                </div>
                                <span className="font-medium truncate">{member.user}</span>
                                {member.user === accountName && (
                                  <Badge className="ml-auto bg-green-500/20 text-green-500 text-xs">You</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Info about joining */}
                      <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Membership Required</p>
                        <p>Members must join this DAO to participate in voting. Click the "Join DAO" button to become a member.</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
