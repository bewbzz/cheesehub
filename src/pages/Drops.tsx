import { Header } from "@/components/Header";
import { DropsHero } from "@/components/drops/DropsHero";
import { DropCard } from "@/components/drops/DropCard";
import { CartDrawer } from "@/components/drops/CartDrawer";
import { BackgroundDecorations } from "@/components/drops/BackgroundDecorations";
import { CreateDrop } from "@/components/drops/CreateDrop";
import { MyDrops } from "@/components/drops/MyDrops";
import { useQuery } from "@tanstack/react-query";
import { fetchAllDrops } from "@/services/atomicApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NFTDrop } from "@/types/drop";
import { Package, Plus, Grid, Sandwich } from "lucide-react";

const Drops = () => {
  const { data: drops, isLoading, error } = useQuery({
    queryKey: ['drops'],
    queryFn: fetchAllDrops,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  const displayDrops: NFTDrop[] = drops || [];
  const cheeseDrops: NFTDrop[] = displayDrops.filter(drop => drop.collectionName === 'cheesenftwax');

  return (
    <div className="min-h-screen bg-background grid-pattern relative">
      <BackgroundDecorations />
      <Header />
      <DropsHero drops={displayDrops} isLoading={isLoading} />

      <main className="container pb-20">
        <Tabs defaultValue="cheese" className="w-full">
          <TabsList className="mb-8 grid w-full max-w-lg grid-cols-4 mx-auto">
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

          <TabsContent value="my-drops">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="font-display text-3xl font-bold text-foreground">
                Active Drops
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Sort by:</span>
                <select className="rounded-lg border border-border/50 bg-card px-3 py-1.5 text-foreground focus:border-primary focus:outline-none">
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                  <option>Newest</option>
                  <option>Most Popular</option>
                </select>
              </div>
            </div>

            {isLoading ? (
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
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">Failed to load drops. Please try again later.</p>
              </div>
            ) : displayDrops.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No active drops found.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayDrops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="browse">
            <MyDrops />
          </TabsContent>

          <TabsContent value="cheese">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-bold text-foreground">
                $CHEESE Drops
              </h2>
              <p className="text-muted-foreground mt-2">Official drops from the cheesenftwax collection</p>
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cheeseDrops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
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
    </div>
  );
};

export default Drops;
