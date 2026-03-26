import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useSimpleAssets } from '@/hooks/useSimpleAssets';
import { useGpkPacks } from '@/hooks/useGpkPacks';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

export default function SimpleAssets() {
  const { accountName, isConnected, login } = useWax();
  const { assets, isLoading, error } = useSimpleAssets(accountName);
  const { packs, isLoading: packsLoading } = useGpkPacks(accountName);
  const [search, setSearch] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);

  const authors = useMemo(() => [...new Set(assets.map((a) => a.author))].sort(), [assets]);
  const categories = useMemo(() => [...new Set(assets.map((a) => a.category))].sort(), [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
      if (authorFilter !== 'all' && a.author !== authorFilter) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      return true;
    });
  }, [assets, search, authorFilter, categoryFilter]);

  return (
    <Layout>
      <div className="min-h-screen">
        <div className="container py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">SimpleAssets NFT Viewer</h1>
            <p className="text-muted-foreground mt-1">View your legacy SimpleAssets NFTs stored on-chain.</p>
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
              {/* Filters */}
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
                <Select value={authorFilter} onValueChange={setAuthorFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Author" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Authors</SelectItem>
                    {authors.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Loading */}
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

              {/* Error */}
              {error && (
                <p className="text-center text-destructive py-8">Error: {error}</p>
              )}

              {/* Results */}
              {!isLoading && !error && (
                <>
                  <p className="text-sm text-muted-foreground">{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found</p>
                  {filtered.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">
                      {assets.length === 0 ? 'No SimpleAssets NFTs found in this wallet.' : 'No NFTs match your filters.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {filtered.map((asset) => (
                        <SimpleAssetCard key={asset.id} asset={asset} onClick={() => setSelectedAsset(asset)} />
                      ))}
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
