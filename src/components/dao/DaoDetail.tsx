import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DaoInfo, Proposal, fetchProposals, DAO_TYPES, PROPOSER_TYPES } from "@/lib/dao";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";
import { Users, FileText, Coins, Plus, Loader2, Clock, Vote, Shield } from "lucide-react";

interface DaoDetailProps {
  dao: DaoInfo;
  open: boolean;
  onClose: () => void;
}

export function DaoDetail({ dao, open, onClose }: DaoDetailProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateProposal, setShowCreateProposal] = useState(false);

  useEffect(() => {
    if (open) {
      loadProposals();
    }
  }, [open, dao.dao_name]);

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

  const tokenDisplay = dao.token_symbol !== "0,NULL" 
    ? dao.token_symbol.split(",")[1] 
    : null;

  const createdDate = dao.time_created 
    ? new Date(dao.time_created * 1000).toLocaleDateString()
    : "Unknown";

  const activeProposals = proposals.filter((p) => p.status === "active");
  const pastProposals = proposals.filter((p) => p.status !== "active" && p.status !== "pending");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {/* DAO Icon */}
            <div className="h-16 w-16 rounded-xl bg-cheese/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-cheese" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-2xl">{dao.dao_name}</DialogTitle>
                <Badge variant="outline" className="text-cheese border-cheese/30">
                  {DAO_TYPES[dao.dao_type] || "Unknown"}
                </Badge>
              </div>
              <p className="text-muted-foreground">Created by {dao.creator} on {createdDate}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Vote className="h-4 w-4 mx-auto text-cheese mb-1" />
            <p className="text-lg font-bold">{dao.threshold.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Pass Threshold</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-cheese mb-1" />
            <p className="text-lg font-bold">{dao.hours_per_proposal}h</p>
            <p className="text-xs text-muted-foreground">Vote Duration</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <FileText className="h-4 w-4 mx-auto text-cheese mb-1" />
            <p className="text-lg font-bold">{proposals.length}</p>
            <p className="text-xs text-muted-foreground">Proposals</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Coins className="h-4 w-4 mx-auto text-cheese mb-1" />
            <p className="text-lg font-bold truncate text-sm">{dao.proposal_cost}</p>
            <p className="text-xs text-muted-foreground">Proposal Cost</p>
          </div>
        </div>

        {/* Governance Info */}
        <div className="bg-muted/30 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-cheese" />
            <span className="font-medium">Governance Settings</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {tokenDisplay && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token:</span>
                <span className="font-medium">{tokenDisplay} ({dao.token_contract})</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Who can propose:</span>
              <span className="font-medium">{PROPOSER_TYPES[dao.proposer_type]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min votes required:</span>
              <span className="font-medium">{dao.minimum_votes.toLocaleString()}</span>
            </div>
            {dao.authors.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Authors:</span>
                <span className="font-medium">{dao.authors.join(", ")}</span>
              </div>
            )}
            {dao.gov_schemas.length > 0 && (
              <div className="col-span-full">
                <span className="text-muted-foreground">NFT Collections: </span>
                <span className="font-medium">
                  {dao.gov_schemas.map(s => `${s.collection_name}/${s.schema_name}`).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Proposals Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Proposals</h3>
            <Button
              size="sm"
              onClick={() => setShowCreateProposal(!showCreateProposal)}
              className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Proposal
            </Button>
          </div>

          {/* Create Proposal Form */}
          {showCreateProposal && (
            <CreateProposal
              daoName={dao.dao_name}
              onSuccess={() => {
                setShowCreateProposal(false);
                loadProposals();
              }}
              onCancel={() => setShowCreateProposal(false)}
            />
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cheese" />
            </div>
          )}

          {/* Proposals Tabs */}
          {!loading && (
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="active" className="flex-1">
                  Active ({activeProposals.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="flex-1">
                  Past ({pastProposals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-3 mt-4">
                {activeProposals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No active proposals
                  </p>
                ) : (
                  activeProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.proposal_id}
                      proposal={proposal}
                      onVote={loadProposals}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-3 mt-4">
                {pastProposals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No past proposals
                  </p>
                ) : (
                  pastProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.proposal_id}
                      proposal={proposal}
                      onVote={loadProposals}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
