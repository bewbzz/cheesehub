import cheeseShoppeOrb from "@/assets/cheeseshoppe.png";
import { playRandomFart } from "@/lib/fartSounds";

interface DropsHeroProps {
  stats?: { activeDrops: number; totalSold: number };
  isLoading?: boolean;
}

export function DropsHero({ stats, isLoading = false }: DropsHeroProps) {
  const activeDrops = stats?.activeDrops || 0;
  const totalSold = stats?.totalSold || 0;

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  };

  return (
    <section className="relative overflow-hidden py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="container relative">
        <div className="flex flex-col items-center gap-8">
          <div className="h-32 w-32 animate-float cheese-bubble rounded-full flex items-center justify-center cursor-pointer" onClick={playRandomFart}>
            <img src={cheeseShoppeOrb} alt="CHEESE" className="w-24 h-24 object-contain" />
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🛒</span>
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span><span className="text-foreground">Shoppe</span>
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese border border-cheese/30 leading-none">BETA</span>
              <span className="text-2xl">🛒</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              All the Wonders of the Rainbow
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="font-display text-4xl font-bold text-primary">
                {isLoading ? '—' : activeDrops}
              </span>
              <span className="text-sm text-muted-foreground">Active Drops</span>
            </div>
            <div className="h-12 w-px bg-border/50" />
            <div className="flex flex-col items-center">
              <span className="font-display text-4xl font-bold text-primary">
                {isLoading ? '—' : formatNumber(totalSold)}
              </span>
              <span className="text-sm text-muted-foreground">Total Drops Sold</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
