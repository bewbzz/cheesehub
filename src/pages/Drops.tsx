import { Layout } from "@/components/Layout";
import { DropsHero } from "@/components/drops/DropsHero";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { CreateDrop } from "@/components/drops/CreateDrop";
import { MyDrops } from "@/components/drops/MyDrops";
import { NFTTools } from "@/components/drops/NFTTools";
import { VirtualizedDropGrid, SimpleDropGrid } from "@/components/drops/VirtualizedDropGrid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCheeseDropStats } from "@/services/atomicApi";
import { useDropsLoader } from "@/hooks/useDropsLoader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { NFTDrop } from "@/types/drop";
import { Package, Plus, Grid, Sandwich, RefreshCw, Search, X, Wrench } from "lucide-react";
import { CHEESE_CONFIG } from "@/lib/waxConfig";
import { useMemo, useState } from "react";

const Drops = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Optimized drops loader with caching, batching, and progress
  const { drops, isLoading, isRefreshing, error, progress, refresh } = useDropsLoader();

  // Fetch CHEESE drop stats from on-chain (includes historical)
  const { data: cheeseStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['cheese-drop-stats'],
    queryFn: fetchCheeseDropStats,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const displayDrops: NFTDrop[] = drops || [];

  // Filter CHEESE drops from the already-fetched drops data (no extra API call)
  const cheeseDrops = useMemo(() => {
    return displayDrops.filter(drop => drop.collectionName === CHEESE_CONFIG.collectionName);
  }, [displayDrops]);

  // Filtered and sorted drops for browse tab
  const filteredDrops = useMemo(() => {
    let result = displayDrops;

    // Filter active drops (not sold out, not ended)
    if (showActiveOnly) {
      const now = Date.now();
      result = result.filter(drop => {
        const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
        const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
        return !isSoldOut && !isEnded;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(drop =>
        drop.collectionName.toLowerCase().includes(query) ||
        drop.name.toLowerCase().includes(query) ||
        drop.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortOption) {
      case "price-low":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "newest":
        result = [...result].sort((a, b) => Number(b.id) - Number(a.id));
        break;
      case "popular":
        result = [...result].sort((a, b) => 
          (b.totalSupply - b.remaining) - (a.totalSupply - a.remaining)
        );
        break;
    }

    return result;
  }, [displayDrops, searchQuery, sortOption, showActiveOnly]);

  const handleRefresh = async () => {
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['cheese-drop-stats'] }),
    ]);
  };

  return (
    <Layout>
      <DropsHero stats={cheeseStats} isLoading={isLoadingStats} />

      <main className="container pb-20">
        <Tabs defaultValue="cheese" className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <TabsList className="grid w-full max-w-2xl grid-cols-5">
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <Grid className="h-4 w-4" />
                <span className="hidden sm:inline">Browse</span>
              </TabsTrigger>
              <TabsTrigger value="cheese" className="flex items-center gap-2">
                <Sandwich className="h-4 w-4" />
                <span className="hidden sm:inline">CHEESE</span>
              </TabsTrigger>
              <TabsTrigger value="my-drops" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">My Drops</span>
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="shrink-0"
              title="Refresh drops"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <TabsContent value="browse">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="font-display text-3xl font-bold text-foreground">
                  All Drops
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Sort by:</span>
                  <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="rounded-lg border border-border/50 bg-card px-3 py-1.5 text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="popular">Most Popular</option>
                  </select>
                </div>
              </div>

              {/* Search and filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by collection, name, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 bg-card border-border/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="active-only"
                      checked={showActiveOnly}
                      onCheckedChange={setShowActiveOnly}
                    />
                    <Label htmlFor="active-only" className="text-sm text-muted-foreground cursor-pointer">
                      Active only
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {filteredDrops.length} drops
                  </span>
                </div>
              </div>
            </div>

          {isLoading && progress.total === 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex justify-between">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isLoading && progress.total > 0 ? (
              <div className="py-12">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Loading drops... {progress.loaded} of {progress.total} templates</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Failed to load drops. Please try again later.</p>
              </div>
            ) : filteredDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">
                  {searchQuery ? `No drops found matching "${searchQuery}"` : "No active drops found."}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : filteredDrops.length > 20 ? (
              <VirtualizedDropGrid drops={filteredDrops} />
            ) : (
              <SimpleDropGrid drops={filteredDrops} />
            )}
          </TabsContent>

          <TabsContent value="my-drops">
            <MyDrops />
          </TabsContent>

          <TabsContent value="cheese">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">
                $CHEESE Drops
              </h2>
              <p className="text-muted-foreground mt-2">Drops purchasable with $CHEESE token</p>
            </div>

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : cheeseDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No active $CHEESE drops found.</p>
              </div>
            ) : (
              <SimpleDropGrid drops={cheeseDrops} />
            )}
          </TabsContent>

          <TabsContent value="create">
            <CreateDrop />
          </TabsContent>

          <TabsContent value="tools">
            <NFTTools />
          </TabsContent>
        </Tabs>
      </main>

      <div className="container pb-12 text-center text-sm text-muted-foreground">
        <p>
          Powered by the{" "}
          <a 
            href="https://wax.bloks.io/account/nfthivedrop?loadContract=true&tab=Tables&account=nfthivedrop&scope=nfthivedrop&limit=100" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cheese hover:underline"
          >
            NFTHIVEDROP
          </a>{" "}
          smart contract.
        </p>
      </div>

      <CartDrawer />
    </Layout>
  );
};

export default Drops;
