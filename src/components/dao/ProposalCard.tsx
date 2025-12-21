import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Proposal, 
  buildVoteAction, 
  buildMultiOptionVoteAction, 
  buildRankedChoiceVoteAction,
  PROPOSAL_VOTING_TYPES,
  VOTING_TYPE_LABELS 
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Minus, Loader2, Clock, User, GripVertical, Vote, Trophy, ListOrdered, Send } from "lucide-react";

interface ProposalCardProps {
  proposal: Proposal;
  onVote?: () => void;
}

export function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const { session, isConnected } = useWax();
  const [voting, setVoting] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [rankings, setRankings] = useState<number[]>([]);

  const totalVotes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
  const yesPercent = totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (proposal.no_votes / totalVotes) * 100 : 0;

  // Calculate total votes from choices for multi-option proposals
  const choicesTotalVotes = proposal.choices?.reduce((sum, c) => sum + (parseInt(c.total_votes) || 0), 0) || 0;

  async function handleYesNoVote(vote: "yes" | "no" | "abstain") {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    setVoting(true);
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
      setVoting(false);
    }
  }

  async function handleMultiOptionVote() {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (selectedChoice === null) {
      toast.error("Please select an option");
      return;
    }

    setVoting(true);
    try {
      const action = buildMultiOptionVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        selectedChoice
      );

      await session.transact({ actions: [action] });
      toast.success("Vote submitted successfully!");
      onVote?.();
    } catch (error) {
      console.error("Vote failed:", error);
      toast.error(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setVoting(false);
    }
  }

  async function handleRankedChoiceVote() {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    if (rankings.length !== proposal.choices.length) {
      toast.error("Please rank all options");
      return;
    }

    setVoting(true);
    try {
      const action = buildRankedChoiceVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        rankings
      );

      await session.transact({ actions: [action] });
      toast.success("Vote submitted successfully!");
      onVote?.();
    } catch (error) {
      console.error("Vote failed:", error);
      toast.error(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setVoting(false);
    }
  }

  const moveRanking = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= rankings.length) return;
    
    const newRankings = [...rankings];
    [newRankings[fromIndex], newRankings[toIndex]] = [newRankings[toIndex], newRankings[fromIndex]];
    setRankings(newRankings);
  };

  // Initialize rankings if needed for ranked choice
  const initRankings = () => {
    if (rankings.length === 0 && proposal.choices.length > 0) {
      setRankings(proposal.choices.map((_, i) => i));
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-500",
    active: "bg-blue-500/20 text-blue-500",
    passed: "bg-green-500/20 text-green-500",
    rejected: "bg-red-500/20 text-red-500",
    executed: "bg-purple-500/20 text-purple-500",
  };

  const votingTypeIcons: Record<number, React.ReactNode> = {
    [PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN]: <Vote className="h-3 w-3" />,
    [PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS]: <Trophy className="h-3 w-3" />,
    [PROPOSAL_VOTING_TYPES.RANKED_CHOICE]: <ListOrdered className="h-3 w-3" />,
    [PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER]: <Send className="h-3 w-3" />,
  };

  const renderVotingUI = () => {
    if (proposal.status !== "active" || !isConnected) return null;

    switch (proposal.voting_type) {
      case PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN:
      case PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER:
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-green-500/50 text-green-500 hover:bg-green-500/10"
              onClick={() => handleYesNoVote("yes")}
              disabled={voting}
            >
              {voting ? (
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
              onClick={() => handleYesNoVote("no")}
              disabled={voting}
            >
              {voting ? (
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
              onClick={() => handleYesNoVote("abstain")}
              disabled={voting}
            >
              {voting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </Button>
          </div>
        );

      case PROPOSAL_VOTING_TYPES.MOST_VOTES_WINS:
        return (
          <div className="space-y-3">
            <RadioGroup
              value={selectedChoice?.toString()}
              onValueChange={(value) => setSelectedChoice(parseInt(value))}
            >
              {proposal.choices.map((choice, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} id={`choice-${index}`} />
                  <Label htmlFor={`choice-${index}`} className="flex-1 cursor-pointer">
                    {choice.choice_name}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {choice.total_votes} votes
                  </span>
                </div>
              ))}
            </RadioGroup>
            <Button
              size="sm"
              className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              onClick={handleMultiOptionVote}
              disabled={voting || selectedChoice === null}
            >
              {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Vote"}
            </Button>
          </div>
        );

      case PROPOSAL_VOTING_TYPES.RANKED_CHOICE:
        if (rankings.length === 0) initRankings();
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Drag to rank in order of preference (1st = most preferred)</p>
            <div className="space-y-1">
              {rankings.map((choiceIndex, rankPosition) => (
                <div
                  key={choiceIndex}
                  className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-border/50"
                >
                  <span className="text-xs font-medium text-cheese w-6">#{rankPosition + 1}</span>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">
                    {proposal.choices[choiceIndex]?.choice_name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveRanking(rankPosition, "up")}
                      disabled={rankPosition === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => moveRanking(rankPosition, "down")}
                      disabled={rankPosition === rankings.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              onClick={handleRankedChoiceVote}
              disabled={voting || rankings.length !== proposal.choices.length}
            >
              {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Rankings"}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderVoteResults = () => {
    // For Yes/No/Abstain and Token Transfer
    if (proposal.voting_type === PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN || 
        proposal.voting_type === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER) {
      return (
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
      );
    }

    // For Most Votes Wins and Ranked Choice
    if (proposal.choices && proposal.choices.length > 0) {
      return (
        <div className="space-y-2">
          {proposal.choices.map((choice, index) => {
            const votes = parseInt(choice.total_votes) || 0;
            const percent = choicesTotalVotes > 0 ? (votes / choicesTotalVotes) * 100 : 0;
            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{choice.choice_name}</span>
                  <span className="text-muted-foreground">{votes} votes</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cheese transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
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
          <div className="flex flex-col items-end gap-1">
            <Badge className={statusColors[proposal.status] || "bg-muted"}>
              {proposal.status}
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              {votingTypeIcons[proposal.voting_type]}
              {VOTING_TYPE_LABELS[proposal.voting_type] || "Standard"}
            </Badge>
          </div>
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
              <span>Ends: {new Date(parseInt(proposal.end_time) * 1000).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Vote Results */}
        {renderVoteResults()}

        {/* Voting UI */}
        {renderVotingUI()}
      </CardContent>
    </Card>
  );
}
