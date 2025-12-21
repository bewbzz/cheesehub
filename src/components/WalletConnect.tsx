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
import { useWax } from "@/context/WaxContext";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WalletConnect() {
  const { session, isConnected, isLoading, accountName, login, logout } = useWax();
  const [open, setOpen] = useState(false);

  const handleLogin = async () => {
    await login();
    setOpen(false);
  };

  if (isConnected && accountName) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-cheese/30 hover:border-cheese hover:bg-cheese/10">
            <Wallet className="mr-2 h-4 w-4 text-cheese" />
            <span className="max-w-[120px] truncate">{accountName}</span>
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
