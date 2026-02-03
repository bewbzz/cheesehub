import { useState } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useWax } from "@/context/WaxContext";
import { buildCloseFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

interface CloseFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function CloseFarmDialog({ farm, onSuccess }: CloseFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  // Calculate remaining reward balances
  const remainingRewards = farm.reward_pools.filter(pool => {
    const balance = parseFloat(pool.balance) || 0;
    return balance > 0;
  });

  const handleCloseFarm = async () => {
    if (!session) {
      toast({ 
        title: "Wallet not connected", 
        description: "Please connect your wallet first",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const action = buildCloseFarmAction(farm.creator, farm.farm_name);
      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

      toast({ 
        title: "Farm Closed!", 
        description: `${farm.farm_name} has been permanently closed.` 
      });
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error closing farm:", error);
      toast({
        title: "Failed to close farm",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Close
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Close Farm
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently close this farm?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">This action cannot be undone.</p>
              <p className="mt-1 text-sm">
                Closing the farm will permanently shut it down. Any remaining rewards
                in the pool will be returned to you.
              </p>
            </AlertDescription>
          </Alert>

          {remainingRewards.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm font-medium mb-2">Remaining Reward Balances</p>
              <p className="text-xs text-muted-foreground mb-2">
                These tokens will be returned to your wallet:
              </p>
              <ul className="space-y-1">
                {remainingRewards.map((pool) => (
                  <li key={`${pool.contract}-${pool.symbol}`} className="text-sm flex justify-between">
                    <span className="text-muted-foreground">{pool.symbol}</span>
                    <span className="font-medium">
                      {parseFloat(pool.balance).toFixed(pool.precision || 4)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {remainingRewards.length === 0 && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground">
                No remaining rewards in the pool.
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCloseFarm}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? "Closing..." : "Close Farm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
