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

interface ProxyVoter {
  owner: string;
  proxy: string;
  producers: string[];
  staked: number;
  last_vote_weight: string;
  proxied_vote_weight: string;
  is_proxy: number;
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

// ISO 3166-1 numeric country codes to country names
const locationToCountry: Record<number, string> = {
  36: 'Australia',
  76: 'Brazil',
  124: 'Canada',
  156: 'China',
  276: 'Germany',
  344: 'Hong Kong',
  372: 'Ireland',
  392: 'Japan',
  410: 'South Korea',
  528: 'Netherlands',
  554: 'New Zealand',
  578: 'Norway',
  608: 'Philippines',
  616: 'Poland',
  620: 'Portugal',
  643: 'Russia',
  702: 'Singapore',
  710: 'South Africa',
  724: 'Spain',
  752: 'Sweden',
  756: 'Switzerland',
  764: 'Thailand',
  804: 'Ukraine',
  826: 'United Kingdom',
  840: 'United States',
  320: 'Guatemala',
  250: 'France',
  380: 'Italy',
  40: 'Austria',
  56: 'Belgium',
  203: 'Czech Republic',
  208: 'Denmark',
  246: 'Finland',
  300: 'Greece',
  348: 'Hungary',
  356: 'India',
  360: 'Indonesia',
  376: 'Israel',
  458: 'Malaysia',
  484: 'Mexico',
  566: 'Nigeria',
  586: 'Pakistan',
  604: 'Peru',
  642: 'Romania',
  682: 'Saudi Arabia',
  784: 'UAE',
  858: 'Uruguay',
  862: 'Venezuela',
  704: 'Vietnam',
};

function getLocationName(location: number): string {
  return locationToCountry[location] || '-';
}

export function VoteManager({ onTransactionComplete, onTransactionSuccess }: VoteManagerProps) {
  const { accountName, session } = useWax();
  const [activeTab, setActiveTab] = useState<'validators' | 'proxies'>('validators');
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [proxies, setProxies] = useState<ProxyVoter[]>([]);
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

      // Fetch proxies - query known popular proxy accounts from alohaeos proxy list
      const knownProxyAccounts = [
        'top21.oig', 'waxgoodproxy', 'kaefersproxy', 'bloksioproxy',
        'waxcommunity', 'hodlwaxiopro', 'bigmikeproxy', 'alienhelpers',
        'blklotusprxy', 'ranchersland', 'delphioracle', 'waxcoreproxy',
        'scetrov', 'opskinsproxy', 'rentcpuonwax', '3dkrenderbuy',
        'waxunderdogs', 'binjteamwax1', 'swedencornet', 'massadoption'
      ];
      
      const rpcEndpoints = [
        'https://api.wax.alohaeos.com',
        'https://wax.greymass.com',
        'https://api.waxsweden.org',
      ];
      
      try {
        const proxyPromises = knownProxyAccounts.map(async (account) => {
          for (const endpoint of rpcEndpoints) {
            try {
              const response = await fetch(`${endpoint}/v1/chain/get_table_rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  json: true,
                  code: 'eosio',
                  scope: 'eosio',
                  table: 'voters',
                  lower_bound: account,
                  upper_bound: account,
                  limit: 1,
                }),
              });
              const data = await response.json();
              if (data.rows && data.rows.length > 0 && data.rows[0].is_proxy === 1) {
                return data.rows[0] as ProxyVoter;
              }
              return null;
            } catch {
              continue;
            }
          }
          return null;
        });
        
        const proxyResults = await Promise.all(proxyPromises);
        const validProxies = proxyResults.filter((p): p is ProxyVoter => p !== null);
        
        // Sort by proxied vote weight descending
        validProxies.sort((a, b) => 
          parseFloat(b.proxied_vote_weight || '0') - parseFloat(a.proxied_vote_weight || '0')
        );
        setProxies(validProxies);
      } catch (err) {
        console.error('Failed to fetch proxies:', err);
        setProxies([]);
      }

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
    p.owner.toLowerCase().includes(proxySearch.toLowerCase())
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
              {filteredProducers.map((producer, index) => {
                const isSelected = selectedProducers.includes(producer.owner);
                return (
                  <label
                    key={producer.owner}
                    className={`flex items-center gap-2 p-2 cursor-pointer text-xs select-none transition-colors ${
                      isSelected ? 'bg-cheese/10 hover:bg-cheese/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleProducerToggle(producer.owner)}
                      className="h-4 w-4 pointer-events-none"
                    />
                    <span className="text-muted-foreground w-5 text-center">{index + 1}</span>
                    <span className="font-medium flex-1 text-primary truncate">
                      {producer.owner}
                    </span>
                    <span className="text-muted-foreground w-20 truncate text-center">
                      {getLocationName(producer.location)}
                    </span>
                    <span className="text-muted-foreground w-12 text-right">
                      {formatVotePercentage(producer.total_votes, totalVoteWeight)}
                    </span>
                  </label>
                );
              })}
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
                filteredProxies.map((proxy, index) => (
                  <label
                    key={proxy.owner}
                    className={`flex items-center gap-2 p-2 cursor-pointer text-xs select-none transition-colors ${
                      selectedProxy === proxy.owner ? 'bg-cheese/10 hover:bg-cheese/20' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleProxySelect(proxy.owner)}
                  >
                    <Checkbox
                      checked={selectedProxy === proxy.owner}
                      className="h-4 w-4 pointer-events-none"
                    />
                    <span className="text-muted-foreground w-5 text-center">{index + 1}</span>
                    <span className="font-medium flex-1 text-primary truncate">
                      {proxy.owner}
                    </span>
                    <span className="text-muted-foreground w-16 text-right">
                      {formatVotes(proxy.proxied_vote_weight || '0')}
                    </span>
                  </label>
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
