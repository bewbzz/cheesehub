import cheeseLogo from "@/assets/cheese-logo.png";

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
        <div className="flex flex-col items-center text-center">
          <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
            <img src={cheeseLogo} alt="CHEESE" className="w-24 h-24 object-contain" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold">
            <span className="text-cheese">CHEESE</span><span className="text-foreground">Drop</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Exchange your <img src={cheeseLogo} alt="CHEESE" className="inline-block w-6 h-6 mx-1" /><span className="font-semibold text-primary">CHEESE</span> for Physical Items & NFTs
          </p>

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
