import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@wharfkit/session';
import { sessionKit, closeWharfkitModals, setLoginInProgress, clearStaleSession, isStaleSessionError } from '@/lib/wharfKit';
import { CHEESE_CONFIG, WAX_CHAIN, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { useToast } from '@/hooks/use-toast';


interface WaxContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  accountName: string | null;
  cheeseBalance: number;
  login: () => Promise<void>;
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

  const accountName = session?.actor?.toString() || null;
  const isConnected = !!session;

  const refreshBalance = useCallback(async () => {
    if (!session) {
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
              account: session.actor.toString(),
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
  }, [session]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const restored = await sessionKit.restore();
        if (restored) {
          setSession(restored);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };
    restoreSession();
  }, []);

  // Initial balance refresh on session change
  useEffect(() => {
    refreshBalance();
  }, [session, refreshBalance]);

  // Periodic balance refresh every 30 seconds when connected
  useEffect(() => {
    if (!session) return;
    
    const intervalId = setInterval(() => {
      refreshBalance();
    }, 30000); // 30 seconds
    
    return () => clearInterval(intervalId);
  }, [session, refreshBalance]);

  const login = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    try {
      const response = await sessionKit.login();
      setSession(response.session);
      toast({
        title: 'Wallet Connected',
        description: `Connected as ${response.session.actor}`,
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (session) {
      try {
        await sessionKit.logout(session);
        setSession(null);
        setCheeseBalance(0);
        toast({
          title: 'Wallet Disconnected',
          description: 'You have been logged out',
        });
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
  };

  // Attempt to silently refresh a stale Cloud Wallet session
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      // Try to re-login - Cloud Wallet's autoUrl makes this seamless
      // if user is already authenticated in their browser
      setLoginInProgress(true);
      const response = await sessionKit.login();
      setSession(response.session);
      console.log('Session refreshed successfully');
      return response.session;
    } catch (error) {
      console.error('Silent session refresh failed:', error);
      return null;
    } finally {
      setLoginInProgress(false);
    }
  }, []);

  // Handle stale/expired Cloud Wallet session - try refresh first, then logout
  const handleStaleSession = useCallback(async (): Promise<Session | null> => {
    // First, try to silently refresh the session
    const newSession = await refreshSession();
    
    if (newSession) {
      toast({
        title: 'Session Refreshed',
        description: 'Your wallet session has been renewed.',
      });
      return newSession;
    }
    
    // Refresh failed - fall back to full logout
    if (session) {
      try {
        await sessionKit.logout(session);
      } catch (e) {
        // Ignore logout errors for stale sessions
      }
    }
    setSession(null);
    setCheeseBalance(0);
    await clearStaleSession();
    
    toast({
      title: 'Session Expired',
      description: 'Please reconnect your wallet to continue.',
      variant: 'destructive',
    });
    
    return null;
  }, [session, toast, refreshSession]);

  const transferCheese = async (amount: number, memo: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(CHEESE_CONFIG.tokenPrecision)} ${CHEESE_CONFIG.tokenSymbol}`;

    const executeTransfer = async (currentSession: Session) => {
      const action = {
        account: CHEESE_CONFIG.tokenContract,
        name: 'transfer',
        authorization: [currentSession.permissionLevel],
        data: {
          from: currentSession.actor.toString(),
          to: CHEESE_CONFIG.paymentWallet,
          quantity,
          memo,
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeTransfer(session);
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Transaction Successful',
        description: `Sent ${quantity} to ${CHEESE_CONFIG.paymentWallet}`,
      });

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeTransfer(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            toast({
              title: 'Transaction Successful',
              description: `Sent ${quantity} to ${CHEESE_CONFIG.paymentWallet}`,
            });
            await refreshBalance();
            return txId;
          } catch (retryError) {
            console.error('Retry transfer failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Transaction Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to send CHEESE',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send CHEESE',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
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
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(precision)} ${tokenSymbol}`;

    const executeTransfer = async (currentSession: Session) => {
      const action = {
        account: tokenContract,
        name: 'transfer',
        authorization: [currentSession.permissionLevel],
        data: {
          from: currentSession.actor.toString(),
          to,
          quantity,
          memo,
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeTransfer(session);
      const txId = result.resolved?.transaction.id?.toString() || null;
      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeTransfer(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            await refreshBalance();
            return txId;
          } catch (retryError) {
            console.error('Retry transfer failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Transaction Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to send tokens',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send tokens',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const transferNFTs = async (
    to: string,
    assetIds: string[],
    memo: string
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const executeTransfer = async (currentSession: Session) => {
      const action = {
        account: 'atomicassets',
        name: 'transfer',
        authorization: [currentSession.permissionLevel],
        data: {
          from: currentSession.actor.toString(),
          to,
          asset_ids: assetIds,
          memo,
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeTransfer(session);
      const txId = result.resolved?.transaction.id?.toString() || null;
      return txId;
    } catch (error) {
      console.error('NFT transfer failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeTransfer(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            return txId;
          } catch (retryError) {
            console.error('Retry NFT transfer failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Transfer Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to send NFTs',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Failed to send NFTs',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
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
    if (!session) {
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

    const executeClaim = async (currentSession: Session) => {
      const actions = [
        {
          account: tokenContract,
          name: 'transfer',
          authorization: [currentSession.permissionLevel],
          data: {
            from: currentSession.actor.toString(),
            to: NFTHIVE_CONFIG.dropContract,
            quantity: priceQuantity,
            memo: 'deposit',
          },
        },
        {
          account: NFTHIVE_CONFIG.dropContract,
          name: 'claimdrop',
          authorization: [currentSession.permissionLevel],
          data: {
            claimer: currentSession.actor.toString(),
            drop_id: parseInt(dropId),
            amount: quantity,
            intended_delphi_median: 0,
            referrer: '',
            country: '',
            currency: `${precision},${tokenSymbol}`,
          },
        },
      ];
      return await currentSession.transact({ actions });
    };

    try {
      const result = await executeClaim(session);
      const txId = result.resolved?.transaction.id?.toString() || null;
      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Claim drop failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeClaim(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            await refreshBalance();
            return txId;
          } catch (retryError) {
            console.error('Retry claim drop failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Claim Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to claim drop',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim drop',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  // Claim a free auth-required drop (no payment needed)
  const claimFreeDrop = async (
    dropId: string,
    quantity: number
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const executeClaim = async (currentSession: Session) => {
      const action = {
        account: NFTHIVE_CONFIG.dropContract,
        name: 'claimdrop',
        authorization: [currentSession.permissionLevel],
        data: {
          claimer: currentSession.actor.toString(),
          drop_id: parseInt(dropId),
          amount: quantity,
          intended_delphi_median: 0,
          referrer: '',
          country: '',
          currency: '0,NULL', // Free drops don't need currency
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeClaim(session);
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Claim Successful! 🧀',
        description: 'Your free NFT has been claimed!',
      });

      return txId;
    } catch (error) {
      console.error('Claim free drop failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeClaim(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            toast({
              title: 'Claim Successful! 🧀',
              description: 'Your free NFT has been claimed!',
            });
            return txId;
          } catch (retryError) {
            console.error('Retry claim free drop failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Claim Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to claim free drop',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim free drop',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const joinDao = async (daoName: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const executeJoin = async (currentSession: Session) => {
      const action = {
        account: 'dao.waxdao',
        name: 'joindao',
        authorization: [currentSession.permissionLevel],
        data: {
          user: currentSession.actor.toString(),
          dao: daoName,
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeJoin(session);
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Joined DAO',
        description: `Successfully joined ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Join DAO failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeJoin(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            toast({
              title: 'Joined DAO',
              description: `Successfully joined ${daoName}`,
            });
            return txId;
          } catch (retryError) {
            console.error('Retry join DAO failed:', retryError);
            closeWharfkitModals();
            const errorMsg = retryError instanceof Error ? retryError.message : String(retryError);
            if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('member')) {
              toast({ title: 'Already a Member', description: `You are already a member of ${daoName}` });
              return 'already_member';
            }
            toast({ title: 'Join Failed', description: errorMsg, variant: 'destructive' });
          }
        }
        return null;
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
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const leaveDao = async (daoName: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const executeLeave = async (currentSession: Session) => {
      const action = {
        account: 'dao.waxdao',
        name: 'leavedao',
        authorization: [currentSession.permissionLevel],
        data: {
          user: currentSession.actor.toString(),
          dao: daoName,
        },
      };
      return await currentSession.transact({ actions: [action] });
    };

    try {
      const result = await executeLeave(session);
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Left DAO',
        description: `Successfully left ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Leave DAO failed:', error);
      closeWharfkitModals();
      
      // Handle stale Cloud Wallet session - try refresh and retry
      if (isStaleSessionError(error)) {
        const newSession = await handleStaleSession();
        if (newSession) {
          try {
            const result = await executeLeave(newSession);
            const txId = result.resolved?.transaction.id?.toString() || null;
            toast({
              title: 'Left DAO',
              description: `Successfully left ${daoName}`,
            });
            return txId;
          } catch (retryError) {
            console.error('Retry leave DAO failed:', retryError);
            closeWharfkitModals();
            toast({
              title: 'Leave Failed',
              description: retryError instanceof Error ? retryError.message : 'Failed to leave DAO',
              variant: 'destructive',
            });
          }
        }
        return null;
      }
      
      toast({
        title: 'Leave Failed',
        description: error instanceof Error ? error.message : 'Failed to leave DAO',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
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
