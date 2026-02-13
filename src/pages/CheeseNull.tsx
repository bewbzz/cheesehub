import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { NullStats } from '@/components/cheesenull/NullStats';
import { NullButton } from '@/components/cheesenull/NullButton';
import { NullTotalStats } from '@/components/cheesenull/NullTotalStats';
import { Flame } from 'lucide-react';
import cheeseLogo from '@/assets/cheese-logo.png';

export default function CheeseNull() {
  const [canClaim, setCanClaim] = useState(false);

  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
          {/* Floating Cheese Orb */}
          <div className="h-40 w-40 md:h-48 md:w-48 animate-float cheese-glow rounded-full flex items-center justify-center">
            <img src={cheeseLogo} alt="CHEESE Logo" className="w-32 md:w-40 object-contain" />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Flame className="h-8 w-8 text-cheese" />
              <h1 className="text-3xl md:text-4xl font-bold">
                <span className="text-cheese">CHEESE</span>
                <span className="text-foreground">Null</span>
              </h1>
              <Flame className="h-8 w-8 text-cheese" />
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Earn $CHEESE by nulling $CHEESE. Press the NULL button when active to NULL $CHEESE and receive the $CHEESE amount under the reward heading as a gift
            </p>
          </div>

          {/* Stats */}
          <NullStats onCanClaimChange={setCanClaim} />

          {/* Button */}
          <NullButton disabled={!canClaim} onBurnSuccess={() => {}} />

          {/* Total Stats */}
          <NullTotalStats />
        </div>
      </section>
    </Layout>
  );
}
