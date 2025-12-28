import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sprout, Plus } from "lucide-react";
import { FarmCard } from "./FarmCard";
import { fetchUserFarms } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";

interface MyFarmsProps {
  onCreateFarm: () => void;
}

export function MyFarms({ onCreateFarm }: MyFarmsProps) {
  const { accountName, isConnected } = useWax();

  const { data: farms = [], isLoading } = useQuery({
    queryKey: ["myV2farms", accountName],
    queryFn: () => fetchUserFarms(accountName!),
    enabled: isConnected && !!accountName,
    staleTime: 30000,
  });

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

  if (farms.length === 0) {
    return (
      <div className="text-center py-12">
        <Sprout className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Farms Yet</h3>
        <p className="text-muted-foreground mb-4">
          You haven't created any V2 farms yet.
        </p>
        <Button onClick={onCreateFarm} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Farm
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          You have created {farms.length} farm{farms.length !== 1 ? "s" : ""}.
        </p>
        <Button onClick={onCreateFarm} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Farm
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {farms.map((farm) => (
          <FarmCard key={farm.farm_name} farm={farm} />
        ))}
      </div>
    </div>
  );
}
