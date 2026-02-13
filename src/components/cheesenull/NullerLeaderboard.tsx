import { useState, useMemo } from 'react';
import { Flame, Zap, Gift, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { sortNullers, type NullerStats, type SortMode, type LogburnAction, aggregateNullerStats } from '@/lib/fetchLeaderboard';
import { formatCheeseAmount } from '@/lib/cheeseNullApi';

interface NullerLeaderboardProps {
  rawActions: LogburnAction[];
  isLoading: boolean;
  isError: boolean;
}

const SORT_OPTIONS: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'cheese', label: 'CHEESE Nulled', icon: <Flame className="w-3.5 h-3.5" /> },
  { mode: 'burns', label: 'Burns', icon: <Zap className="w-3.5 h-3.5" /> },
  { mode: 'rewards', label: 'Rewards', icon: <Gift className="w-3.5 h-3.5" /> },
];

export function NullerLeaderboard({ rawActions, isLoading, isError }: NullerLeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortMode>('cheese');

  const leaderboard = useMemo(() => {
    if (!rawActions.length) return [];
    // Aggregate all stats then sort by selected mode
    const allStats = aggregateNullerStats(rawActions, sortBy);
    return allStats;
  }, [rawActions, sortBy]);

  const getPrimaryValue = (entry: NullerStats) => {
    switch (sortBy) {
      case 'burns': return entry.burns.toLocaleString();
      case 'rewards': return formatCheeseAmount(entry.rewardsEarned);
      default: return formatCheeseAmount(entry.cheeseNulled);
    }
  };

  const getPrimaryUnit = () => {
    switch (sortBy) {
      case 'burns': return 'burns';
      case 'rewards': return 'CHEESE';
      default: return 'CHEESE';
    }
  };

  const getSecondaryText = (entry: NullerStats) => {
    switch (sortBy) {
      case 'burns': return `${formatCheeseAmount(entry.cheeseNulled)} nulled`;
      case 'rewards': return `${entry.burns} burns`;
      default: return `${entry.burns} burns`;
    }
  };

  return (
    <Card className="w-full max-w-md bg-card/60 backdrop-blur border-cheese/10">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-cheese" />
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              CHEESEBoard
            </h3>
            <Trophy className="w-4 h-4 text-cheese" />
          </div>
        </div>

        {/* Sort Buttons */}
        <div className="flex gap-2 justify-center">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setSortBy(opt.mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                sortBy === opt.mode
                  ? 'bg-cheese/20 text-cheese border border-cheese/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-destructive">Error loading leaderboard</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No data yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-cheese/10 hover:bg-transparent">
                <TableHead className="h-8 text-xs text-muted-foreground w-10">#</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground">Account</TableHead>
                <TableHead className="h-8 text-xs text-muted-foreground text-right">
                  {sortBy === 'burns' ? 'Burns' : sortBy === 'rewards' ? 'Rewards' : 'Nulled'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry) => (
                <TableRow key={entry.account} className="border-cheese/5 hover:bg-cheese/5">
                  <TableCell className="py-2 text-sm font-bold text-cheese">
                    {entry.rank}
                  </TableCell>
                  <TableCell className="py-2">
                    <div>
                      <a
                        href={`https://waxblock.io/account/${entry.account}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-cheese transition-colors"
                      >
                        {entry.account}
                      </a>
                      <p className="text-[10px] text-muted-foreground">{getSecondaryText(entry)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <span className="text-sm font-bold text-cheese">{getPrimaryValue(entry)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">{getPrimaryUnit()}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
