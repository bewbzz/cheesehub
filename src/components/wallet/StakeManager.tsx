import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWax } from '@/context/WaxContext';
import { useWalletData } from '@/context/WalletDataContext';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountResources, parseWaxBalance } from './WalletResources';

interface StakeManagerProps {
  resources: AccountResources | null;
  onTransactionComplete?: () => void;
  onTransactionSuccess?: (title: string, description: string, txId: string | null) => void;
}

export function StakeManager({ resources, onTransactionComplete, onTransactionSuccess }: StakeManagerProps) {
  const { session, accountName } = useWax();
  const { accountData, refetch: refetchAccountData } = useWalletData();
  const [isTransacting, setIsTransacting] = useState(false);
  
  // Stake state
  const [stakeReceiver, setStakeReceiver] = useState('');
  const [cpuStakeAmount, setCpuStakeAmount] = useState('');
  const [netStakeAmount, setNetStakeAmount] = useState('');
  
  // Unstake state
  const [cpuUnstakeAmount, setCpuUnstakeAmount] = useState('');
  const [netUnstakeAmount, setNetUnstakeAmount] = useState('');

  // Get data from context
  const liquidBalance = accountData?.liquidBalance ?? parseWaxBalance(resources?.core_liquid_balance);
  const stakedCpu = accountData?.stakedCpu ?? 0;
  const stakedNet = accountData?.stakedNet ?? 0;
  const refundInfo = accountData?.refundRequest ?? null;

  useEffect(() => {
    if (accountName) {
      setStakeReceiver(accountName);
    }
  }, [accountName]);

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
      refetchAccountData();
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
      refetchAccountData();
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
      refetchAccountData();
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
            {[25, 50, 75, 100].map((percent) => (
              <Button
                key={percent}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPercentage('cpu', percent)}
                className="flex-1 text-xs bg-cheese/20 border-cheese/50 text-cheese hover:bg-cheese/30 hover:border-cheese"
              >
                {percent}%
              </Button>
            ))}
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
            {[25, 50, 75, 100].map((percent) => (
              <Button
                key={percent}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPercentage('net', percent)}
                className="flex-1 text-xs bg-cheese/20 border-cheese/50 text-cheese hover:bg-cheese/30 hover:border-cheese"
              >
                {percent}%
              </Button>
            ))}
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
        {refundStatus ? (
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
                `Available in ${refundStatus.timeLeft}`
              )}
            </Button>
          </>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              No pending refunds
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
