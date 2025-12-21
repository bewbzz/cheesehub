import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Proposal, buildVoteAction } from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Minus, Loader2, Clock, User } from "lucide-react";

interface ProposalCardProps {
  proposal: Proposal;
  onVote?: () => void;
}

export function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const { session, isConnected } = useWax();
  const [voting, setVoting] = useState<"yes" | "no" | "abstain" | null>(null);

  const totalVotes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
  const yesPercent = totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (proposal.no_votes / totalVotes) * 100 : 0;

  async function handleVote(vote: "yes" | "no" | "abstain") {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    setVoting(vote);
    try {
      const action = buildVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        vote
      );

      await session.transact({ actions: [action] });
      toast.success(`Voted ${vote} successfully!`);
      onVote?.();
    } catch (error) {
      console.error("Vote failed:", error);
      toast.error(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setVoting(null);
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-500",
    active: "bg-blue-500/20 text-blue-500",
    passed: "bg-green-500/20 text-green-500",
    rejected: "bg-red-500/20 text-red-500",
    executed: "bg-purple-500/20 text-purple-500",
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground">{proposal.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {proposal.description}
            </p>
          </div>
          <Badge className={statusColors[proposal.status] || "bg-muted"}>
            {proposal.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Proposal Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{proposal.proposer}</span>
          </div>
          {proposal.end_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Ends: {new Date(proposal.end_time).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Vote Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-500">Yes: {proposal.yes_votes}</span>
            <span className="text-red-500">No: {proposal.no_votes}</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-green-500 transition-all"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="absolute right-0 top-0 h-full bg-red-500 transition-all"
              style={{ width: `${noPercent}%` }}
            />
          </div>
          {proposal.abstain_votes > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Abstain: {proposal.abstain_votes}
            </p>
          )}
        </div>

        {/* Vote Buttons */}
        {proposal.status === "active" && isConnected && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500/10"
              onClick={() => handleVote("yes")}
              disabled={voting !== null}
            >
              {voting === "yes" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Yes
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
              onClick={() => handleVote("no")}
              disabled={voting !== null}
            >
              {voting === "no" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ThumbsDown className="h-4 w-4 mr-1" />
                  No
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-muted-foreground/50 text-muted-foreground hover:bg-muted"
              onClick={() => handleVote("abstain")}
              disabled={voting !== null}
            >
              {voting === "abstain" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
