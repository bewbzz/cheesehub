import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { cn } from '@/lib/utils';

const WAX_ENDPOINTS = [
  'https://wax.greymass.com',
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
  'https://wax.pink.gg',
  'https://wax.cryptolions.io',
];

interface VoteRewardsManagerProps {
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

interface VoterInfo {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
  flags1: number;
  reserved2: number;
  reserved3: string;
  unpaid_voteshare: string;
  unpaid_voteshare_last_updated: number;
  unpaid_voteshare_change_rate: string;
}

interface GlobalState {
  total_unpaid_voteshare: string;
  total_voteshare_change_rate: string;
  total_unpaid_voteshare_last_updated: string;
  voters_bucket: string;
  pervote_bucket: number;
  total_activated_stake: string;
  last_pervote_bucket_fill: string;
}

export function VoteRewardsManager({ onTransactionComplete, onTransactionSuccess }: VoteRewardsManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voterInfo, setVoterInfo] = useState<VoterInfo | null>(null);
  const [globalState, setGlobalState] = useState<GlobalState | null>(null);
  const [estimatedRewards, setEstimatedRewards] = useState<number>(0);
  const [lastClaimTime, setLastClaimTime] = useState<Date | null>(null);
  const [nextClaimTime, setNextClaimTime] = useState<string>('');
  const [canClaim, setCanClaim] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (accountName) {
      fetchVoterData();
    }
  }, [accountName]);

  const fetchVoterData = async () => {
    if (!accountName) return;
    setIsLoading(true);
    
    try {
      // Fetch voter info
      const voterResponse = await fetchWithFallback(
        WAX_ENDPOINTS,
        '/v1/chain/get_table_rows',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'eosio',
            scope: 'eosio',
            table: 'voters',
            lower_bound: accountName,
            upper_bound: accountName,
            limit: 1,
            json: true,
          }),
        }
      );
      const voterData = await voterResponse.json();
      console.log('Voter data response:', voterData);
      
      // Fetch global state for reward calculation - try global4 first, fallback to global3
      let globalData: any = { rows: [] };
      try {
        const global4Response = await fetchWithFallback(
          WAX_ENDPOINTS,
          '/v1/chain/get_table_rows',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: 'eosio',
              scope: 'eosio',
              table: 'global4',
              limit: 1,
              json: true,
            }),
          }
        );
        globalData = await global4Response.json();
        console.log('Global4 data:', globalData);
      } catch (e) {
        console.log('Global4 fetch failed, trying global3:', e);
        // Fallback - calculate from voters bucket in global state
        try {
          const globalResponse = await fetchWithFallback(
            WAX_ENDPOINTS,
            '/v1/chain/get_table_rows',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: 'eosio',
                scope: 'eosio',
                table: 'global',
                limit: 1,
                json: true,
              }),
            }
          );
          globalData = await globalResponse.json();
          console.log('Global data fallback:', globalData);
        } catch (e2) {
          console.log('Global fetch also failed:', e2);
        }
      }
      
      if (voterData.rows && voterData.rows.length > 0) {
        const voter = voterData.rows[0] as VoterInfo;
        console.log('Voter info:', voter);
        setVoterInfo(voter);
        
        // Check if user is voting (either directly for producers or via proxy)
        const isVoting = (voter.producers && voter.producers.length > 0) || 
                         (voter.proxy && voter.proxy.length > 0 && voter.proxy !== '');
        console.log('Is voting:', isVoting, 'Proxy:', voter.proxy, 'Producers:', voter.producers?.length);
        setHasVoted(isVoting);
        
        // Calculate last claim time from unpaid_voteshare_last_updated
        // This can be either a timestamp string or unix seconds
        let lastUpdatedTime: Date;
        if (typeof voter.unpaid_voteshare_last_updated === 'string') {
          lastUpdatedTime = new Date(voter.unpaid_voteshare_last_updated + 'Z');
        } else if (voter.unpaid_voteshare_last_updated > 0) {
          lastUpdatedTime = new Date(voter.unpaid_voteshare_last_updated * 1000);
        } else {
          lastUpdatedTime = new Date(0);
        }
        
        setLastClaimTime(lastUpdatedTime);
        
        // Calculate next claim time - 24 hours from last claim
        const now = new Date();
        const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const nextClaimDate = new Date(lastUpdatedTime.getTime() + CLAIM_COOLDOWN_MS);
        
        if (lastUpdatedTime.getTime() === 0) {
          // Never claimed before
          setNextClaimTime('Now!');
          setCanClaim(true);
        } else if (now >= nextClaimDate) {
          // 24 hours have passed
          setNextClaimTime('Now!');
          setCanClaim(true);
        } else {
          // Calculate time remaining
          const remaining = nextClaimDate.getTime() - now.getTime();
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setNextClaimTime(`${hours}h ${minutes}m`);
          setCanClaim(false);
        }
        
        // Calculate estimated rewards - try even if globalData is incomplete
        if (globalData.rows && globalData.rows.length > 0) {
          const global = globalData.rows[0] as GlobalState;
          setGlobalState(global);
          
          const rewards = calculateRewards(voter, global);
          setEstimatedRewards(rewards);
          console.log('Calculated rewards:', rewards);
        } else {
          // Even without global data, show that user has some rewards based on voteshare
          const hasRewards = parseFloat(voter.unpaid_voteshare || '0') > 0 || 
                            parseFloat(voter.unpaid_voteshare_change_rate || '0') > 0;
          if (hasRewards) {
            setEstimatedRewards(-1); // -1 means "some rewards available but amount unknown"
          }
        }
      } else {
        setVoterInfo(null);
        setHasVoted(false);
        setEstimatedRewards(0);
        setLastClaimTime(null);
        setNextClaimTime('N/A');
      }
    } catch (error) {
      console.error('Failed to fetch voter data:', error);
      toast.error('Failed to load voter information');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRewards = (voter: VoterInfo, global: GlobalState): number => {
    try {
      // Get current time and last update time
      const now = Math.floor(Date.now() / 1000);
      
      // Parse last updated - can be string date or unix timestamp
      let lastUpdated: number;
      if (typeof voter.unpaid_voteshare_last_updated === 'string') {
        lastUpdated = Math.floor(new Date(voter.unpaid_voteshare_last_updated + 'Z').getTime() / 1000);
      } else {
        lastUpdated = voter.unpaid_voteshare_last_updated || 0;
      }
      
      // Parse global last updated
      let globalLastUpdated: number;
      if (typeof global.total_unpaid_voteshare_last_updated === 'string') {
        globalLastUpdated = Math.floor(new Date(global.total_unpaid_voteshare_last_updated + 'Z').getTime() / 1000);
      } else {
        globalLastUpdated = 0;
      }
      
      const timeDelta = now - lastUpdated;
      const globalTimeDelta = now - globalLastUpdated;
      
      // Parse values - these are very large numbers, use BigInt-like approach
      const unpaidVoteshare = parseFloat(voter.unpaid_voteshare || '0');
      const changeRate = parseFloat(voter.unpaid_voteshare_change_rate || '0');
      const totalUnpaidVoteshare = parseFloat(global.total_unpaid_voteshare || '0');
      const totalChangeRate = parseFloat(global.total_voteshare_change_rate || '0');
      
      // Calculate current voteshare
      const currentVoteshare = unpaidVoteshare + (changeRate * timeDelta);
      const currentTotalVoteshare = totalUnpaidVoteshare + (totalChangeRate * globalTimeDelta);
      
      // Voters bucket in WAX (stored with 8 decimal precision, so divide by 100000000)
      const votersBucketRaw = parseFloat(global.voters_bucket || '0');
      const votersBucket = votersBucketRaw / 100000000;
      
      console.log('Reward calc:', {
        currentVoteshare,
        currentTotalVoteshare,
        votersBucket,
        timeDelta,
        globalTimeDelta
      });
      
      if (currentTotalVoteshare <= 0 || votersBucket <= 0) {
        return 0;
      }
      
      // Calculate share of the bucket
      const share = currentVoteshare / currentTotalVoteshare;
      const estimatedReward = share * votersBucket;
      
      console.log('Share:', share, 'Estimated:', estimatedReward);
      
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
      
      // Refresh data
      await fetchVoterData();
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
    // Check if it's the unix epoch (never claimed)
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
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
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
        onClick={fetchVoterData}
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
