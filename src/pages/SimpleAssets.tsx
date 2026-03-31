import { useState, useMemo, useRef, useCallback, useEffect, DragEvent } from 'react';
import { Search } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useSimpleAssets } from '@/hooks/useSimpleAssets';
import { useGpkAtomicAssets } from '@/hooks/useGpkAtomicAssets';
import { useGpkPacks } from '@/hooks/useGpkPacks';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const EMPTY = '__empty__';
const EXTRA_EMPTY_SLOTS = 6;

function EmptySlot({ onDragOver, onDrop, isOver }: {
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  isOver: boolean;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={(e) => e.stopPropagation()}
      className={`aspect-square rounded-lg border-2 border-dashed transition-all flex items-center justify-center
        ${isOver ? 'border-primary bg-primary/10 scale-105' : 'border-border/50 bg-muted/10'}`}
    />
  );
}

export default function SimpleAssets() {
  const { accountName, isConnected, login } = useWax();
  const { assets: saAssets, isLoading: saLoading, error: saError } = useSimpleAssets(accountName);
  const { assets: aaAssets, isLoading: aaLoading, error: aaError } = useGpkAtomicAssets(accountName);
  const { packs, isLoading: packsLoading } = useGpkPacks(accountName);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);

  const isLoading = saLoading || aaLoading;
  const error = saError || aaError;

  const assets = useMemo(() => {
    const combined = [...saAssets, ...aaAssets];
    combined.sort((a, b) => {
      const numA = parseInt(a.cardid, 10);
      const numB = parseInt(b.cardid, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
        return a.quality.localeCompare(b.quality);
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return Number(BigInt(a.id) - BigInt(b.id));
    });
    return combined;
  }, [saAssets, aaAssets]);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const dragSourceIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const categories = useMemo(() => [...new Set(assets.map((a) => a.category))].sort(), [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      return true;
    });
  }, [assets, search, categoryFilter, sourceFilter]);

  useEffect(() => {
    setCustomOrder(null);
  }, [search, categoryFilter]);

  const gridSlots = useMemo(() => {
    const base = customOrder ?? filtered.map((a) => a.id);
    const trimmed = [...base];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === EMPTY) trimmed.pop();
    return [...trimmed, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
  }, [customOrder, filtered]);

  const assetMap = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);

  const handleDragStart = useCallback((idx: number) => (_e: DragEvent<HTMLDivElement>) => {
    dragSourceIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((idx: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((targetIdx: number) => (_e: DragEvent<HTMLDivElement>) => {
    const srcIdx = dragSourceIdx.current;
    dragSourceIdx.current = null;
    setDragOverIdx(null);
    if (srcIdx === null || srcIdx === targetIdx) return;

    const currentOrder = customOrder ?? filtered.map((a) => a.id);
    const padded = [...currentOrder];
    const maxIdx = Math.max(srcIdx, targetIdx);
    while (padded.length <= maxIdx) padded.push(EMPTY);

    const newOrder = [...padded];
    const tmp = newOrder[srcIdx];
    newOrder[srcIdx] = newOrder[targetIdx];
    newOrder[targetIdx] = tmp;
    setCustomOrder(newOrder);
  }, [customOrder, filtered]);

  const handleDragEnd = useCallback(() => {
    dragSourceIdx.current = null;
    setDragOverIdx(null);
  }, []);

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="container py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">GPK Topps Collection</h1>
            <p className="text-muted-foreground mt-1">View and organize your Garbage Pail Kids cards. Drag cards to reorder them.</p>
          </div>

          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <p className="text-muted-foreground">Connect your wallet to view your SimpleAssets NFTs.</p>
              <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
                Connect Wallet
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-square w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-center text-destructive py-8">Error: {error}</p>
              )}

              {!packsLoading && packs.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">GPK Topps Packs</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {packs.map((pack) => (
                      <GpkPackCard key={pack.symbol} pack={pack} />
                    ))}
                  </div>
                </div>
              )}

              {!isLoading && !error && (
                <>
                  <p className="text-sm text-muted-foreground">{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found</p>
                  {filtered.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">
                      {assets.length === 0 ? 'No SimpleAssets NFTs found in this wallet.' : 'No NFTs match your filters.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {gridSlots.map((slotId, idx) => {
                        if (slotId === EMPTY) {
                          return (
                            <EmptySlot
                              key={`empty-${idx}`}
                              onDragOver={handleDragOver(idx)}
                              onDrop={handleDrop(idx)}
                              isOver={dragOverIdx === idx}
                            />
                          );
                        }
                        const asset = assetMap.get(slotId);
                        if (!asset) return null;
                        return (
                          <SimpleAssetCard
                            key={asset.id}
                            asset={asset}
                            onClick={() => setSelectedAsset(asset)}
                            draggable
                            onDragStart={handleDragStart(idx)}
                            onDragOver={handleDragOver(idx)}
                            onDrop={handleDrop(idx)}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <SimpleAssetDetailDialog
        asset={selectedAsset}
        open={!!selectedAsset}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
      />
    </Layout>
  );
}
