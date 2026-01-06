import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountResources, parseWaxBalance } from './WalletResources';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

const WAX_ENDPOINTS = [
  'https://wax.greymass.com',
  'https://api.wax.alohaeos.com',
  'https://wax.eosphere.io',
];

interface StakeManagerProps {
  resources: AccountResources | null;
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

interface RefundRow {
  owner: string;
  request_time: string;
  net_amount: string;
  cpu_amount: string;
}

export function StakeManager({ resources, onTransactionComplete, onTransactionSuccess }: StakeManagerProps) {
  const { session, accountName } = useWax();
  const [isTransacting, setIsTransacting] = useState(false);
  
  // Stake state
  const [stakeReceiver, setStakeReceiver] = useState('');
  const [cpuStakeAmount, setCpuStakeAmount] = useState('');
  const [netStakeAmount, setNetStakeAmount] = useState('');
  
  // Unstake state
  const [cpuUnstakeAmount, setCpuUnstakeAmount] = useState('');
  const [netUnstakeAmount, setNetUnstakeAmount] = useState('');
  
  // Refund state
  const [refundInfo, setRefundInfo] = useState<RefundRow | null>(null);
  const [isLoadingRefund, setIsLoadingRefund] = useState(false);

  // Get staked amounts from resources
  const [stakedCpu, setStakedCpu] = useState(0);
  const [stakedNet, setStakedNet] = useState(0);

  const liquidBalance = parseWaxBalance(resources?.core_liquid_balance);

  useEffect(() => {
    if (accountName) {
      setStakeReceiver(accountName);
      fetchStakedResources();
      fetchRefundInfo();
    }
  }, [accountName]);

  const fetchStakedResources = async () => {
    if (!accountName) return;
    try {
      const response = await fetchWithFallback(
        WAX_ENDPOINTS,
        '/v1/chain/get_account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_name: accountName }),
        }
      );
      const data = await response.json();
      
      // Parse self-delegated bandwidth
      if (data.self_delegated_bandwidth) {
        const cpuWeight = parseFloat(data.self_delegated_bandwidth.cpu_weight?.split(' ')[0] || '0');
        const netWeight = parseFloat(data.self_delegated_bandwidth.net_weight?.split(' ')[0] || '0');
        setStakedCpu(cpuWeight);
        setStakedNet(netWeight);
      }
    } catch (error) {
      console.error('Failed to fetch staked resources:', error);
    }
  };

  const fetchRefundInfo = async () => {
    if (!accountName) return;
    setIsLoadingRefund(true);
    try {
      const response = await fetchWithFallback(
        WAX_ENDPOINTS,
        '/v1/chain/get_table_rows',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: 'eosio',
            scope: accountName,
            table: 'refunds',
            json: true,
            limit: 1,
          }),
        }
      );
      const data = await response.json();
      
      if (data.rows && data.rows.length > 0) {
        setRefundInfo(data.rows[0]);
      } else {
        setRefundInfo(null);
      }
    } catch (error) {
      console.error('Failed to fetch refund info:', error);
    } finally {
      setIsLoadingRefund(false);
    }
  };

  const handleStake = async () => {
    if (!session || !stakeReceiver) return;
    
    const cpuAmount = parseFloat(cpuStakeAmount) || 0;
    const netAmount = parseFloat(netStakeAmount) || 0;
    
    if (cpuAmount <= 0 && netAmount <= 0) {
      toast.error('Enter an amount to stake for CPU or NET');
      return;
    }

    if (cpuAmount + netAmount > liquidBalance) {
      toast.error('Insufficient WAX balance');
      return;
    }
    
    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'delegatebw',
        authorization: [session.permissionLevel],
        data: {
          from: accountName,
          receiver: stakeReceiver,
          stake_net_quantity: `${netAmount.toFixed(8)} WAX`,
          stake_cpu_quantity: `${cpuAmount.toFixed(8)} WAX`,
          transfer: false,
        },
      }];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const stakeDesc = [];
      if (cpuAmount > 0) stakeDesc.push(`${cpuAmount.toFixed(8)} WAX to CPU`);
      if (netAmount > 0) stakeDesc.push(`${netAmount.toFixed(8)} WAX to NET`);
      
      onTransactionSuccess?.('Staked Successfully!', `Staked ${stakeDesc.join(' and ')} for ${stakeReceiver}`, txId);
      setCpuStakeAmount('');
      setNetStakeAmount('');
      fetchStakedResources();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Stake error:', error);
      toast.error(error?.message || 'Failed to stake');
    } finally {
      setIsTransacting(false);
    }
  };

  const handleUnstake = async () => {
    if (!session) return;
    
    const cpuAmount = parseFloat(cpuUnstakeAmount) || 0;
    const netAmount = parseFloat(netUnstakeAmount) || 0;
    
    if (cpuAmount <= 0 && netAmount <= 0) {
      toast.error('Enter an amount to unstake for CPU or NET');
      return;
    }

    if (cpuAmount > stakedCpu) {
      toast.error('Cannot unstake more CPU than currently staked');
      return;
    }

    if (netAmount > stakedNet) {
      toast.error('Cannot unstake more NET than currently staked');
      return;
    }
    
    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'undelegatebw',
        authorization: [session.permissionLevel],
        data: {
          from: accountName,
          receiver: accountName,
          unstake_net_quantity: `${netAmount.toFixed(8)} WAX`,
          unstake_cpu_quantity: `${cpuAmount.toFixed(8)} WAX`,
        },
      }];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const unstakeDesc = [];
      if (cpuAmount > 0) unstakeDesc.push(`${cpuAmount.toFixed(8)} WAX from CPU`);
      if (netAmount > 0) unstakeDesc.push(`${netAmount.toFixed(8)} WAX from NET`);
      
      onTransactionSuccess?.('Unstaked Successfully!', `Unstaked ${unstakeDesc.join(' and ')}. Refund available in 3 days.`, txId);
      setCpuUnstakeAmount('');
      setNetUnstakeAmount('');
      fetchStakedResources();
      fetchRefundInfo();
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Unstake error:', error);
      toast.error(error?.message || 'Failed to unstake');
    } finally {
      setIsTransacting(false);
    }
  };

  const handleRefund = async () => {
    if (!session || !refundInfo) return;
    
    setIsTransacting(true);
    try {
      const actions = [{
        account: 'eosio',
        name: 'refund',
        authorization: [session.permissionLevel],
        data: {
          owner: accountName,
        },
      }];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      const cpuRefund = parseFloat(refundInfo.cpu_amount?.split(' ')[0] || '0');
      const netRefund = parseFloat(refundInfo.net_amount?.split(' ')[0] || '0');
      const totalRefund = cpuRefund + netRefund;
      
      onTransactionSuccess?.('Refund Claimed!', `Refunded ${totalRefund.toFixed(8)} WAX to your account`, txId);
      setRefundInfo(null);
      onTransactionComplete?.();
    } catch (error: any) {
      console.error('Refund error:', error);
      toast.error(error?.message || 'Failed to claim refund');
    } finally {
      setIsTransacting(false);
    }
  };

  const isValidReceiver = stakeReceiver.length > 0 && /^[a-z1-5.]{1,12}$/.test(stakeReceiver);

  // Calculate refund availability
  const getRefundAvailability = () => {
    if (!refundInfo) return null;
    
    const requestTime = new Date(refundInfo.request_time + 'Z');
    const refundTime = new Date(requestTime.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    const now = new Date();
    
    const cpuRefund = parseFloat(refundInfo.cpu_amount?.split(' ')[0] || '0');
    const netRefund = parseFloat(refundInfo.net_amount?.split(' ')[0] || '0');
    const totalRefund = cpuRefund + netRefund;
    
    if (now >= refundTime) {
      return { available: true, amount: totalRefund };
    } else {
      const remaining = refundTime.getTime() - now.getTime();
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return { available: false, amount: totalRefund, timeLeft: `${hours}h ${minutes}m` };
    }
  };

  const refundStatus = getRefundAvailability();

  const setPercentage = (type: 'cpu' | 'net', percent: number) => {
    const amount = (liquidBalance * percent / 100).toFixed(8);
    if (type === 'cpu') setCpuStakeAmount(amount);
    else setNetStakeAmount(amount);
  };

  return (
    <Tabs defaultValue="stake" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="stake" className="flex-1">Stake</TabsTrigger>
        <TabsTrigger value="unstake" className="flex-1">Unstake</TabsTrigger>
        <TabsTrigger value="refund" className="flex-1">Refund</TabsTrigger>
      </TabsList>

      <TabsContent value="stake" className="space-y-4 mt-4">
        {/* Stake Receiver */}
        <div className="space-y-2">
          <Label>Receiver of Stake:</Label>
          <div className="relative">
            <Input
              placeholder="Enter WAX account"
              value={stakeReceiver}
              onChange={(e) => setStakeReceiver(e.target.value.toLowerCase())}
              className="pr-10"
            />
            {stakeReceiver.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidReceiver ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* CPU Stake Amount */}
        <div className="space-y-2">
          <Label>Amount of CPU to Stake (in WAX)</Label>
          <Input
            type="number"
            placeholder="0"
            value={cpuStakeAmount}
            onChange={(e) => setCpuStakeAmount(e.target.value)}
            min={0}
            step={0.00000001}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('cpu', 25)}
              className="flex-1 text-xs bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30 hover:border-green-500"
            >
              25%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('cpu', 50)}
              className="flex-1 text-xs bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500"
            >
              50%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('cpu', 75)}
              className="flex-1 text-xs bg-cheese/20 border-cheese/50 text-cheese hover:bg-cheese/30 hover:border-cheese"
            >
              75%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('cpu', 100)}
              className="flex-1 text-xs bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30 hover:border-purple-500"
            >
              100%
            </Button>
          </div>
        </div>

        {/* NET Stake Amount */}
        <div className="space-y-2">
          <Label>Amount of NET to Stake (in WAX)</Label>
          <Input
            type="number"
            placeholder="0"
            value={netStakeAmount}
            onChange={(e) => setNetStakeAmount(e.target.value)}
            min={0}
            step={0.00000001}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('net', 25)}
              className="flex-1 text-xs bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30 hover:border-green-500"
            >
              25%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('net', 50)}
              className="flex-1 text-xs bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500"
            >
              50%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('net', 75)}
              className="flex-1 text-xs bg-cheese/20 border-cheese/50 text-cheese hover:bg-cheese/30 hover:border-cheese"
            >
              75%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPercentage('net', 100)}
              className="flex-1 text-xs bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30 hover:border-purple-500"
            >
              100%
            </Button>
          </div>
        </div>

        <Button
          onClick={handleStake}
          disabled={!isValidReceiver || isTransacting || ((parseFloat(cpuStakeAmount) || 0) <= 0 && (parseFloat(netStakeAmount) || 0) <= 0)}
          className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
        >
          {isTransacting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Staking...
            </>
          ) : (
            'Stake'
          )}
        </Button>
      </TabsContent>

      <TabsContent value="unstake" className="space-y-4 mt-4">
        {/* Currently Staked Info */}
        <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Staked CPU:</span>
            <span className="font-medium">{stakedCpu.toFixed(8)} WAX</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Staked NET:</span>
            <span className="font-medium">{stakedNet.toFixed(8)} WAX</span>
          </div>
        </div>

        {/* CPU Unstake Amount */}
        <div className="space-y-2">
          <Label>Amount of CPU to Unstake (in WAX)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0"
              value={cpuUnstakeAmount}
              onChange={(e) => setCpuUnstakeAmount(e.target.value)}
              min={0}
              max={stakedCpu}
              step={0.00000001}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCpuUnstakeAmount(stakedCpu.toFixed(8))}
              className="shrink-0"
            >
              Max
            </Button>
          </div>
        </div>

        {/* NET Unstake Amount */}
        <div className="space-y-2">
          <Label>Amount of NET to Unstake (in WAX)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0"
              value={netUnstakeAmount}
              onChange={(e) => setNetUnstakeAmount(e.target.value)}
              min={0}
              max={stakedNet}
              step={0.00000001}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNetUnstakeAmount(stakedNet.toFixed(8))}
              className="shrink-0"
            >
              Max
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Note: Unstaked WAX will be available after a 3-day refund period.
        </p>

        <Button
          onClick={handleUnstake}
          disabled={isTransacting || ((parseFloat(cpuUnstakeAmount) || 0) <= 0 && (parseFloat(netUnstakeAmount) || 0) <= 0)}
          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          {isTransacting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Unstaking...
            </>
          ) : (
            'Unstake'
          )}
        </Button>
      </TabsContent>

      <TabsContent value="refund" className="space-y-4 mt-4">
        {isLoadingRefund ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : refundStatus ? (
          <>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Refund:</span>
                <span className="font-medium text-cheese">{refundStatus.amount.toFixed(8)} WAX</span>
              </div>
              {!refundStatus.available && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available in:</span>
                  <span className="font-medium">{refundStatus.timeLeft}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleRefund}
              disabled={!refundStatus.available || isTransacting}
              className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground"
            >
              {isTransacting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : refundStatus.available ? (
                'Claim Refund'
              ) : (
                `Refund Available in ${refundStatus.timeLeft}`
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No pending refunds</p>
            <p className="text-xs mt-2">Unstake CPU or NET to create a refund request.</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
