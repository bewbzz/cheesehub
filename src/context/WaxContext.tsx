import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Session } from '@wharfkit/session';
import { sessionKit, closeWharfkitModals, setLoginInProgress, isUserCancellation } from '@/lib/wharfKit';
import { CHEESE_CONFIG, WAX_CHAIN, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { useToast } from '@/hooks/use-toast';
import { 
  getWaxJS, 
  loginWithCloudWallet, 
  transactWithCloudWallet, 
  logoutCloudWallet,
  getCloudWalletAccount 
} from '@/lib/waxJsDirect';


interface WaxContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  accountName: string | null;
  cheeseBalance: number;
  login: () => void; // Opens wallet selection dialog
  loginCloudWallet: () => Promise<void>;
  loginAnchor: () => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  transferCheese: (amount: number, memo: string) => Promise<string | null>;
  transferToken: (
    tokenContract: string,
    tokenSymbol: string,
    precision: number,
    to: string,
    amount: number,
    memo: string
  ) => Promise<string | null>;
  transferNFTs: (to: string, assetIds: string[], memo: string) => Promise<string | null>;
  claimDrop: (
    dropId: string, 
    quantity: number, 
    listingPrice: string,
    tokenContract: string,
    tokenSymbol: string,
    precision: number
  ) => Promise<string | null>;
  claimFreeDrop: (dropId: string, quantity: number) => Promise<string | null>;
  joinDao: (daoName: string) => Promise<string | null>;
  leaveDao: (daoName: string) => Promise<string | null>;
}

const WaxContext = createContext<WaxContextType | undefined>(undefined);

export function WaxProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cheeseBalance, setCheeseBalance] = useState(0);
  const { toast } = useToast();
  
  // Track if using direct WaxJS (for Cloud Wallet) vs WharfKit session (for Anchor)
  const [cloudWalletAccount, setCloudWalletAccount] = useState<string | null>(null);
  const isUsingCloudWallet = !!cloudWalletAccount;

  // Account name can come from either WharfKit session or direct Cloud Wallet
  const accountName = cloudWalletAccount || session?.actor?.toString() || null;
  const isConnected = !!session || !!cloudWalletAccount;

  const refreshBalance = useCallback(async () => {
    // Use either cloud wallet account or session account
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      setCheeseBalance(0);
      return;
    }

    const endpoints = WAX_CHAIN.rpcUrls || [WAX_CHAIN.url];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(
          `${endpoint}/v1/chain/get_currency_balance`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: CHEESE_CONFIG.tokenContract,
              account,
              symbol: CHEESE_CONFIG.tokenSymbol,
            }),
          }
        );

        if (!response.ok) {
          continue; // Try next endpoint
        }

        const balances = await response.json();
        if (balances && balances.length > 0) {
          const balance = parseFloat(balances[0].split(' ')[0]);
          setCheeseBalance(balance);
          return; // Success, exit
        } else {
          setCheeseBalance(0);
          return;
        }
      } catch (error) {
        console.error(`Failed to fetch CHEESE balance from ${endpoint}:`, error);
        // Continue to next endpoint
      }
    }
    
    // All endpoints failed
    console.error('All RPC endpoints failed for CHEESE balance');
    setCheeseBalance(0);
  }, [session, cloudWalletAccount]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const restored = await sessionKit.restore();
        if (restored) {
          const actorName = restored.actor.toString();
          
          // Cloud Wallet sessions (.wam) don't properly restore the signing bridge
          // Force a fresh login to ensure transaction signing works
          if (actorName.endsWith('.wam')) {
            console.log('Cloud Wallet session detected - clearing for fresh login');
            await sessionKit.logout(restored);
            // Clear all WharfKit-related localStorage to ensure clean state
            Object.keys(localStorage)
              .filter(key => key.includes('wharfkit') || key.includes('cloudwallet'))
              .forEach(key => localStorage.removeItem(key));
            return; // Don't set session - user will need to reconnect
          }
          
          // Anchor sessions can be restored normally
          console.log('Session restored for:', actorName);
          setSession(restored);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };
    restoreSession();
  }, []);

  // Initial balance refresh on session or cloudWallet change
  useEffect(() => {
    refreshBalance();
  }, [session, cloudWalletAccount, refreshBalance]);

  // Periodic balance refresh every 30 seconds when connected
  useEffect(() => {
    if (!session && !cloudWalletAccount) return;
    
    const intervalId = setInterval(() => {
      refreshBalance();
    }, 30000); // 30 seconds
    
    return () => clearInterval(intervalId);
  }, [session, cloudWalletAccount, refreshBalance]);

  // Trigger wallet selection dialog (dispatches event to WalletConnect)
  const login = () => {
    window.dispatchEvent(new CustomEvent('open-wallet-connect'));
  };

  // Direct Cloud Wallet login - triggers ONE popup immediately
  const loginCloudWallet = async () => {
    setIsLoading(true);
    try {
      console.log('[WaxContext] Logging in with Cloud Wallet directly...');
      const waxAccount = await loginWithCloudWallet();
      setCloudWalletAccount(waxAccount);
      setSession(null); // Don't use WharfKit session for Cloud Wallet
      
      toast({
        title: 'Cloud Wallet Connected',
        description: `Connected as ${waxAccount}`,
      });
    } catch (error) {
      console.error('Cloud Wallet login failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Don't show error for user cancellation
      if (!errorMsg.toLowerCase().includes('closed') && !errorMsg.toLowerCase().includes('cancel')) {
        toast({
          title: 'Login Failed',
          description: errorMsg || 'Failed to connect Cloud Wallet',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Anchor Wallet login via WharfKit - triggers ONE modal
  const loginAnchor = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    try {
      console.log('[WaxContext] Logging in with Anchor via WharfKit...');
      const response = await sessionKit.login();
      const actorName = response.session.actor.toString();
      
      setSession(response.session);
      setCloudWalletAccount(null);
      
      toast({
        title: 'Anchor Wallet Connected',
        description: `Connected as ${actorName}`,
      });
    } catch (error) {
      console.error('Anchor login failed:', error);
      
      if (!isUserCancellation(error)) {
        toast({
          title: 'Login Failed',
          description: error instanceof Error ? error.message : 'Failed to connect Anchor',
          variant: 'destructive',
        });
      }
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Handle WharfKit session logout
    if (session) {
      try {
        await sessionKit.logout(session);
      } catch (error) {
        console.error('WharfKit logout failed:', error);
      }
    }
    
    // Handle direct Cloud Wallet logout
    if (cloudWalletAccount) {
      logoutCloudWallet();
    }
    
    // Clear ALL wallet storage to prevent stale state
    Object.keys(localStorage)
      .filter(key => 
        key.includes('wharfkit') || 
        key.includes('cloudwallet') ||
        key.includes('anchor-link') ||
        key.includes('wax')
      )
      .forEach(key => localStorage.removeItem(key));
    
    setSession(null);
    setCloudWalletAccount(null);
    setCheeseBalance(0);
    
    toast({
      title: 'Wallet Disconnected',
      description: 'You have been logged out',
    });
  };

  const transferCheese = async (amount: number, memo: string): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(CHEESE_CONFIG.tokenPrecision)} ${CHEESE_CONFIG.tokenSymbol}`;

    try {
      const action = {
        account: CHEESE_CONFIG.tokenContract,
        name: 'transfer',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          from: account,
          to: CHEESE_CONFIG.paymentWallet,
          quantity,
          memo,
        },
      };
      
      let txId: string | null = null;
      
      // Use direct WaxJS for Cloud Wallet, WharfKit for Anchor
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }

      toast({
        title: 'Transaction Successful',
        description: `Sent ${quantity} to ${CHEESE_CONFIG.paymentWallet}`,
      });

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      
      // Only cleanup modals on explicit user cancellation (Anchor only)
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send CHEESE',
        variant: 'destructive',
      });
      return null;
    }
  };

  const transferToken = async (
    tokenContract: string,
    tokenSymbol: string,
    precision: number,
    to: string,
    amount: number,
    memo: string
  ): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(precision)} ${tokenSymbol}`;

    try {
      const action = {
        account: tokenContract,
        name: 'transfer',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          from: account,
          to,
          quantity,
          memo,
        },
      };
      
      let txId: string | null = null;
      
      // Use direct WaxJS for Cloud Wallet, WharfKit for Anchor
      if (isUsingCloudWallet) {
        console.log('[WaxContext] Using direct WaxJS for Cloud Wallet transaction');
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }
      
      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      
      // Only cleanup modals on explicit user cancellation (Anchor only)
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send tokens',
        variant: 'destructive',
      });
      return null;
    }
  };

  const transferNFTs = async (
    to: string,
    assetIds: string[],
    memo: string
  ): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          from: account,
          to,
          asset_ids: assetIds,
          memo,
        },
      };
      
      let txId: string | null = null;
      
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }
      
      return txId;
    } catch (error) {
      console.error('NFT transfer failed:', error);
      
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Failed to send NFTs',
        variant: 'destructive',
      });
      return null;
    }
  };

  const claimDrop = async (
    dropId: string,
    quantity: number,
    listingPrice: string,
    tokenContract: string,
    tokenSymbol: string,
    precision: number
  ): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    // Calculate total price (listingPrice is per unit, e.g., "100.0000 CHEESE")
    const priceAmount = parseFloat(listingPrice.split(' ')[0]) * quantity;
    const priceQuantity = `${priceAmount.toFixed(precision)} ${tokenSymbol}`;

    try {
      const actions = [
        {
          account: tokenContract,
          name: 'transfer',
          authorization: [{ actor: account, permission: 'active' }],
          data: {
            from: account,
            to: NFTHIVE_CONFIG.dropContract,
            quantity: priceQuantity,
            memo: 'deposit',
          },
        },
        {
          account: NFTHIVE_CONFIG.dropContract,
          name: 'claimdrop',
          authorization: [{ actor: account, permission: 'active' }],
          data: {
            claimer: account,
            drop_id: parseInt(dropId),
            amount: quantity,
            intended_delphi_median: 0,
            referrer: '',
            country: '',
            currency: `${precision},${tokenSymbol}`,
          },
        },
      ];
      
      let txId: string | null = null;
      
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet(actions);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions });
        txId = result.resolved?.transaction.id?.toString() || null;
      }
      
      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Claim drop failed:', error);
      
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim drop',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Claim a free auth-required drop (no payment needed)
  const claimFreeDrop = async (
    dropId: string,
    quantity: number
  ): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: NFTHIVE_CONFIG.dropContract,
        name: 'claimdrop',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          claimer: account,
          drop_id: parseInt(dropId),
          amount: quantity,
          intended_delphi_median: 0,
          referrer: '',
          country: '',
          currency: '0,NULL', // Free drops don't need currency
        },
      };
      
      let txId: string | null = null;
      
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }

      toast({
        title: 'Claim Successful! 🧀',
        description: 'Your free NFT has been claimed!',
      });

      return txId;
    } catch (error) {
      console.error('Claim free drop failed:', error);
      
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim free drop',
        variant: 'destructive',
      });
      return null;
    }
  };

  const joinDao = async (daoName: string): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'joindao',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          user: account,
          dao: daoName,
        },
      };
      
      let txId: string | null = null;
      
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }

      toast({
        title: 'Joined DAO',
        description: `Successfully joined ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Join DAO failed:', error);
      
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // If already a member, treat as success and update UI
      if (errorMsg.toLowerCase().includes('already') || 
          errorMsg.toLowerCase().includes('member')) {
        toast({
          title: 'Already a Member',
          description: `You are already a member of ${daoName}`,
        });
        return 'already_member'; // Signal to update UI
      }
      
      toast({
        title: 'Join Failed',
        description: errorMsg || 'Failed to join DAO',
        variant: 'destructive',
      });
      return null;
    }
  };

  const leaveDao = async (daoName: string): Promise<string | null> => {
    const account = cloudWalletAccount || session?.actor?.toString();
    if (!account) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'leavedao',
        authorization: [{ actor: account, permission: 'active' }],
        data: {
          user: account,
          dao: daoName,
        },
      };
      
      let txId: string | null = null;
      
      if (isUsingCloudWallet) {
        const result = await transactWithCloudWallet([action]);
        txId = result.transaction_id;
      } else if (session) {
        const result = await session.transact({ actions: [action] });
        txId = result.resolved?.transaction.id?.toString() || null;
      }

      toast({
        title: 'Left DAO',
        description: `Successfully left ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Leave DAO failed:', error);
      
      if (!isUsingCloudWallet && isUserCancellation(error)) {
        closeWharfkitModals();
      }
      
      toast({
        title: 'Leave Failed',
        description: error instanceof Error ? error.message : 'Failed to leave DAO',
        variant: 'destructive',
      });
      return null;
    }
  };

  return (
    <WaxContext.Provider
      value={{
        session,
        isConnected,
        isLoading,
        accountName,
        cheeseBalance,
        login,
        loginCloudWallet,
        loginAnchor,
        logout,
        refreshBalance,
        transferCheese,
        transferToken,
        transferNFTs,
        claimDrop,
        claimFreeDrop,
        joinDao,
        leaveDao,
      }}
    >
      {children}
    </WaxContext.Provider>
  );
}

export function useWax() {
  const context = useContext(WaxContext);
  if (!context) {
    throw new Error('useWax must be used within a WaxProvider');
  }
  return context;
}
