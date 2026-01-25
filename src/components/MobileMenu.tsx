import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Home, Lock, ShoppingBag, Users, Zap, Droplets, Sprout, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import cheeseLogo from "@/assets/cheese-logo.png";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/powerup", label: "CHEESEUp", icon: Zap },
  { to: "/locker", label: "CHEESELock", icon: Lock },
  { to: "/drops", label: "CHEESEDrop", icon: ShoppingBag },
  { to: "/dao", label: "CHEESEDao", icon: Users },
  { to: "/farm", label: "CHEESEFarm", icon: Sprout },
];

const externalLinks = [
  { 
    href: "https://cheeseonwax.github.io/tools/cheesefaucet.html", 
    label: "CHEESEFaucet", 
    icon: Droplets 
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <img src={cheeseLogo} alt="Cheese Logo" className="h-6 w-6" />
              <span>
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Hub</span>
              </span>
            </SheetTitle>
            <SheetDescription className="sr-only">
              Navigation menu
            </SheetDescription>
          </SheetHeader>

          <nav className="flex flex-col p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-cheese/20 text-cheese"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}

            <div className="my-2 border-t border-border" />

            {externalLinks.map((item) => {
              const Icon = item.icon;
              
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  <span className="ml-auto text-xs text-muted-foreground">↗</span>
                </a>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
