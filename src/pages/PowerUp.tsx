import { Header } from "@/components/Header";
import { PowerUpCard } from "@/components/powerup/PowerUpCard";
import { PowerupStatsBar } from "@/components/powerup/PowerupStatsBar";
import { BackgroundDecorations } from "@/components/drops/BackgroundDecorations";
import { useWax } from "@/context/WaxContext";
import { usePowerupStats } from "@/hooks/usePowerupStats";
import cheeseLogo from "@/assets/cheese-logo.png";

const PowerUp = () => {
  const { isConnected, accountName, isLoading, session, cheeseBalance, login, logout, refreshBalance } = useWax();
  const { stats, isLoading: statsLoading, refetch: refetchStats } = usePowerupStats();

  const handleConnectWallet = async () => {
    if (isConnected) {
      await logout();
    } else {
      await login();
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <BackgroundDecorations />
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <div className="flex flex-col items-center text-center">
            <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
              <img src={cheeseLogo} alt="CHEESE" className="w-24 h-24 object-contain" />
            </div>

            <h1 className="mt-8 font-display text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-primary cheese-text-glow">CHEESE</span>
              <span className="text-foreground">Up</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Fuel your WAX transactions with CHEESE tokens
            </p>
          </div>
        </div>
      </section>

      <main className="container pb-12 flex flex-col items-center gap-8">

        <PowerUpCard
          walletConnected={isConnected}
          onConnectWallet={handleConnectWallet}
          session={session}
          accountName={accountName}
          cheeseBalance={cheeseBalance}
          onBalanceRefresh={refreshBalance}
          onStatsRefresh={refetchStats}
        />

        <PowerupStatsBar stats={stats} isLoading={statsLoading} />

        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by CHEESE PowerUp Contract on WAX</p>
        </div>
      </main>
    </div>
  );
};

export default PowerUp;
