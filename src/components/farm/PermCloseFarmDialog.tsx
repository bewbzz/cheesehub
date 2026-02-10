import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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
import { buildPermCloseFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

interface PermCloseFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function PermCloseFarmDialog({ farm, onSuccess }: PermCloseFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  const handlePermCloseFarm = async () => {
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
      const action = buildPermCloseFarmAction(farm.creator, farm.farm_name);
      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

      toast({ 
        title: "Farm Permanently Closed!", 
        description: `${farm.farm_name} has been permanently removed.` 
      });
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error permanently closing farm:", error);
      toast({
        title: "Failed to permanently close farm",
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
          <Trash2 className="h-3 w-3 mr-1" />
          Perm Close
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Permanently Close Farm
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete this farm?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">DANGER: Cannot be undone!</p>
              <p className="mt-1 text-sm">
                This will permanently close the farm. You will no longer have the option to re-open or extend the farm. First you will need to kick any remaining users and then you will be able to withdraw any unused reward tokens.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePermCloseFarm}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting ? "Closing..." : "Permanently Close"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
