import { Layout } from "@/components/Layout";
import { DropsHero } from "@/components/drops/DropsHero";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { CreateDrop } from "@/components/drops/CreateDrop";
import { MyDrops } from "@/components/drops/MyDrops";
import { SimpleDropGrid } from "@/components/drops/VirtualizedDropGrid";
import { DropsPagination } from "@/components/drops/DropsPagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCheeseDropStats } from "@/services/atomicApi";
import { useDropsLoader } from "@/hooks/useDropsLoader";
import { useEnrichDrops, usePrefetchDrops, retryFailedDrops } from "@/hooks/useEnrichDrops";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { NFTDrop } from "@/types/drop";
import { Package, Plus, Grid, Sandwich, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { CHEESE_CONFIG } from "@/lib/waxConfig";
import { useMemo, useState, useEffect } from "react";

const DROPS_PER_PAGE = 50;

const Drops = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return sessionStorage.getItem('cheesehub_drops_search') || "";
    } catch { return ""; }
  });
  const [sortOption, setSortOption] = useState(() => {
    try {
      return sessionStorage.getItem('cheesehub_drops_sort') || "newest";
    } catch { return "newest"; }
  });
  const [showActiveOnly, setShowActiveOnly] = useState(() => {
    try {
      const stored = sessionStorage.getItem('cheesehub_drops_active');
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const stored = sessionStorage.getItem('cheesehub_drops_page');
      const page = stored ? parseInt(stored, 10) : 1;
      return isNaN(page) || page < 1 ? 1 : page;
    } catch { return 1; }
  });

  // Persist filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('cheesehub_drops_search', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('cheesehub_drops_sort', sortOption);
  }, [sortOption]);

  useEffect(() => {
    sessionStorage.setItem('cheesehub_drops_active', String(showActiveOnly));
  }, [showActiveOnly]);

  // Fast loader - just fetches raw drops, no template enrichment
  const { drops, isLoading, isRefreshing, error, refresh } = useDropsLoader();

  // Fetch CHEESE drop stats from on-chain (includes historical)
  const { data: cheeseStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['cheese-drop-stats'],
    queryFn: fetchCheeseDropStats,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const displayDrops: NFTDrop[] = drops || [];

  // Filter CHEESE drops
  const cheeseDrops = useMemo(() => {
    const now = Date.now();
    return displayDrops.filter(drop => {
      if (drop.collectionName !== CHEESE_CONFIG.collectionName) return false;
      const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
      const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
      return !isSoldOut && !isEnded;
    });
  }, [displayDrops]);

  // Filtered and sorted drops for browse tab
  const filteredDrops = useMemo(() => {
    let result = displayDrops.filter(drop => !drop.authRequired);

    if (showActiveOnly) {
      const now = Date.now();
      result = result.filter(drop => {
        const isSoldOut = drop.remaining <= 0 && drop.totalSupply > 0;
        const isEnded = drop.endDate ? new Date(drop.endDate).getTime() < now : false;
        return !isSoldOut && !isEnded;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(drop =>
        drop.collectionName.toLowerCase().includes(query) ||
        drop.name.toLowerCase().includes(query) ||
        drop.description?.toLowerCase().includes(query)
      );
    }

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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDrops.length / DROPS_PER_PAGE));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  
  // Get current page's raw drops
  const paginatedDrops = useMemo(() => {
    const start = (validPage - 1) * DROPS_PER_PAGE;
    return filteredDrops.slice(start, start + DROPS_PER_PAGE);
  }, [filteredDrops, validPage]);

  // Get next page's drops for prefetching
  const nextPageDrops = useMemo(() => {
    if (validPage >= totalPages) return [];
    const start = validPage * DROPS_PER_PAGE;
    return filteredDrops.slice(start, start + DROPS_PER_PAGE);
  }, [filteredDrops, validPage, totalPages]);

  // Enrich only the current page's drops (50 max) - FAST!
  const { enrichedDrops, isEnriching, progress } = useEnrichDrops(paginatedDrops);

  // Prefetch next page in background (low priority)
  usePrefetchDrops(nextPageDrops, !isEnriching && validPage < totalPages);

  // Enrich CHEESE drops separately
  const { enrichedDrops: enrichedCheeseDrops, isEnriching: isEnrichingCheese } = useEnrichDrops(cheeseDrops);

  // Reset page only when filters change (not on mount)
  const isInitialMount = useMemo(() => ({ current: true }), []);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
    sessionStorage.setItem('cheesehub_drops_page', '1');
  }, [searchQuery, sortOption, showActiveOnly]);

  // Persist page and scroll to top
  const handlePageChange = (page: number) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
    sessionStorage.setItem('cheesehub_drops_page', String(newPage));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = async () => {
    // Retry any failed drops (those showing "Retry" button)
    retryFailedDrops();
    
    await Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['cheese-drop-stats'] }),
    ]);
  };

  return (
    <Layout>
      <DropsHero stats={cheeseStats} isLoading={isLoadingStats} />

      <main className="container pb-20">
        <Tabs defaultValue="browse" className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
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
                <h2 className="font-display text-3xl font-bold text-foreground">All Drops</h2>
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
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch id="active-only" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
                    <Label htmlFor="active-only" className="text-sm text-muted-foreground cursor-pointer">Active only</Label>
                  </div>
                  <span className="text-sm text-muted-foreground">{filteredDrops.length} drops</span>
                </div>
              </div>

              {/* Page enrichment progress */}
              {isEnriching && progress.total > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading images... {progress.loaded}/{progress.total}</span>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
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
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <SimpleDropGrid drops={enrichedDrops} />
                <DropsPagination
                  currentPage={validPage}
                  totalPages={totalPages}
                  totalDrops={filteredDrops.length}
                  onPageChange={handlePageChange}
                  isLoading={isEnriching}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="my-drops">
            <MyDrops />
          </TabsContent>

          <TabsContent value="cheese">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">$CHEESE Drops</h2>
              <p className="text-muted-foreground mt-2">Drops purchasable with $CHEESE token</p>
              {isEnrichingCheese && enrichedCheeseDrops.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading images...</span>
                </div>
              )}
            </div>

            {isLoading && cheeseDrops.length === 0 ? (
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
              <SimpleDropGrid drops={enrichedCheeseDrops} />
            )}
          </TabsContent>

          <TabsContent value="create">
            <CreateDrop />
          </TabsContent>
        </Tabs>
      </main>

      <div className="container pb-12 text-center text-sm text-muted-foreground">
        <p>
          Powered by the{" "}
          <a href="https://wax.bloks.io/account/nfthivedrop?loadContract=true&tab=Tables&account=nfthivedrop&scope=nfthivedrop&limit=100" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">
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
