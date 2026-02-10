import { useState } from "react";
import { Coins, AlertTriangle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { buildEmptyFarmAction, FarmInfo } from "@/lib/farm";

interface EmptyFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function EmptyFarmDialog({ farm, onSuccess }: EmptyFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);

  const handleEmpty = async () => {
    if (!session || !accountName) return;

    setIsSubmitting(true);
    try {
      const action = buildEmptyFarmAction(accountName, farm.farm_name);
      const result = await executeTransaction([action], {
        successTitle: "Farm Emptied",
        successDescription: `Remaining reward tokens have been returned to your account`,
      });

      if (result.success) {
        setOpen(false);
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate remaining rewards to display
  const remainingRewards = farm.reward_pools?.filter(pool => {
    const balance = parseFloat(pool.balance) || 0;
    return balance > 0;
  }) || [];

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
          <Coins className="h-4 w-4 mr-1" />
          Empty Farm
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Empty Farm Rewards
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Retrieve remaining reward tokens from this permanently closed farm?</p>
              
              {remainingRewards.length > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                  <p className="text-sm font-medium text-foreground">Remaining balances:</p>
                  <ul className="text-sm space-y-1">
                    {remainingRewards.map((pool, index) => (
                      <li key={index} className="text-foreground">
                        • {parseFloat(pool.balance).toFixed(pool.precision || 4)} {pool.symbol}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm">
                These tokens will be sent to your account.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleEmpty();
            }}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Emptying..." : "Empty Farm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
