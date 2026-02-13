import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { NullStats } from '@/components/cheesenull/NullStats';
import { NullButton } from '@/components/cheesenull/NullButton';
import { NullTotalStats } from '@/components/cheesenull/NullTotalStats';
import { Flame } from 'lucide-react';

export default function CheeseNull() {
  const [canClaim, setCanClaim] = useState(false);

  return (
    <Layout>
      <section className="container py-12 md:py-20">
        <div className="flex flex-col items-center gap-8">
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
              Claim vote rewards, burn CHEESE, and compound WAX — all in one click. Anyone can call it once every 24 hours.
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
