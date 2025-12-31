import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useWalletData } from '@/context/WalletDataContext';
import { Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VoterInfo, GlobalState } from '@/lib/waxRpcFallback';

interface VoteRewardsManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function VoteRewardsManager({ onTransactionComplete, onTransactionSuccess }: VoteRewardsManagerProps) {
  const { session, accountName } = useWax();
  const { accountData, isLoading, refetch } = useWalletData();
  const [isTransacting, setIsTransacting] = useState(false);

  // Get voter info and global state from context
  const voterInfo = accountData?.voterInfo ?? null;
  const globalState = accountData?.globalState ?? null;
  const hasVoted = accountData?.hasVoted ?? false;

  // Calculate claim times and rewards
  const { lastClaimTime, nextClaimTime, canClaim, estimatedRewards } = useMemo(() => {
    if (!voterInfo) {
      return {
        lastClaimTime: null,
        nextClaimTime: 'N/A',
        canClaim: false,
        estimatedRewards: 0,
      };
    }

    // Calculate last claim time from unpaid_voteshare_last_updated
    let lastUpdatedTime: Date;
    if (typeof voterInfo.unpaid_voteshare_last_updated === 'string') {
      lastUpdatedTime = new Date(voterInfo.unpaid_voteshare_last_updated + 'Z');
    } else if (voterInfo.unpaid_voteshare_last_updated > 0) {
      lastUpdatedTime = new Date(voterInfo.unpaid_voteshare_last_updated * 1000);
    } else {
      lastUpdatedTime = new Date(0);
    }

    // Calculate next claim time - 24 hours from last claim
    const now = new Date();
    const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const nextClaimDate = new Date(lastUpdatedTime.getTime() + CLAIM_COOLDOWN_MS);

    let canClaimNow = false;
    let nextClaimStr = '';

    if (lastUpdatedTime.getTime() === 0) {
      nextClaimStr = 'Now!';
      canClaimNow = true;
    } else if (now >= nextClaimDate) {
      nextClaimStr = 'Now!';
      canClaimNow = true;
    } else {
      const remaining = nextClaimDate.getTime() - now.getTime();
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      nextClaimStr = `${hours}h ${minutes}m`;
      canClaimNow = false;
    }

    // Calculate estimated rewards
    let rewards = 0;
    if (globalState) {
      rewards = calculateRewards(voterInfo, globalState);
    } else {
      const hasRewards = parseFloat(voterInfo.unpaid_voteshare || '0') > 0 || 
                        parseFloat(voterInfo.unpaid_voteshare_change_rate || '0') > 0;
      if (hasRewards) {
        rewards = -1; // -1 means "some rewards available but amount unknown"
      }
    }

    return {
      lastClaimTime: lastUpdatedTime,
      nextClaimTime: nextClaimStr,
      canClaim: canClaimNow,
      estimatedRewards: rewards,
    };
  }, [voterInfo, globalState]);

  const calculateRewards = (voter: VoterInfo, global: GlobalState): number => {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      let lastUpdated: number;
      if (typeof voter.unpaid_voteshare_last_updated === 'string') {
        lastUpdated = Math.floor(new Date(voter.unpaid_voteshare_last_updated + 'Z').getTime() / 1000);
      } else {
        lastUpdated = voter.unpaid_voteshare_last_updated || 0;
      }
      
      let globalLastUpdated: number;
      if (typeof global.total_unpaid_voteshare_last_updated === 'string') {
        globalLastUpdated = Math.floor(new Date(global.total_unpaid_voteshare_last_updated + 'Z').getTime() / 1000);
      } else {
        globalLastUpdated = 0;
      }
      
      const timeDelta = now - lastUpdated;
      const globalTimeDelta = now - globalLastUpdated;
      
      const unpaidVoteshare = parseFloat(voter.unpaid_voteshare || '0');
      const changeRate = parseFloat(voter.unpaid_voteshare_change_rate || '0');
      const totalUnpaidVoteshare = parseFloat(global.total_unpaid_voteshare || '0');
      const totalChangeRate = parseFloat(global.total_voteshare_change_rate || '0');
      
      const currentVoteshare = unpaidVoteshare + (changeRate * timeDelta);
      const currentTotalVoteshare = totalUnpaidVoteshare + (totalChangeRate * globalTimeDelta);
      
      const votersBucketRaw = parseFloat(global.voters_bucket || '0');
      const votersBucket = votersBucketRaw / 100000000;
      
      if (currentTotalVoteshare <= 0 || votersBucket <= 0) {
        return 0;
      }
      
      const share = currentVoteshare / currentTotalVoteshare;
      const estimatedReward = share * votersBucket;
      
      return estimatedReward > 0 ? estimatedReward : 0;
    } catch (error) {
      console.error('Error calculating rewards:', error);
      return 0;
    }
  };

  const handleClaimVote = async () => {
    if (!session || !accountName) return;
    
    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'claimgbmvote',
        authorization: [session.permissionLevel],
        data: {
          owner: accountName,
        },
      }];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;
      
      const rewardAmount = estimatedRewards > 0 ? estimatedRewards.toFixed(8) : '0';
      onTransactionSuccess?.(
        'Vote Rewards Claimed!', 
        `Claimed approximately ${rewardAmount} WAX in voting rewards.`, 
        txId
      );
      
      await refetch();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Claim vote error:', error);
      const errorMsg = error?.message || 'Failed to claim vote rewards';
      if (errorMsg.includes('nothing to claim')) {
        toast.error('No vote rewards available to claim');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setIsTransacting(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    if (date.getTime() === 0) {
      return 'Never';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-cheese" />
        <h3 className="font-semibold">Voting Rewards</h3>
      </div>

      {/* Voting Status */}
      {!hasVoted && voterInfo !== null && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-sm text-destructive">
            You must vote for block producers or set a proxy to earn voting rewards.
          </p>
        </div>
      )}

      {voterInfo === null && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            No voter information found. You may need to stake WAX and vote for block producers to earn rewards.
          </p>
        </div>
      )}

      {voterInfo && (
        <>
          {/* Rewards Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Voter Claim:</span>
              <span className="font-medium">{formatDate(lastClaimTime)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Voter Claim:</span>
              <span className={`font-medium ${nextClaimTime === 'Now!' ? 'text-green-500' : ''}`}>
                {nextClaimTime}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Voter Rewards:</span>
              <span className="font-medium text-cheese">
                {estimatedRewards > 0 
                  ? `${estimatedRewards.toFixed(8)} WAX` 
                  : estimatedRewards === -1 
                    ? 'Rewards Available!' 
                    : 'Calculating...'}
              </span>
            </div>

            {voterInfo.proxy && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Voting Proxy:</span>
                <span className="font-medium">{voterInfo.proxy}</span>
              </div>
            )}

            {voterInfo.producers.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Voting for:</span>
                <span className="font-medium ml-2">{voterInfo.producers.length} producers</span>
              </div>
            )}
          </div>

          {/* Staked Info */}
          <div className="p-3 bg-muted/30 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Staked for Voting:</span>
              <span className="font-medium">{(voterInfo.staked / 100000000).toFixed(8)} WAX</span>
            </div>
          </div>

          {/* Claim Button */}
          <Button
            onClick={handleClaimVote}
            disabled={isTransacting || !hasVoted || !canClaim || estimatedRewards === 0}
            className={cn(
              "w-full text-primary-foreground",
              canClaim ? "bg-cheese hover:bg-cheese-dark" : "bg-cheese/50 cursor-not-allowed"
            )}
          >
            {isTransacting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claiming...
              </>
            ) : (
              <>
                <Gift className="mr-2 h-4 w-4" />
                Claim Vote Rewards
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Voting rewards are added to your liquid WAX balance.
          </p>
        </>
      )}

      {/* Refresh Button */}
      <Button
        variant="outline"
        onClick={refetch}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Refreshing...
          </>
        ) : (
          'Refresh Rewards'
        )}
      </Button>
    </div>
  );
}
