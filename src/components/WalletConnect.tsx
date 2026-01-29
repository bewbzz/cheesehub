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
import { Wallet, LogOut, ChevronDown, Send, Music2 } from "lucide-react";
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
import { CheeseAmpMiniPlayer } from "./music/CheeseAmpMiniPlayer";
import { useCheeseAmpAutoAdvance } from "@/hooks/useCheeseAmpAutoAdvance";
import { getAudioPlayer } from "@/lib/musicPlayer";

export function WalletConnect() {
  const { session, isConnected, isLoading, accountName, cheeseBalance, login, logout } = useWax();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [cheeseAmpOpen, setCheeseAmpOpen] = useState(false);
  const [cheeseAmpMinimized, setCheeseAmpMinimized] = useState(false);

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

  // Listen for custom event to open CHEESEAmp
  useEffect(() => {
    const handleOpenCheeseAmp = () => {
      if (isConnected) {
        // If minimized, expand instead of opening fresh
        if (cheeseAmpMinimized) {
          setCheeseAmpMinimized(false);
          setCheeseAmpOpen(true);
        } else {
          setCheeseAmpOpen(true);
        }
      } else {
        setOpen(true);
      }
    };
    window.addEventListener('open-cheese-amp', handleOpenCheeseAmp);
    return () => window.removeEventListener('open-cheese-amp', handleOpenCheeseAmp);
  }, [isConnected, cheeseAmpMinimized]);

  // Close mini player when user logs out
  useEffect(() => {
    if (!isConnected) {
      setCheeseAmpMinimized(false);
    }
  }, [isConnected]);

  const handleLogin = async () => {
    // Close our dialog FIRST before triggering WharfKit login
    // This prevents the Radix dialog from interfering with WharfKit's modal
    setOpen(false);
    
    // Small delay to ensure our dialog is fully unmounted
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await login();
  };

  const handleCheeseAmpMinimize = () => {
    setCheeseAmpOpen(false);
    setCheeseAmpMinimized(true);
  };

  const handleCheeseAmpExpand = () => {
    setCheeseAmpMinimized(false);
    setCheeseAmpOpen(true);
  };

  const handleMiniPlayerClose = () => {
    getAudioPlayer().stop();
    setCheeseAmpMinimized(false);
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
          <DropdownMenuItem 
            onClick={() => {
              if (cheeseAmpMinimized) {
                handleCheeseAmpExpand();
              } else {
                setCheeseAmpOpen(true);
              }
            }} 
            className="cursor-pointer"
          >
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
        onMinimize={handleCheeseAmpMinimize} 
      />
      {cheeseAmpMinimized && (
        <CheeseAmpMiniPlayer
          onExpand={handleCheeseAmpExpand}
          onClose={handleMiniPlayerClose}
        />
      )}
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
            Connect to Cheese DAO Tools
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="h-14 bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            <Wallet className="mr-2 h-5 w-5" />
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Supports WAX Cloud Wallet and Anchor
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
