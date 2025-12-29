import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sprout, Plus, Pickaxe } from "lucide-react";
import { FarmCard } from "./FarmCard";
import { fetchUserFarms, fetchUserStakedFarms } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";

interface MyFarmsProps {
  onCreateFarm: () => void;
}

export function MyFarms({ onCreateFarm }: MyFarmsProps) {
  const { accountName, isConnected } = useWax();

  // Query for farms user created
  const { data: createdFarms = [], isLoading: isLoadingCreated } = useQuery({
    queryKey: ["myV2farms", accountName],
    queryFn: () => fetchUserFarms(accountName!),
    enabled: isConnected && !!accountName,
    staleTime: 30000,
  });

  // Query for farms user is staked in
  const { data: stakedFarms = [], isLoading: isLoadingStaked } = useQuery({
    queryKey: ["myStakedFarms", accountName],
    queryFn: () => fetchUserStakedFarms(accountName!),
    enabled: isConnected && !!accountName,
    staleTime: 30000,
  });

  const isLoading = isLoadingCreated || isLoadingStaked;

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
        <p className="text-muted-foreground mb-4">
          Connect your wallet to view your farms.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const hasStakedFarms = stakedFarms.length > 0;
  const hasCreatedFarms = createdFarms.length > 0;

  if (!hasStakedFarms && !hasCreatedFarms) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Farms Yet</h3>
        <p className="text-muted-foreground mb-4">
          You haven't created any farms or staked in any farms yet.
        </p>
        <Button onClick={onCreateFarm} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Farm
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Farms I'm Staked In */}
      {hasStakedFarms && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Pickaxe className="h-5 w-5 text-cheese" />
            <h3 className="text-lg font-semibold">
              Farms I'm Staked In ({stakedFarms.length})
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stakedFarms.map((farm) => (
              <FarmCard key={farm.farm_name} farm={farm} />
            ))}
          </div>
        </div>
      )}

      {/* Farms I Created */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              Farms I Created ({createdFarms.length})
            </h3>
          </div>
          <Button onClick={onCreateFarm} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Farm
          </Button>
        </div>
        
        {hasCreatedFarms ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {createdFarms.map((farm) => (
              <FarmCard key={farm.farm_name} farm={farm} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">
              You haven't created any farms yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
