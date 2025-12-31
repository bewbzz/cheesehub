import { useState, useEffect, useCallback } from 'react';
import { useWax } from '@/context/WaxContext';
import {
  fetchAccountData,
  fetchGlobalState,
  HyperionAccountData,
  GlobalState,
  RefundRequest,
  VoterInfo,
} from '@/lib/waxRpcFallback';

export interface AccountDataState {
  // Basic resources
  accountName: string;
  ramQuota: number;
  ramUsage: number;
  cpuLimit: { used: number; max: number };
  netLimit: { used: number; max: number };
  liquidBalance: number;
  
  // Staking info
  stakedCpu: number;
  stakedNet: number;
  
  // Voter info
  voterInfo: VoterInfo | null;
  hasVoted: boolean;
  
  // Refund info
  refundRequest: RefundRequest | null;
  
  // Global state for rewards
  globalState: GlobalState | null;
}

interface UseAccountDataReturn {
  data: AccountDataState | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function parseWaxBalance(balance: string | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance.replace(' WAX', '')) || 0;
}

function parseStakedAmount(weight: string | undefined): number {
  if (!weight) return 0;
  return parseFloat(weight.split(' ')[0]) || 0;
}

export function useAccountData(): UseAccountDataReturn {
  const { accountName } = useWax();
  const [data, setData] = useState<AccountDataState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!accountName) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch account data and global state in parallel
      const [accountData, globalState] = await Promise.all([
        fetchAccountData(accountName),
        fetchGlobalState(),
      ]);

      console.log('[useAccountData] Raw account data:', accountData);

      // Parse voter info
      const voterInfo = accountData.voter_info || null;
      const hasVoted = voterInfo ? (
        (voterInfo.producers && voterInfo.producers.length > 0) ||
        (voterInfo.proxy && voterInfo.proxy.length > 0 && voterInfo.proxy !== '')
      ) : false;

      // Parse staked amounts
      const stakedCpu = parseStakedAmount(accountData.self_delegated_bandwidth?.cpu_weight);
      const stakedNet = parseStakedAmount(accountData.self_delegated_bandwidth?.net_weight);

      const state: AccountDataState = {
        accountName,
        ramQuota: accountData.ram_quota || 0,
        ramUsage: accountData.ram_usage || 0,
        cpuLimit: accountData.cpu_limit || { used: 0, max: 0 },
        netLimit: accountData.net_limit || { used: 0, max: 0 },
        liquidBalance: parseWaxBalance(accountData.core_liquid_balance),
        stakedCpu,
        stakedNet,
        voterInfo,
        hasVoted,
        refundRequest: accountData.refund_request || null,
        globalState,
      };

      console.log('[useAccountData] Parsed state:', state);
      setData(state);
    } catch (err) {
      console.error('[useAccountData] Error fetching account data:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
