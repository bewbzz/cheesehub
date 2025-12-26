import { useCheeseStats } from '@/hooks/useCheeseStats';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Coins, Lock, Shield, ExternalLink } from 'lucide-react';
import { CHEESE_CONFIG } from '@/lib/waxConfig';

// Format large numbers with abbreviations
function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

// Format with full number for tooltip
function formatFullNumber(num: number): string {
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function TokenStatsBanner() {
  const { data: stats, isLoading, isError } = useCheeseStats();

  return (
    <section className="container py-8">
      <Card className="bg-gradient-to-r from-cheese/5 via-background to-cheese/5 border-cheese/30 backdrop-blur-sm overflow-hidden relative">
        {/* Subtle animated glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cheese/5 to-transparent animate-pulse" />
        
        <div className="relative p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total and Max Supply */}
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <Coins className="h-6 w-6 text-cheese" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total and Max Supply</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <p 
                    className="text-xl font-bold text-foreground" 
                    title={`${formatFullNumber(stats?.maxSupply ?? 0)} CHEESE`}
                  >
                    {formatLargeNumber(stats?.maxSupply ?? 0)} <span className="text-cheese">CHEESE</span>
                  </p>
                )}
              </div>
            </div>

            {/* Locked Supply */}
            <div className="flex items-center gap-4 justify-center">
              <div className="h-12 w-12 rounded-full bg-cheese/20 flex items-center justify-center shrink-0">
                <Lock className="h-6 w-6 text-cheese" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Locked Supply</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-28 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <p 
                    className="text-xl font-bold text-foreground"
                    title={`${formatFullNumber(stats?.lockedSupply ?? 0)} CHEESE`}
                  >
                    {formatLargeNumber(stats?.lockedSupply ?? 0)} <span className="text-cheese">CHEESE</span>
                  </p>
                )}
              </div>
            </div>

            {/* Contract Status */}
            <div className="flex items-center gap-4 justify-center md:justify-end">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Contract Status</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24 mt-1" />
                ) : isError ? (
                  <p className="text-lg font-bold text-destructive">Error</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={stats?.isNulled 
                          ? "border-green-500/50 bg-green-500/10 text-green-500 font-semibold" 
                          : "border-yellow-500/50 bg-yellow-500/10 text-yellow-500 font-semibold"
                        }
                      >
                        🔒 {stats?.status}
                      </Badge>
                      {stats?.isNulled && (
                        <span className="text-xs text-muted-foreground">(Nulled Keys)</span>
                      )}
                    </div>
                    {stats?.isNulled && (
                      <a
                        href="https://waxblock.io/account/cheeseburger#keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cheese/70 hover:text-cheese underline transition-colors"
                      >
                        proof
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contract link */}
          <div className="mt-4 pt-4 border-t border-border/50 flex justify-center">
            <a
              href={`https://waxblock.io/account/${CHEESE_CONFIG.tokenContract}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-cheese transition-colors flex items-center gap-1"
            >
              View {CHEESE_CONFIG.tokenContract} contract on WaxBlock
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </section>
  );
}
