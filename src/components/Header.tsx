import { Link, useLocation } from "react-router-dom";
import { WalletConnect } from "./WalletConnect";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";

export function Header() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
      {/* Row 1: Logo + Primary Nav + Wallet/Cart */}
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={cheeseLogo} alt="Cheese Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {/* Home */}
            <Link
              to="/"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">🏠</span>
              Home
            </Link>
            {/* CHEESEUp */}
            <Link
              to="/powerup"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/powerup"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">⚡</span>
              CHEESEUp
            </Link>
            {/* CHEESENull */}
            <Link
              to="/cheesenull"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/cheesenull"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">⛔</span>
              CHEESENull
            </Link>
            {/* CHEESEFarm */}
            <Link
              to="/farm"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/farm"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">🌱</span>
              CHEESEFarm
            </Link>
            {/* CHEESEDao */}
            <Link
              to="/dao"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/dao"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="text-base leading-none">🏛️</span>
              CHEESEDao
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnect />
          {location.pathname === "/drops" && (
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-primary/10"
              onClick={() => setIsOpen(true)}
            >
              <span className="text-lg leading-none">🛒</span>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Secondary Nav */}
      <div className="container hidden md:flex h-10 items-center justify-center border-t border-border/30">
        <nav className="flex items-center gap-1">
          {/* CHEESEShip */}
          <Link
            to="/drops"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/drops"
                ? "bg-cheese/20 text-cheese"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="text-base leading-none">🛒</span>
            CHEESEShip
          </Link>
          {/* CHEESELock */}
          <Link
            to="/locker"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/locker"
                ? "bg-cheese/20 text-cheese"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="text-base leading-none">🔐</span>
            CHEESELock
          </Link>
          {/* CHEESEDrip */}
          <Link
            to="/drip"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/drip"
                ? "bg-cheese/20 text-cheese"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="text-base leading-none">💧</span>
            CHEESEDrip
          </Link>
          {/* SimpleAssets */}
          <Link
            to="/simpleassets"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/simpleassets"
                ? "bg-cheese/20 text-cheese"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="text-base leading-none">🖼️</span>
            SimpleAssets
          </Link>
        </nav>
      </div>
    </header>
  );
}
