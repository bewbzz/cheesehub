import { useState } from "react";
import { format } from "date-fns";
import { Clock, Rocket, AlertTriangle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useWax } from "@/context/WaxContext";
import { buildOpenFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

interface OpenFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function OpenFarmDialog({ farm, onSuccess }: OpenFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  // Check if ALL configured reward pools have deposits
  const poolsWithoutRewards = farm.reward_pools.filter(pool => {
    const balance = parseFloat(pool.balance) || 0;
    return balance <= 0;
  });
  const hasAllRewards = farm.reward_pools.length > 0 && poolsWithoutRewards.length === 0;

  // Minimum date is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow;

  const expirationTimestamp = date 
    ? Math.floor(date.getTime() / 1000) 
    : 0;

  const handleOpenFarm = async () => {
    if (!hasAllRewards) {
      toast({ 
        title: "No rewards deposited", 
        description: "You must deposit rewards before opening the farm",
        variant: "destructive" 
      });
      return;
    }

    if (!date) {
      toast({ 
        title: "Date required", 
        description: "Please select an expiration date",
        variant: "destructive" 
      });
      return;
    }

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
      const action = buildOpenFarmAction(
        farm.creator,
        farm.farm_name,
        expirationTimestamp
      );

      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

      toast({ 
        title: "Farm Opened!", 
        description: `${farm.farm_name} is now live until ${format(date, "PPP")}` 
      });
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error opening farm:", error);
      toast({
        title: "Failed to open farm",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          <Rocket className="h-4 w-4 mr-1" />
          Open Farm
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Farm</DialogTitle>
          <DialogDescription>
            Select when the farm will expire. Once opened, users can start staking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasAllRewards && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                All reward pools must have deposits before opening. Missing: {poolsWithoutRewards.map(p => p.symbol).join(", ")}. Go to Reward Pools and click "Deposit Funds".
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  disabled={!hasAllRewards}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < minDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {date && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Farm expires:</span>
              </div>
              <p className="font-medium mt-1">
                {format(date, "PPP 'at' p")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleOpenFarm} 
            disabled={isSubmitting || !date || !hasAllRewards}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Opening..." : "Open Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
