import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter } from "lucide-react";
import { FarmCard } from "./FarmCard";
import { fetchAllFarms, fetchUserGlobalStakes, FarmInfo } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";

type SortOption = "newest" | "staked" | "name";

export function BrowseFarms() {
  const { accountName, isConnected } = useWax();
  const [searchQuery, setSearchQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showStakedOnly, setShowStakedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // Auto-uncheck staked only when wallet disconnects
  useEffect(() => {
    if (!isConnected) setShowStakedOnly(false);
  }, [isConnected]);

  const { data: stakedFarms } = useQuery({
    queryKey: ["userGlobalStakes", accountName],
    queryFn: () => fetchUserGlobalStakes(accountName!),
    enabled: showStakedOnly && isConnected && !!accountName,
    staleTime: 30000,
  });

  const { data: farms = [], isLoading, error } = useQuery({
    queryKey: ["v2farms"],
    queryFn: fetchAllFarms,
    staleTime: 30000,
    refetchOnMount: true,
  });

  // Debug log
  console.log("Farms query state:", { isLoading, error, farmsCount: farms.length });

  const filteredFarms = useMemo(() => {
    let result = [...farms];

    // Filter by active status
    if (showActiveOnly) {
      result = result.filter(farm => farm.is_active);
    }

    // Filter by staked only
    if (showStakedOnly && stakedFarms && stakedFarms.length > 0) {
      const stakedNames = new Set(stakedFarms.map(s => s.farmName));
      result = result.filter(farm => stakedNames.has(farm.farm_name));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        farm =>
          farm.farm_name.toLowerCase().includes(query) ||
          farm.creator.toLowerCase().includes(query) ||
          farm.reward_pools.some(pool => 
            pool.symbol.toLowerCase().includes(query)
          )
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => b.time_created - a.time_created);
        break;
      case "staked":
        result.sort((a, b) => b.staked_count - a.staked_count);
        break;
      case "name":
        result.sort((a, b) => a.farm_name.localeCompare(b.farm_name));
        break;
    }

    return result;
  }, [farms, searchQuery, showActiveOnly, showStakedOnly, stakedFarms, sortBy]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by farm name, creator, or reward token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="active-only"
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
            />
            <Label htmlFor="active-only" className="text-sm whitespace-nowrap">
              Active only
            </Label>
          </div>

          <div className={`flex items-center gap-2 ${!isConnected ? 'opacity-50' : ''}`}>
            <Checkbox
              id="staked-only"
              checked={showStakedOnly}
              onCheckedChange={(checked) => setShowStakedOnly(checked === true)}
              disabled={!isConnected}
            />
            <Label htmlFor="staked-only" className="text-sm whitespace-nowrap">
              Staked only
            </Label>
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="staked">Most Staked</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {filteredFarms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No farms found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFarms.map((farm) => (
            <FarmCard key={`farm-${farm.id}-${farm.farm_name}`} farm={farm} />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-center text-sm text-muted-foreground">
        {filteredFarms.length === farms.length ? (
          <span>{farms.length} farms</span>
        ) : (
          <span>
            Showing {filteredFarms.length} {showActiveOnly ? "active" : ""} farm{filteredFarms.length !== 1 ? "s" : ""}
            {searchQuery.trim() && ` matching "${searchQuery.trim()}"`}
          </span>
        )}
      </div>
    </div>
  );
}
