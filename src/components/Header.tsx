import { Link, useLocation } from "react-router-dom";
import { WalletConnect } from "./WalletConnect";
import { Lock, Home, ShoppingBag, ShoppingCart, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";

export function Header() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/locker", label: "CHEESELock", icon: Lock },
    { path: "/drops", label: "CHEESEDrops", icon: ShoppingBag },
  ];

  const externalLinks = [
    { url: "https://cheeseonwax.github.io/tools/cheesefaucet.html", label: "CHEESEFaucet", icon: Droplets },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={cheeseLogo} alt="Cheese Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "bg-cheese/20 text-cheese"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            {externalLinks.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnect />
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
