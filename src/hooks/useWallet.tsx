import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  WalletSession,
  loginWithWax,
  loginWithAnchor,
  logout as walletLogout,
} from "@/lib/wax";

interface WalletState {
  session: WalletSession | null;
  isConnecting: boolean;
  error: string | null;
  loginWithWax: () => Promise<void>;
  loginWithAnchor: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      session: null,
      isConnecting: false,
      error: null,

      loginWithWax: async () => {
        set({ isConnecting: true, error: null });
        try {
          const session = await loginWithWax();
          set({ session, isConnecting: false });
        } catch (error: any) {
          set({
            error: error.message || "Failed to connect WAX Cloud Wallet",
            isConnecting: false,
          });
        }
      },

      loginWithAnchor: async () => {
        set({ isConnecting: true, error: null });
        try {
          const session = await loginWithAnchor();
          set({ session, isConnecting: false });
        } catch (error: any) {
          set({
            error: error.message || "Failed to connect Anchor Wallet",
            isConnecting: false,
          });
        }
      },

      logout: async () => {
        const { session } = get();
        if (session) {
          await walletLogout(session);
        }
        set({ session: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "cheese-wallet-storage",
      partialize: (state) => ({
        // Don't persist the full session with anchor link
        session: state.session
          ? { type: state.session.type, account: state.session.account }
          : null,
      }),
    }
  )
);
