import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useWax } from './WaxContext';
import {
  fetchAccountData,
  fetchGlobalState,
  HyperionAccountData,
  GlobalState,
  RefundRequest,
  VoterInfo,
} from '@/lib/waxRpcFallback';

// ============================================
// TYPES
// ============================================

export interface WalletAccountData {
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

interface WalletDataContextType {
  accountData: WalletAccountData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isInitialized: boolean;
}

// ============================================
// CONTEXT
// ============================================

const WalletDataContext = createContext<WalletDataContextType | null>(null);

// ============================================
// HELPERS
// ============================================

function parseWaxBalance(balance: string | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance.replace(' WAX', '')) || 0;
}

function parseStakedAmount(weight: string | undefined): number {
  if (!weight) return 0;
  return parseFloat(weight.split(' ')[0]) || 0;
}

// ============================================
// PROVIDER
// ============================================

interface WalletDataProviderProps {
  children: ReactNode;
}

export function WalletDataProvider({ children }: WalletDataProviderProps) {
  const { accountName } = useWax();
  const [accountData, setAccountData] = useState<WalletAccountData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchData = useCallback(async () => {
    if (!accountName) {
      setAccountData(null);
      setIsInitialized(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch account data and global state in parallel - single API call each!
      const [rawAccountData, globalState] = await Promise.all([
        fetchAccountData(accountName),
        fetchGlobalState(),
      ]);

      console.log('[WalletDataContext] Raw account data:', rawAccountData);

      // Parse voter info
      const voterInfo = rawAccountData.voter_info || null;
      const hasVoted = voterInfo ? (
        (voterInfo.producers && voterInfo.producers.length > 0) ||
        (voterInfo.proxy && voterInfo.proxy.length > 0 && voterInfo.proxy !== '')
      ) : false;

      // Parse staked amounts
      const stakedCpu = parseStakedAmount(rawAccountData.self_delegated_bandwidth?.cpu_weight);
      const stakedNet = parseStakedAmount(rawAccountData.self_delegated_bandwidth?.net_weight);

      const data: WalletAccountData = {
        accountName,
        ramQuota: rawAccountData.ram_quota || 0,
        ramUsage: rawAccountData.ram_usage || 0,
        cpuLimit: rawAccountData.cpu_limit || { used: 0, max: 0 },
        netLimit: rawAccountData.net_limit || { used: 0, max: 0 },
        liquidBalance: parseWaxBalance(rawAccountData.core_liquid_balance),
        stakedCpu,
        stakedNet,
        voterInfo,
        hasVoted,
        refundRequest: rawAccountData.refund_request || null,
        globalState,
      };

      console.log('[WalletDataContext] Parsed data:', data);
      setAccountData(data);
      setIsInitialized(true);
    } catch (err) {
      console.error('[WalletDataContext] Error fetching account data:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [accountName]);

  // Fetch data when account changes
  useEffect(() => {
    if (accountName) {
      fetchData();
    } else {
      setAccountData(null);
      setIsInitialized(false);
    }
  }, [accountName, fetchData]);

  const value: WalletDataContextType = {
    accountData,
    isLoading,
    error,
    refetch: fetchData,
    isInitialized,
  };

  return (
    <WalletDataContext.Provider value={value}>
      {children}
    </WalletDataContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useWalletData(): WalletDataContextType {
  const context = useContext(WalletDataContext);
  if (!context) {
    throw new Error('useWalletData must be used within a WalletDataProvider');
  }
  return context;
}
