import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session } from '@wharfkit/session';
import { sessionKit } from '@/lib/wharfKit';
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
  claimDrop: (dropId: string, quantity: number, totalPrice: number) => Promise<string | null>;
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

    try {
      const response = await fetch(
        `${WAX_CHAIN.url}/v1/chain/get_currency_balance`,
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

      const balances = await response.json();
      if (balances && balances.length > 0) {
        const balance = parseFloat(balances[0].split(' ')[0]);
        setCheeseBalance(balance);
      } else {
        setCheeseBalance(0);
      }
    } catch (error) {
      console.error('Failed to fetch CHEESE balance:', error);
      setCheeseBalance(0);
    }
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

  useEffect(() => {
    refreshBalance();
  }, [session, refreshBalance]);

  const login = async () => {
    setIsLoading(true);
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

    try {
      const action = {
        account: CHEESE_CONFIG.tokenContract,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: session.actor.toString(),
          to: CHEESE_CONFIG.paymentWallet,
          quantity,
          memo,
        },
      };

      const result = await session.transact({ actions: [action] });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Transaction Successful',
        description: `Sent ${quantity} to ${CHEESE_CONFIG.paymentWallet}`,
      });

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send CHEESE',
        variant: 'destructive',
      });
      return null;
    }
  };

  const claimDrop = async (
    dropId: string,
    quantity: number,
    totalPrice: number
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const priceQuantity = `${totalPrice.toFixed(CHEESE_CONFIG.tokenPrecision)} ${CHEESE_CONFIG.tokenSymbol}`;

    try {
      const actions = [
        {
          account: CHEESE_CONFIG.tokenContract,
          name: 'transfer',
          authorization: [session.permissionLevel],
          data: {
            from: session.actor.toString(),
            to: NFTHIVE_CONFIG.dropContract,
            quantity: priceQuantity,
            memo: 'deposit',
          },
        },
        {
          account: NFTHIVE_CONFIG.dropContract,
          name: 'claimdrop',
          authorization: [session.permissionLevel],
          data: {
            claimer: session.actor.toString(),
            drop_id: parseInt(dropId),
            amount: quantity,
            intended_delphi_median: 0,
            referrer: '',
            country: '',
            currency: `${CHEESE_CONFIG.tokenPrecision},${CHEESE_CONFIG.tokenSymbol}`,
          },
        },
      ];

      const result = await session.transact({ actions });
      const txId = result.resolved?.transaction.id?.toString() || null;

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Claim drop failed:', error);
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim drop',
        variant: 'destructive',
      });
      return null;
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

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'joindao',
        authorization: [session.permissionLevel],
        data: {
          user: session.actor.toString(),
          dao: daoName,
        },
      };

      const result = await session.transact({ actions: [action] });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Joined DAO',
        description: `Successfully joined ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Join DAO failed:', error);
      toast({
        title: 'Join Failed',
        description: error instanceof Error ? error.message : 'Failed to join DAO',
        variant: 'destructive',
      });
      return null;
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

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'leavedao',
        authorization: [session.permissionLevel],
        data: {
          user: session.actor.toString(),
          dao: daoName,
        },
      };

      const result = await session.transact({ actions: [action] });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Left DAO',
        description: `Successfully left ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Leave DAO failed:', error);
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
        logout,
        refreshBalance,
        transferCheese,
        claimDrop,
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
