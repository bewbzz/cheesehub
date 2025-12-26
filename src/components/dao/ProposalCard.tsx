import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Proposal, 
  DaoInfo,
  UserVote,
  buildVoteAction, 
  buildMultiOptionVoteAction, 
  buildRankedChoiceVoteAction,
  fetchUserStakedTokens,
  PROPOSAL_VOTING_TYPES,
  VOTING_TYPE_LABELS 
} from "@/lib/dao";
import { useWax } from "@/context/WaxContext";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Minus, Loader2, Clock, User, GripVertical, Vote, Trophy, ListOrdered, Send, Coins, AlertCircle, UserPlus, CheckCircle2, ArrowRight, Wallet, Image } from "lucide-react";

interface ProposalCardProps {
  proposal: Proposal;
  dao?: DaoInfo;
  initialVote?: UserVote | null;
  onVote?: (proposalId: number, vote: UserVote) => void;
}

export function ProposalCard({ proposal, dao, initialVote, onVote }: ProposalCardProps) {
  const { session, isConnected, accountName } = useWax();
  const [voting, setVoting] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [rankings, setRankings] = useState<number[]>([]);
  const [stakedWeight, setStakedWeight] = useState<number | null>(null);
  const [stakedBalance, setStakedBalance] = useState<string | null>(null);
  const [loadingStake, setLoadingStake] = useState(false);
  const [userVote, setUserVote] = useState<UserVote | null>(initialVote || null);

  // Sync userVote with initialVote when it changes (e.g., after fetching from blockchain)
  useEffect(() => {
    if (initialVote) {
      setUserVote(initialVote);
    }
  }, [initialVote]);

  // Check if this is a DAO that requires staking for voting (Type 1, 3, 4)
  const requiresStaking = [1, 3, 4].includes(dao?.dao_type || 0);

  // Fetch user's staked tokens for staking DAOs
  useEffect(() => {
    async function loadStakedTokens() {
      if (!requiresStaking || !accountName || !dao?.dao_name) return;
      
      setLoadingStake(true);
      try {
        const staked = await fetchUserStakedTokens(dao.dao_name, accountName);
        
        if (staked) {
          setStakedWeight(staked.weight);
          setStakedBalance(staked.balance);
        } else {
          setStakedWeight(0);
          setStakedBalance(null);
        }
      } catch (error) {
        console.error("Failed to load staked tokens:", error);
        setStakedWeight(null);
        setStakedBalance(null);
      } finally {
        setLoadingStake(false);
      }
    }
    
    loadStakedTokens();
  }, [requiresStaking, accountName, dao?.dao_name]);

  // Note: WaxDAO contract doesn't have a table to track individual votes
  // so we can only show the voted state for the current session after voting
  // The userVote state is set locally after a successful vote transaction

  // Check if user has already voted (current session only)
  const hasVoted = (): boolean => {
    return userVote !== null;
  };

  // Get the user's vote choice label
  // Note: For votes loaded from blockchain, we may not know the specific choice
  // (votesbyprop table doesn't store choice_index, only that they voted)
  const getVoteLabel = (): string | null => {
    if (!userVote || !proposal.choices) return null;
    
    // If choice_index is -1, we know they voted but not what they voted for
    if (userVote.choice_index === -1) return null;
    
    const choice = proposal.choices[userVote.choice_index];
    return choice?.description || null;
  };

  // Check if user has staked tokens for voting
  const hasVotingPower = (): boolean => {
    if (!requiresStaking) return true; // NFT DAOs use different mechanism
    if (stakedWeight === null) return false;
    
    const minWeight = dao?.minimum_weight || 0;
    return stakedWeight >= minWeight;
  };

  // Check if user is staked (has a record in stakers table)
  const isStaked = (): boolean => {
    return stakedWeight !== null && stakedWeight > 0;
  };

  // Check if user can vote (must have staked tokens for staking DAOs)
  const canVote = (): boolean => {
    if (!requiresStaking) return true;
    return isStaked() && hasVotingPower();
  };

  const totalVotes = proposal.yes_votes + proposal.no_votes + proposal.abstain_votes;
  const yesPercent = totalVotes > 0 ? (proposal.yes_votes / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (proposal.no_votes / totalVotes) * 100 : 0;

  // Calculate total votes from choices for multi-option proposals
  const choicesTotalVotes = proposal.choices?.reduce((sum, c) => sum + (typeof c.total_votes === 'string' ? parseInt(c.total_votes) : c.total_votes) || 0, 0) || 0;

  async function handleYesNoVote(vote: "yes" | "no" | "abstain") {
    if (!session) {
      toast.error("Please connect your wallet");
      return;
    }

    console.log("Starting vote:", vote);
    setVoting(true);
    try {
      // Don't pass weight - the contract will use the staked weight from stakers table
      const action = buildVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        vote
      );

      console.log("Sending vote transaction...");
      await session.transact({ actions: [action] });
      console.log("Vote transaction successful!");
      
      // Map vote to choice index (Yes=0, No=1, Abstain=2)
      const choiceIndex = vote === "yes" ? 0 : vote === "no" ? 1 : 2;
      const voteData = { choice_index: choiceIndex, weight: stakedWeight || 0 };
      console.log("Setting userVote state with choice_index:", choiceIndex);
      setUserVote(voteData);
      
      toast.success(`Voted ${vote} successfully!`);
      // Call onVote with the vote data so parent can track it
      setTimeout(() => onVote?.(proposal.proposal_id, voteData), 500);
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
      // Don't pass weight - the contract will use the staked weight from stakers table
      const action = buildMultiOptionVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        selectedChoice
      );

      await session.transact({ actions: [action] });
      
      // Set local vote state
      const voteData = { choice_index: selectedChoice, weight: stakedWeight || 0 };
      setUserVote(voteData);
      
      toast.success("Vote submitted successfully!");
      onVote?.(proposal.proposal_id, voteData);
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

    if (selectedChoice === null) {
      toast.error("Please select an option");
      return;
    }

    setVoting(true);
    try {
      // Note: WaxDAO contract doesn't support true ranked choice voting
      // It uses single-choice voting, same as Most Votes Wins
      const action = buildRankedChoiceVoteAction(
        String(session.actor),
        proposal.dao_name,
        proposal.proposal_id,
        selectedChoice
      );

      await session.transact({ actions: [action] });
      
      // Set local vote state
      const voteData = { choice_index: selectedChoice, weight: stakedWeight || 0 };
      setUserVote(voteData);
      
      toast.success("Vote submitted successfully!");
      onVote?.(proposal.proposal_id, voteData);
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
    [PROPOSAL_VOTING_TYPES.NFT_TRANSFER]: <Image className="h-3 w-3" />,
  };

  const renderVotingPowerInfo = () => {
    if (!requiresStaking || !isConnected) return null;
    
    if (loadingStake) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 p-2 bg-muted/30 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading voting status...</span>
        </div>
      );
    }

    // Check if user has staked tokens
    if (!isStaked()) {
      return (
        <div className="flex items-center gap-2 text-sm text-amber-500 mb-3 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>
            You need to stake tokens to vote. Go to the "Stake" tab to stake.
          </span>
        </div>
      );
    }
    
    if (!hasVotingPower()) {
      const minWeight = dao?.minimum_weight || 0;
      const symbolParts = dao?.token_symbol?.split(",") || [];
      const symbol = symbolParts.length > 1 ? symbolParts[1] : "tokens";
      
      return (
        <div className="flex items-center gap-2 text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            You need at least {minWeight} {symbol} staked to vote. 
            Current staked: {stakedBalance || "0"}
          </span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 text-sm text-cheese mb-3 p-2 bg-cheese/10 rounded-lg border border-cheese/20">
        <Coins className="h-4 w-4 shrink-0" />
        <span>Your voting power: {stakedBalance} (staked balance)</span>
      </div>
    );
  };

  const renderVotingUI = () => {
    if (proposal.status !== "active" || !isConnected) return null;
    
    // For staking DAOs, check if user can vote (staked + has enough weight)
    if (requiresStaking && !canVote()) {
      return null; // Don't show voting buttons if not eligible
    }

    // If user has already voted, show their vote
    if (hasVoted()) {
      const voteLabel = getVoteLabel();
      return (
        <div className="flex items-center gap-2 text-sm text-green-500 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{voteLabel ? <>You voted: <strong>{voteLabel}</strong></> : "You have voted on this proposal"}</span>
        </div>
      );
    }

    switch (proposal.voting_type) {
      case PROPOSAL_VOTING_TYPES.YES_NO_ABSTAIN:
      case PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER:
      case PROPOSAL_VOTING_TYPES.NFT_TRANSFER:
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
              className="flex-1 border-muted-foreground/50 text-muted-foreground hover:bg-muted"
              onClick={() => handleYesNoVote("abstain")}
              disabled={voting}
            >
              {voting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-1" />
                  Abstain
                </>
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
                    {choice.description}
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
        // Note: WaxDAO contract doesn't support true ranked choice - uses single-choice voting
        // UI shows options like Most Votes Wins but labeled as "Ranked Choice" for display
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Select your preferred option</p>
            <RadioGroup
              value={selectedChoice?.toString()}
              onValueChange={(value) => setSelectedChoice(parseInt(value))}
            >
              {proposal.choices.map((choice, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} id={`ranked-choice-${index}`} />
                  <Label htmlFor={`ranked-choice-${index}`} className="flex-1 cursor-pointer">
                    {choice.description}
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
              onClick={handleRankedChoiceVote}
              disabled={voting || selectedChoice === null}
            >
              {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Vote"}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderVoteResults = () => {
    // Check if this is a Yes/No/Abstain type proposal by checking choices
    const isYesNoAbstain = proposal.choices?.length === 3 && 
      proposal.choices.some(c => c.description?.toLowerCase() === "yes") &&
      proposal.choices.some(c => c.description?.toLowerCase() === "no") &&
      proposal.choices.some(c => c.description?.toLowerCase() === "abstain");
    
    // For Yes/No/Abstain and Token Transfer proposals
    if (isYesNoAbstain || proposal.voting_type === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER || proposal.voting_type === PROPOSAL_VOTING_TYPES.NFT_TRANSFER) {
      return (
        <div className="space-y-2 w-full max-w-full overflow-hidden">
          <div className="flex justify-between text-sm">
            <span className="text-green-500">Yes: {proposal.yes_votes}</span>
            <span className="text-red-500">No: {proposal.no_votes}</span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden w-full">
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

    // For multi-option proposals
    if (proposal.choices && proposal.choices.length > 0) {
      // Sort choices by vote count for display
      const sortedChoices = [...proposal.choices].sort((a, b) => {
        const votesA = typeof a.total_votes === 'string' ? parseInt(a.total_votes) : a.total_votes || 0;
        const votesB = typeof b.total_votes === 'string' ? parseInt(b.total_votes) : b.total_votes || 0;
        return votesB - votesA;
      });

      // Ranked Choice: Show all options with ranking medals
      if (proposal.voting_type === PROPOSAL_VOTING_TYPES.RANKED_CHOICE) {
        const rankingBadges = ['🥇', '🥈', '🥉'];
        
        return (
          <div className="space-y-2 w-full max-w-full overflow-hidden">
            <p className="text-xs text-muted-foreground font-medium">Full Rankings</p>
            {sortedChoices.map((choice, index) => {
              const votes = typeof choice.total_votes === 'string' ? parseInt(choice.total_votes) : choice.total_votes || 0;
              const percent = choicesTotalVotes > 0 ? (votes / choicesTotalVotes) * 100 : 0;
              const badge = index < 3 ? rankingBadges[index] : `${index + 1}.`;
              const isTop3 = index < 3 && votes > 0;
              
              return (
                <div key={choice.description} className="space-y-1 w-full overflow-hidden">
                  <div className="flex justify-between text-sm gap-2">
                    <span className={`${isTop3 ? 'font-medium' : 'text-muted-foreground'} truncate flex-1 min-w-0`}>
                      <span className="mr-1">{badge}</span>
                      {choice.description}
                    </span>
                    <span className="text-muted-foreground shrink-0">{votes} ({percent.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
                    <div
                      className={`h-full transition-all ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-muted-foreground/30'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      
      // Most Votes Wins: Emphasize only the winner, de-emphasize others
      const winner = sortedChoices[0];
      const winnerVotes = typeof winner?.total_votes === 'string' ? parseInt(winner.total_votes) : winner?.total_votes || 0;
      const winnerPercent = choicesTotalVotes > 0 ? (winnerVotes / choicesTotalVotes) * 100 : 0;
      const others = sortedChoices.slice(1);
      
      return (
        <div className="space-y-3 w-full max-w-full overflow-hidden">
          {/* Winner - prominent display */}
          {winner && winnerVotes > 0 && (
            <div className="p-3 bg-cheese/10 border border-cheese/30 rounded-lg">
              <div className="flex justify-between text-sm gap-2 mb-2">
                <span className="text-cheese font-semibold truncate flex-1 min-w-0">
                  🏆 {winner.description}
                </span>
                <span className="text-cheese font-medium shrink-0">{winnerVotes} ({winnerPercent.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-cheese/20 rounded-full overflow-hidden w-full">
                <div
                  className="h-full bg-cheese transition-all"
                  style={{ width: `${winnerPercent}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Other options - minimized */}
          {others.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Other options:</p>
              {others.map((choice) => {
                const votes = typeof choice.total_votes === 'string' ? parseInt(choice.total_votes) : choice.total_votes || 0;
                const percent = choicesTotalVotes > 0 ? (votes / choicesTotalVotes) * 100 : 0;
                return (
                  <div key={choice.description} className="flex justify-between text-xs text-muted-foreground gap-2">
                    <span className="truncate flex-1 min-w-0">{choice.description}</span>
                    <span className="shrink-0">{votes} ({percent.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="bg-card/50 border-border/50 w-full overflow-hidden" style={{ maxWidth: '100%' }}>
      <CardHeader className="pb-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <h4 className="font-semibold text-foreground truncate">{proposal.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2 break-all overflow-hidden" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
              {proposal.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
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

      <CardContent className="space-y-4 overflow-hidden" style={{ maxWidth: '100%' }}>
        {/* Token Transfer Details */}
        {proposal.voting_type === PROPOSAL_VOTING_TYPES.TOKEN_TRANSFER && proposal.token_receivers && proposal.token_receivers.length > 0 && (
          <div className="p-3 bg-cheese/10 border border-cheese/20 rounded-lg">
            <p className="text-xs font-medium text-cheese mb-2 flex items-center gap-1">
              <Send className="h-3 w-3" />
              Token Transfer Details
            </p>
            {proposal.token_receivers.map((receiver, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{receiver.quantity}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{receiver.wax_account}</span>
                <span className="text-xs text-muted-foreground">({receiver.contract})</span>
              </div>
            ))}
          </div>
        )}

        {/* Proposal Meta */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{proposal.proposer}</span>
          </div>
          {proposal.end_time && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Ends: {new Date(parseInt(proposal.end_time) * 1000).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</span>
            </div>
          )}
        </div>

        {/* Vote Results */}
        {renderVoteResults()}

        {/* Voting Power Info (for Token Balance DAOs) */}
        {renderVotingPowerInfo()}

        {/* Voting UI */}
        {renderVotingUI()}
      </CardContent>
    </Card>
  );
}
