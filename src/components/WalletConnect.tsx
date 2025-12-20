import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WalletConnect() {
  const { session, isConnecting, error, loginWithWax, loginWithAnchor, logout, clearError } = useWallet();
  const [open, setOpen] = useState(false);

  const handleWaxLogin = async () => {
    await loginWithWax();
    if (!error) setOpen(false);
  };

  const handleAnchorLogin = async () => {
    await loginWithAnchor();
    if (!error) setOpen(false);
  };

  if (session) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-cheese/30 hover:border-cheese hover:bg-cheese/10">
            <Wallet className="mr-2 h-4 w-4 text-cheese" />
            <span className="max-w-[120px] truncate">{session.account}</span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={logout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) clearError();
    }}>
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
            Choose a wallet to connect to Cheese DAO Tools
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleWaxLogin}
            disabled={isConnecting}
            variant="outline"
            className="h-14 justify-start gap-4 border-border hover:border-cheese hover:bg-cheese/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
              <span className="text-lg font-bold text-orange-500">W</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold">WAX Cloud Wallet</span>
              <span className="text-xs text-muted-foreground">Login with your WAX account</span>
            </div>
          </Button>
          <Button
            onClick={handleAnchorLogin}
            disabled={isConnecting}
            variant="outline"
            className="h-14 justify-start gap-4 border-border hover:border-cheese hover:bg-cheese/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <span className="text-lg font-bold text-blue-500">⚓</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold">Anchor Wallet</span>
              <span className="text-xs text-muted-foreground">Login with Anchor</span>
            </div>
          </Button>
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          {isConnecting && (
            <p className="text-center text-sm text-muted-foreground">Connecting...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
