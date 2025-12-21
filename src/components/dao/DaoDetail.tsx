import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DaoInfo, Proposal, fetchProposals } from "@/lib/dao";
import { ProposalCard } from "./ProposalCard";
import { CreateProposal } from "./CreateProposal";
import { Users, FileText, Coins, Plus, Loader2 } from "lucide-react";

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

  const activeProposals = proposals.filter((p) => p.status === "active");
  const pastProposals = proposals.filter((p) => p.status !== "active" && p.status !== "pending");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {/* DAO Logo */}
            <div className="h-16 w-16 rounded-xl bg-cheese/10 flex items-center justify-center overflow-hidden">
              {dao.logo ? (
                <img
                  src={dao.logo}
                  alt={dao.dao_name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Users className="h-8 w-8 text-cheese" />
              )}
            </div>
            <div>
              <DialogTitle className="text-2xl">{dao.dao_name}</DialogTitle>
              <p className="text-muted-foreground">{dao.description || "No description"}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 my-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-cheese mb-2" />
            <p className="text-xl font-bold">{dao.member_count}</p>
            <p className="text-sm text-muted-foreground">Members</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <FileText className="h-5 w-5 mx-auto text-cheese mb-2" />
            <p className="text-xl font-bold">{proposals.length}</p>
            <p className="text-sm text-muted-foreground">Proposals</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <Coins className="h-5 w-5 mx-auto text-cheese mb-2" />
            <p className="text-xl font-bold truncate">{dao.treasury_balance || "0"}</p>
            <p className="text-sm text-muted-foreground">Treasury</p>
          </div>
        </div>

        {/* Token Info */}
        {dao.token_symbol && (
          <div className="bg-cheese/10 rounded-lg p-3 text-center mb-4">
            <span className="text-cheese font-medium">
              Governance Token: {dao.token_symbol}
            </span>
            {dao.token_contract && (
              <span className="text-muted-foreground ml-2">
                ({dao.token_contract})
              </span>
            )}
          </div>
        )}

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
