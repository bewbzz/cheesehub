import { Header } from "@/components/Header";
import { PowerUpCard } from "@/components/powerup/PowerUpCard";
import { PowerupStatsBar } from "@/components/powerup/PowerupStatsBar";
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
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Header />

      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 pt-8 pb-8 gap-8">
        <div className="relative text-center space-y-4 mb-4">
          <img
            src={cheeseLogo}
            alt="CHEESE Coin"
            className="absolute left-1/2 bottom-full -translate-x-1/2 translate-y-1/2 w-48 md:w-64 opacity-20 pointer-events-none"
          />
          <h1 className="relative text-5xl md:text-7xl font-extrabold">
            <span className="text-cheese-gradient bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">CHEESE</span>
            <span className="text-foreground">Up</span>
          </h1>
          <p className="relative text-muted-foreground max-w-md mx-auto mt-4">
            Fuel your WAX transactions with CHEESE.
          </p>
        </div>

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

        <footer className="text-center text-xs text-muted-foreground mt-8">
          <p>Powered by CHEESE PowerUp Contract on WAX</p>
        </footer>
      </main>
    </div>
  );
};

export default PowerUp;
