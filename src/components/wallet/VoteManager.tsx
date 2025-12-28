import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X, Users, Vote, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTable } from '@/lib/wax';

interface Producer {
  owner: string;
  total_votes: string;
  producer_key: string;
  is_active: number;
  url: string;
  unpaid_blocks: number;
  last_claim_time: string;
  location: number;
}

interface Proxy {
  owner: string;
  name: string;
  website: string;
  slogan: string;
  philosophy: string;
  background: string;
  logo_256: string;
  is_proxy: number;
  proxy: string;
  proxied_vote_weight: string;
}

interface VoterInfo {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  last_vote_weight: string;
  is_proxy: number;
}

interface VoteManagerProps {
  onTransactionComplete: () => void;
  onTransactionSuccess: (title: string, description: string, txId: string | null) => void;
}

function formatVotes(votes: string): string {
  const num = parseFloat(votes);
  if (isNaN(num)) return '0';
  // Convert from vote weight to approximate WAX
  const voteWeight = num / Math.pow(2, 52);
  if (voteWeight >= 1e9) return (voteWeight / 1e9).toFixed(2) + 'B';
  if (voteWeight >= 1e6) return (voteWeight / 1e6).toFixed(2) + 'M';
  if (voteWeight >= 1e3) return (voteWeight / 1e3).toFixed(2) + 'K';
  return voteWeight.toFixed(0);
}

function formatVotePercentage(votes: string, totalVotes: number): string {
  const num = parseFloat(votes);
  if (isNaN(num) || totalVotes === 0) return '0%';
  return ((num / totalVotes) * 100).toFixed(2) + '%';
}

// ISO 3166-1 numeric country codes to flag emoji
const locationToFlag: Record<number, string> = {
  36: '🇦🇺', // Australia
  76: '🇧🇷', // Brazil
  124: '🇨🇦', // Canada
  156: '🇨🇳', // China
  276: '🇩🇪', // Germany
  344: '🇭🇰', // Hong Kong
  372: '🇮🇪', // Ireland
  392: '🇯🇵', // Japan
  410: '🇰🇷', // South Korea
  528: '🇳🇱', // Netherlands
  554: '🇳🇿', // New Zealand
  578: '🇳🇴', // Norway
  608: '🇵🇭', // Philippines
  616: '🇵🇱', // Poland
  620: '🇵🇹', // Portugal
  643: '🇷🇺', // Russia
  702: '🇸🇬', // Singapore
  710: '🇿🇦', // South Africa
  724: '🇪🇸', // Spain
  752: '🇸🇪', // Sweden
  756: '🇨🇭', // Switzerland
  764: '🇹🇭', // Thailand
  804: '🇺🇦', // Ukraine
  826: '🇬🇧', // United Kingdom
  840: '🇺🇸', // United States
  320: '🇬🇹', // Guatemala
};

function getLocationFlag(location: number): string {
  return locationToFlag[location] || '🌍';
}

export function VoteManager({ onTransactionComplete, onTransactionSuccess }: VoteManagerProps) {
  const { accountName, session } = useWax();
  const [activeTab, setActiveTab] = useState<'validators' | 'proxies'>('validators');
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [selectedProducers, setSelectedProducers] = useState<string[]>([]);
  const [selectedProxy, setSelectedProxy] = useState<string>('');
  const [voterInfo, setVoterInfo] = useState<VoterInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [proxySearch, setProxySearch] = useState('');
  const [voteStrength, setVoteStrength] = useState(0);
  const [totalVoteWeight, setTotalVoteWeight] = useState(0);

  const fetchData = useCallback(async () => {
    if (!accountName) return;
    
    setIsLoading(true);
    try {
      // Fetch producers
      const producerData = await fetchTable<Producer>('eosio', 'eosio', 'producers', {
        limit: 100,
      });
      
      // Sort by total_votes descending
      const sortedProducers = producerData
        .filter(p => p.is_active === 1)
        .sort((a, b) => parseFloat(b.total_votes) - parseFloat(a.total_votes));
      
      setProducers(sortedProducers);
      
      // Calculate total vote weight
      const total = sortedProducers.reduce((sum, p) => sum + parseFloat(p.total_votes), 0);
      setTotalVoteWeight(total);

      // Fetch proxies from regproxyinfo table
      const proxyData = await fetchTable<Proxy>('regproxyinfo', 'regproxyinfo', 'proxies', {
        limit: 100,
      });
      setProxies(proxyData.filter(p => p.is_proxy === 1));

      // Fetch voter info for current user
      const voterData = await fetchTable<VoterInfo>('eosio', 'eosio', 'voters', {
        lower_bound: accountName,
        upper_bound: accountName,
        limit: 1,
      });
      
      if (voterData.length > 0) {
        const voter = voterData[0];
        setVoterInfo(voter);
        setSelectedProducers(voter.producers || []);
        setSelectedProxy(voter.proxy || '');
        // Calculate vote strength from staked amount
        if (voter.staked) {
          setVoteStrength(voter.staked / 10000); // Convert from units to WAX
        }
      }
    } catch (error) {
      console.error('Failed to fetch vote data:', error);
      toast.error('Failed to load voting data');
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProducerToggle = (producer: string) => {
    setSelectedProducers(prev => {
      if (prev.includes(producer)) {
        return prev.filter(p => p !== producer);
      }
      if (prev.length >= 30) {
        toast.error('Maximum 30 validators can be selected');
        return prev;
      }
      return [...prev, producer].sort();
    });
    // Clear proxy when selecting producers
    setSelectedProxy('');
  };

  const handleProxySelect = (proxy: string) => {
    setSelectedProxy(proxy);
    // Clear producers when selecting proxy
    setSelectedProducers([]);
  };

  const handleVote = async () => {
    if (!session || !accountName) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsVoting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'voteproducer',
        authorization: [session.permissionLevel],
        data: {
          voter: accountName,
          proxy: selectedProxy || '',
          producers: selectedProxy ? [] : selectedProducers.sort(),
        },
      }];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;
      
      if (selectedProxy) {
        onTransactionSuccess('Vote Submitted!', `Your vote has been delegated to proxy: ${selectedProxy}`, txId);
      } else {
        onTransactionSuccess('Vote Submitted!', `Voted for ${selectedProducers.length} validator(s)`, txId);
      }
      
      onTransactionComplete();
      fetchData();
    } catch (error: any) {
      console.error('Vote failed:', error);
      toast.error(error?.message || 'Vote transaction failed');
    } finally {
      setIsVoting(false);
    }
  };

  const filteredProducers = producers.filter(p => 
    p.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProxies = proxies.filter(p => 
    p.owner.toLowerCase().includes(proxySearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(proxySearch.toLowerCase())
  );

  const canVote = (selectedProducers.length > 0 || selectedProxy) && !isVoting;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading vote data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'validators' | 'proxies')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="validators" className="flex items-center gap-2">
            <Vote className="h-4 w-4" />
            Validators
          </TabsTrigger>
          <TabsTrigger value="proxies" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Proxies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validators" className="space-y-4">
          {/* Selected count and vote strength */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Selected Validators ({selectedProducers.length} / 30):</span>
              <span className="text-muted-foreground">
                {selectedProducers.length > 0 ? selectedProducers.slice(0, 3).join(', ') + (selectedProducers.length > 3 ? '...' : '') : 'No validators selected.'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="font-medium">Vote Strength:</span>
              <span>{voteStrength.toLocaleString()} WAX</span>
            </div>
            
            <Progress value={selectedProducers.length / 30 * 100} className="h-2" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Producers list */}
          <ScrollArea className="h-[200px] border rounded-md">
            <div className="divide-y divide-border">
              {filteredProducers.map((producer, index) => (
                <div
                  key={producer.owner}
                  className="flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer text-xs"
                  onClick={() => handleProducerToggle(producer.owner)}
                >
                  <Checkbox
                    checked={selectedProducers.includes(producer.owner)}
                    onCheckedChange={() => handleProducerToggle(producer.owner)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-muted-foreground w-5 text-center">{index + 1}</span>
                  <span className="font-medium flex-1 text-primary truncate">
                    {producer.owner}
                  </span>
                  <span className="w-5 text-center" title={`Location: ${producer.location}`}>
                    {getLocationFlag(producer.location)}
                  </span>
                  <span className="text-muted-foreground w-14 text-right">
                    {formatVotePercentage(producer.total_votes, totalVoteWeight)}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="proxies" className="space-y-4">
          {/* Current proxy info */}
          {voterInfo?.proxy && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <span className="text-muted-foreground">Current Proxy: </span>
              <span className="font-medium text-primary">{voterInfo.proxy}</span>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proxies..."
              value={proxySearch}
              onChange={(e) => setProxySearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Manual proxy input */}
          <div className="space-y-2">
            <Label htmlFor="proxyAccount">Or enter proxy account:</Label>
            <div className="flex gap-2">
              <Input
                id="proxyAccount"
                placeholder="Enter proxy account name"
                value={selectedProxy}
                onChange={(e) => {
                  setSelectedProxy(e.target.value.toLowerCase());
                  setSelectedProducers([]);
                }}
              />
              {selectedProxy && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedProxy('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Proxies list */}
          <ScrollArea className="h-[180px] border rounded-md">
            <div className="divide-y divide-border">
              {filteredProxies.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No registered proxies found. You can still enter a proxy account manually.
                </div>
              ) : (
                filteredProxies.map((proxy) => (
                  <div
                    key={proxy.owner}
                    className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer ${
                      selectedProxy === proxy.owner ? 'bg-cheese/10' : ''
                    }`}
                    onClick={() => handleProxySelect(proxy.owner)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm text-primary">{proxy.owner}</div>
                      {proxy.name && (
                        <div className="text-xs text-muted-foreground">{proxy.name}</div>
                      )}
                      {proxy.slogan && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{proxy.slogan}</div>
                      )}
                    </div>
                    {selectedProxy === proxy.owner && (
                      <Check className="h-4 w-4 text-cheese" />
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Vote button */}
      <Button
        onClick={handleVote}
        disabled={!canVote}
        className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground disabled:opacity-50"
      >
        {isVoting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting Vote...
          </>
        ) : (
          <>
            <Vote className="mr-2 h-4 w-4" />
            {selectedProxy ? 'Set Proxy' : `Vote for ${selectedProducers.length} Validator(s)`}
          </>
        )}
      </Button>
    </div>
  );
}
