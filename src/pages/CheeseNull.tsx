import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { NullStats } from '@/components/cheesenull/NullStats';
import { NullButton } from '@/components/cheesenull/NullButton';
import { NullTotalStats } from '@/components/cheesenull/NullTotalStats';
import { NullerLeaderboard } from '@/components/cheesenull/NullerLeaderboard';
import { useNullerLeaderboard } from '@/hooks/useNullerLeaderboard';
import cheeseNullLogo from '@/assets/cheesenull.png';

export default function CheeseNull() {
  const [canClaim, setCanClaim] = useState(false);
  const { rawActions, isLoading: lbLoading, isError: lbError, refetch: refetchLeaderboard } = useNullerLeaderboard();

  const handleBurnSuccess = () => {
    refetchLeaderboard();
  };

  return (
    <Layout floatingLogo={cheeseNullLogo}>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          {/* Floating Cheese Orb */}
          <div className="h-32 w-32 animate-float cheese-glow rounded-full flex items-center justify-center">
            <img src={cheeseNullLogo} alt="CHEESE Null" className="w-24 h-24 object-contain" />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">⛔</span>
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Null</span>
              </h1>
              <span className="text-2xl">⛔</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Earn $CHEESE by nulling $CHEESE. Pressing the NULL button when active rewards the caller with $CHEESE by triggering the smart contract to buy $CHEESE and split it as per the table
            </p>
          </div>

          {/* Stats */}
          <NullStats onCanClaimChange={setCanClaim} />

          {/* Button */}
          <NullButton disabled={!canClaim} onBurnSuccess={handleBurnSuccess} />

          {/* Total Stats */}
          <NullTotalStats />

          {/* Leaderboard */}
          <NullerLeaderboard rawActions={rawActions} isLoading={lbLoading} isError={lbError} />

          {/* Powered by */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Powered by the{" "}
              <a 
                href="https://waxblock.io/account/cheeseburner" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-cheese hover:text-cheese-dark underline transition-colors"
              >
                CHEESEBURNER
              </a>{" "}
              smart contract.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
