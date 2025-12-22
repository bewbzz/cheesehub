import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DaoInfo, Proposal, fetchProposals, fetchDaoTreasury, fetchDaoTreasuryNFTs, TreasuryBalance, TreasuryNFT, DAO_TYPES, PROPOSER_TYPES } from "@/lib/dao";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";
import { DaoStaking } from "./DaoStaking";
import { TreasuryDeposit } from "./TreasuryDeposit";
import { TreasuryNFTDeposit } from "./TreasuryNFTDeposit";
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
  ImageIcon
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

export function DaoDetail({ dao, open, onClose }: DaoDetailProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("info");
  const [treasury, setTreasury] = useState<TreasuryBalance[]>([]);
  const [treasuryNFTs, setTreasuryNFTs] = useState<TreasuryNFT[]>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);

  useEffect(() => {
    if (open) {
      loadProposals();
      setActiveSection("info");
    }
  }, [open, dao.dao_name]);

  useEffect(() => {
    if (activeSection === "treasury" && treasury.length === 0) {
      loadTreasury();
    }
  }, [activeSection]);

  async function loadProposals() {
    setLoading(true);
    try {
      const data = await fetchProposals(dao.dao_name);
      setProposals(data);
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

  const menuItems: MenuItem[] = [
    { id: "info", label: "DAO Info", icon: <Shield className="h-4 w-4" /> },
    { id: "stake", label: "Stake", icon: <Wallet className="h-4 w-4" /> },
    { id: "new-proposal", label: "New Proposal", icon: <Plus className="h-4 w-4" /> },
    { id: "active", label: "Active Proposals", icon: <Vote className="h-4 w-4" />, badge: activeProposals.length },
    { id: "past", label: "Past Proposals", icon: <History className="h-4 w-4" />, badge: pastProposals.length },
    { id: "treasury", label: "Treasury", icon: <Coins className="h-4 w-4" /> },
    { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isTransacting && onClose()}>
      <DialogContent 
        className={cn("max-w-5xl max-h-[90vh] p-0 overflow-hidden", isTransacting && "wallet-transacting")}
        onPointerDownOutside={(e) => isTransacting && e.preventDefault()}
        onEscapeKeyDown={(e) => isTransacting && e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-cheese/10 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-cheese" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl truncate">{dao.dao_name}</DialogTitle>
                <Badge variant="outline" className="text-cheese border-cheese/30 shrink-0">
                  {DAO_TYPES[dao.dao_type] || "Unknown"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                Created by {dao.creator} on {createdDate}
              </p>
            </div>
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
          <ScrollArea className="flex-1">
            <div className="p-4">
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
                </div>
              )}

              {/* Stake Section */}
              {activeSection === "stake" && (
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
                    <div className="space-y-3">
                      {activeProposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.proposal_id}
                          proposal={proposal}
                          onVote={loadProposals}
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
                    <div className="space-y-3">
                      {pastProposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.proposal_id}
                          proposal={proposal}
                          onVote={loadProposals}
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
                    onTransactionStart={() => setIsTransacting(true)}
                    onTransactionEnd={() => setIsTransacting(false)}
                  />

                  {/* Withdrawal Info */}
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">How to withdraw from treasury?</p>
                    <p>Create a <span className="text-cheese font-medium">Token Transfer</span> or <span className="text-cheese font-medium">NFT Transfer</span> proposal. Once the proposal passes, the assets will be transferred to the specified recipient.</p>
                  </div>
                </div>
              )}

              {/* Members Section (Placeholder) */}
              {activeSection === "members" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-cheese" />
                    Members
                  </h3>
                  {dao.authors && dao.authors.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">DAO Authors (can create proposals)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dao.authors.map((author) => (
                          <div
                            key={author}
                            className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="h-8 w-8 rounded-full bg-cheese/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-cheese" />
                            </div>
                            <span className="font-medium truncate">{author}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Open Membership</p>
                      <p className="text-sm">This DAO doesn't have a restricted author list</p>
                    </div>
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
