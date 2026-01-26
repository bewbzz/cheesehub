import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWax } from "@/context/WaxContext";
import { Wallet, LogOut, ChevronDown, Send, Music2, Cloud, Anchor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import cheeseLogo from "@/assets/cheese-logo.png";
import { WalletTransferDialog } from "./WalletTransferDialog";
import { CheeseAmpDialog } from "./music/CheeseAmpDialog";
import { useCheeseAmpAutoAdvance } from "@/hooks/useCheeseAmpAutoAdvance";

export function WalletConnect() {
  const { session, isConnected, isLoading, accountName, cheeseBalance, loginCloudWallet, loginAnchor, logout } = useWax();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [cheeseAmpOpen, setCheeseAmpOpen] = useState(false);

  // Persistent auto-advance hook - works even when CHEESEAmp dialog is minimized
  useCheeseAmpAutoAdvance(accountName);

  // Listen for custom event to open wallet
  useEffect(() => {
    const handleOpenWallet = () => {
      if (isConnected) {
        setWalletOpen(true);
      } else {
        setOpen(true);
      }
    };
    window.addEventListener('open-cheese-wallet', handleOpenWallet);
    return () => window.removeEventListener('open-cheese-wallet', handleOpenWallet);
  }, [isConnected]);

  // Listen for custom event to open wallet connect dialog (from context.login())
  useEffect(() => {
    const handleOpenConnect = () => {
      if (!isConnected) {
        setOpen(true);
      }
    };
    window.addEventListener('open-wallet-connect', handleOpenConnect);
    return () => window.removeEventListener('open-wallet-connect', handleOpenConnect);
  }, [isConnected]);

  // Listen for custom event to open CHEESEAmp
  useEffect(() => {
    const handleOpenCheeseAmp = () => {
      if (isConnected) {
        setCheeseAmpOpen(true);
      } else {
        setOpen(true);
      }
    };
    window.addEventListener('open-cheese-amp', handleOpenCheeseAmp);
    return () => window.removeEventListener('open-cheese-amp', handleOpenCheeseAmp);
  }, [isConnected]);

  // Direct Cloud Wallet login - closes dialog and opens popup immediately
  const handleCloudWalletLogin = async () => {
    setOpen(false); // Close dialog first to preserve user gesture
    await loginCloudWallet();
  };

  // Anchor Wallet login - closes dialog and opens WharfKit modal
  const handleAnchorLogin = async () => {
    setOpen(false); // Close dialog first to preserve user gesture
    await loginAnchor();
  };

  if (isConnected && accountName) {
    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-cheese/30 hover:border-cheese hover:bg-cheese/10">
            <Wallet className="mr-2 h-4 w-4 text-cheese" />
            <span className="max-w-[120px] truncate">{accountName}</span>
            <span className="ml-2 text-cheese font-semibold flex items-center gap-1">
              <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
              {cheeseBalance !== null ? cheeseBalance.toLocaleString() : '...'}
            </span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setWalletOpen(true)} className="cursor-pointer">
            <Send className="mr-2 h-4 w-4" />
            Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCheeseAmpOpen(true)} className="cursor-pointer">
            <Music2 className="mr-2 h-4 w-4" />
            <span><span className="text-cheese">CHEESE</span>Amp</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WalletTransferDialog open={walletOpen} onOpenChange={setWalletOpen} />
      <CheeseAmpDialog 
        open={cheeseAmpOpen} 
        onOpenChange={setCheeseAmpOpen} 
        onMinimize={() => setCheeseAmpOpen(false)} 
      />
    </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Connect Your Wallet</DialogTitle>
          <DialogDescription className="text-center">
            Choose your wallet to connect to CHEESEHub
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            onClick={handleCloudWalletLogin}
            disabled={isLoading}
            className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Cloud className="mr-2 h-5 w-5" />
            {isLoading ? "Connecting..." : "WAX Cloud Wallet"}
          </Button>
          <Button
            onClick={handleAnchorLogin}
            disabled={isLoading}
            variant="outline"
            className="h-14 border-accent/50 hover:bg-accent/10 hover:border-accent"
          >
            <Anchor className="mr-2 h-5 w-5 text-accent" />
            {isLoading ? "Connecting..." : "Anchor Wallet"}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Cloud Wallet is recommended for new users
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
