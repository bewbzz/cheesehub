import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Rocket } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useWax } from "@/context/WaxContext";
import { buildOpenFarmAction, FarmInfo } from "@/lib/farm";

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

  const handleOpenFarm = async () => {
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

    const expirationTimestamp = Math.floor(date.getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    if (expirationTimestamp <= now) {
      toast({ 
        title: "Invalid date", 
        description: "Expiration date must be in the future",
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

      await session.transact({ actions: [action] });

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

  // Minimum date is tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

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
            Set an expiration date for your farm. Once opened, users can start staking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Farm Expiration Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
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
            <p className="text-xs text-muted-foreground">
              Choose when your farm will expire. Must be in the future.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleOpenFarm} 
            disabled={isSubmitting || !date}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Opening..." : "Open Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
