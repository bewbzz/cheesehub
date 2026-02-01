import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import {
  DaoInfo,
  Proposal,
  buildClaimVoteRamAction,
  fetchProposals,
} from "@/lib/dao";
import { closeWharfkitModals } from "@/lib/wharfKit";
import { Loader2, Database, HelpCircle, CheckCircle, Vote, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClaimVoteRamProps {
  dao: DaoInfo;
  userAccount: string;
}

interface ClaimableProposal {
  proposal: Proposal;
  canClaim: boolean;
}

// Fetch user's votes from the votesbyprop table
async function fetchUserVotedProposals(
  daoName: string,
  userAccount: string
): Promise<Set<number>> {
  const votedProposalIds = new Set<number>();
  
  try {
    // Query the votesbyprop table to find proposals user voted on
    const response = await fetch(
      `https://wax.eosusa.io/v1/chain/get_table_rows`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: true,
          code: "dao.waxdao",
          scope: daoName,
          table: "votesbyprop",
          index_position: 2, // Use secondary index by voter
          key_type: "name",
          lower_bound: userAccount,
          upper_bound: userAccount,
          limit: 100,
        }),
      }
    );
    
    const data = await response.json();
    
    for (const vote of data.rows || []) {
      if (vote.voter === userAccount) {
        votedProposalIds.add(vote.proposal_id);
      }
    }
  } catch (error) {
    console.error("Error fetching user votes:", error);
  }
  
  return votedProposalIds;
}

export function ClaimVoteRam({ dao, userAccount }: ClaimVoteRamProps) {
  const { session, isConnected } = useWax();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimingProposalId, setClaimingProposalId] = useState<number | null>(null);
  const [claimableProposals, setClaimableProposals] = useState<ClaimableProposal[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadClaimableProposals();
  }, [dao.dao_name, userAccount]);

  async function loadClaimableProposals() {
    if (!userAccount) return;
    
    setLoading(true);
    try {
      // Fetch all proposals and user's votes in parallel
      const [proposals, votedProposalIds] = await Promise.all([
        fetchProposals(dao.dao_name),
        fetchUserVotedProposals(dao.dao_name, userAccount),
      ]);
      
      // Filter to past proposals that user voted on
      const now = Math.floor(Date.now() / 1000);
      const claimable: ClaimableProposal[] = proposals
        .filter(p => {
          // Proposal must have ended
          const ended = p.end_time_ts > 0 && p.end_time_ts < now;
          // User must have voted on it
          const voted = votedProposalIds.has(p.proposal_id);
          return ended && voted;
        })
        .map(proposal => ({
          proposal,
          canClaim: true,
        }))
        .sort((a, b) => b.proposal.proposal_id - a.proposal.proposal_id); // Newest first
      
      setClaimableProposals(claimable);
    } catch (error) {
      console.error("Failed to load claimable proposals:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimRam(proposalId: number) {
    if (!session) return;
    
    setClaiming(true);
    setClaimingProposalId(proposalId);
    try {
      const action = buildClaimVoteRamAction(
        session.actor.toString(),
        dao.dao_name,
        proposalId
      );
      
      await session.transact({ actions: [action] });
      
      toast({
        title: "RAM Claimed",
        description: `Successfully reclaimed RAM from proposal #${proposalId}`,
      });
      
      // Mark as claimed locally
      setClaimedIds(prev => new Set([...prev, proposalId]));
      
    } catch (error) {
      console.error("Claim RAM failed:", error);
      closeWharfkitModals();
      
      // Check if already claimed (common error)
      const errorMsg = error instanceof Error ? error.message : "Failed to claim RAM";
      if (errorMsg.includes("already claimed") || errorMsg.includes("no votes found")) {
        // Mark as claimed since it's already done
        setClaimedIds(prev => new Set([...prev, proposalId]));
        toast({
          title: "Already Claimed",
          description: `RAM for proposal #${proposalId} was already claimed.`,
        });
      } else {
        toast({
          title: "Claim Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } finally {
      setClaiming(false);
      setClaimingProposalId(null);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  async function handleClaimAll() {
    if (!session) return;
    
    // Get all unclaimed proposals
    const unclaimedProposals = claimableProposals.filter(
      cp => !claimedIds.has(cp.proposal.proposal_id)
    );
    
    if (unclaimedProposals.length === 0) return;
    
    setClaiming(true);
    try {
      // Build all claim actions
      const actions = unclaimedProposals.map(cp =>
        buildClaimVoteRamAction(
          session.actor.toString(),
          dao.dao_name,
          cp.proposal.proposal_id
        )
      );
      
      await session.transact({ actions });
      
      toast({
        title: "All RAM Claimed",
        description: `Successfully reclaimed RAM from ${unclaimedProposals.length} proposal(s)`,
      });
      
      // Mark all as claimed
      setClaimedIds(prev => {
        const newSet = new Set(prev);
        unclaimedProposals.forEach(cp => newSet.add(cp.proposal.proposal_id));
        return newSet;
      });
      
    } catch (error) {
      console.error("Claim all RAM failed:", error);
      closeWharfkitModals();
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim RAM",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
      closeWharfkitModals();
      setTimeout(() => closeWharfkitModals(), 300);
    }
  }

  if (!isConnected) return null;

  // Filter out already claimed proposals
  const unclaimedProposals = claimableProposals.filter(
    cp => !claimedIds.has(cp.proposal.proposal_id)
  );

  if (loading) {
    return (
      <Card className="bg-muted/30 border-border/50">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking for claimable RAM...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if no proposals to claim
  if (claimableProposals.length === 0) return null;

  return (
    <Card className="bg-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-cheese" />
            <CardTitle className="text-base">Claim Vote RAM</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>When you vote on proposals, RAM is consumed to store your vote records. After proposals end, you can reclaim this RAM back to your account.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {unclaimedProposals.length > 1 && (
            <Button
              size="sm"
              onClick={handleClaimAll}
              disabled={claiming}
              className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            >
              {claiming && claimingProposalId === null ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : null}
              Claim All ({unclaimedProposals.length})
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          Reclaim RAM from past proposals you voted on
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Show all claimed message if everything is claimed */}
        {unclaimedProposals.length === 0 && claimedIds.size > 0 && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-sm text-green-200">
              All vote RAM has been claimed!
            </AlertDescription>
          </Alert>
        )}
        
        {/* List of proposals */}
        {claimableProposals.map(({ proposal }) => {
          const isClaimed = claimedIds.has(proposal.proposal_id);
          const isClaimingThis = claimingProposalId === proposal.proposal_id;
          
          return (
            <div
              key={proposal.proposal_id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                isClaimed 
                  ? "bg-green-500/5 border-green-500/20" 
                  : "bg-muted/50 border-border/50 hover:border-cheese/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Vote className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    #{proposal.proposal_id}: {proposal.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {proposal.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Ended {new Date(proposal.end_time_ts * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="shrink-0 ml-2">
                {isClaimed ? (
                  <div className="flex items-center gap-1 text-green-500 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Claimed</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClaimRam(proposal.proposal_id)}
                    disabled={claiming}
                    className="hover:bg-cheese/10 hover:text-cheese hover:border-cheese/50"
                  >
                    {isClaimingThis ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Claim RAM"
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
