import { ShoppingCart, Wallet, LogOut, RefreshCw, ChevronDown, ArrowLeft, Users, UserPlus, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/context/CartContext";
import { useWax } from "@/context/WaxContext";
import cheeseLogo from "@/assets/cheese-logo.png";

export function DropsHeader() {
  const { totalItems, setIsOpen } = useCart();
  const { 
    isConnected, 
    isLoading, 
    accountName, 
    cheeseBalance, 
    login, 
    logout, 
    refreshBalance,
    allSessions,
    switchAccount,
    addAccount,
    removeAccount,
  } = useWax();

  // Filter out the current session from the switch list
  const otherSessions = allSessions.filter(
    s => String(s.actor) !== accountName
  );

  const handleAddAccount = async () => {
    // Small delay to ensure dropdown is closed
    await new Promise(resolve => setTimeout(resolve, 100));
    await addAccount();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Back to Hub</span>
          </Link>
          <div className="h-6 w-px bg-border/50 hidden sm:block" />
          <Link to="/drops" className="flex items-center gap-3 group">
            <img src={cheeseLogo} alt="Cheese" className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            <span className="font-display text-2xl font-bold">
              <span className="text-primary cheese-text-glow">CHEESE</span><span className="text-foreground">Drops</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-primary/50 hover:border-primary hover:bg-primary/10 text-foreground gap-2"
                >
                  <div className="flex items-center gap-2">
                    <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
                    <span className="font-medium text-primary">{cheeseBalance.toLocaleString()}</span>
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <span className="max-w-[100px] truncate">{accountName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
                <DropdownMenuItem onClick={refreshBalance} className="cursor-pointer">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Balance
                </DropdownMenuItem>
                
                {/* Account Switching Submenu */}
                {allSessions.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        Switch Account
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="w-56 bg-card border-border">
                          {/* Current account */}
                          <DropdownMenuItem disabled className="opacity-100">
                            <Check className="mr-2 h-4 w-4 text-primary" />
                            <span className="font-medium">{accountName}</span>
                            <span className="ml-auto text-xs text-muted-foreground">(active)</span>
                          </DropdownMenuItem>
                          
                          {/* Other accounts */}
                          {otherSessions.map((s) => (
                            <DropdownMenuItem 
                              key={`${String(s.actor)}-${s.permission}`}
                              className="cursor-pointer group"
                              onClick={() => switchAccount(s)}
                            >
                              <div className="w-4 mr-2" /> {/* Spacer for alignment */}
                              <span>{String(s.actor)}</span>
                              <button
                                className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAccount(s);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </DropdownMenuItem>
                          ))}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleAddAccount} className="cursor-pointer">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Account
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              className="border-primary/50 hover:border-primary hover:bg-primary/10 text-foreground"
              onClick={login}
              disabled={isLoading}
            >
              <Wallet className="mr-2 h-4 w-4 text-primary" />
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-primary/10"
            onClick={() => setIsOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 text-primary" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
