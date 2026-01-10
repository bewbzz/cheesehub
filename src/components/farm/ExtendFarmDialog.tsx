import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, CalendarPlus } from "lucide-react";
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
import { buildExtendFarmAction, FarmInfo } from "@/lib/farm";

interface ExtendFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function ExtendFarmDialog({ farm, onSuccess }: ExtendFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  const currentExpiration = new Date(farm.expiration * 1000);

  const handleExtendFarm = async () => {
    if (!date) {
      toast({ 
        title: "Date required", 
        description: "Please select a new expiration date",
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

    const newExpirationTimestamp = Math.floor(date.getTime() / 1000);

    if (newExpirationTimestamp <= farm.expiration) {
      toast({ 
        title: "Invalid date", 
        description: "New expiration must be after the current expiration date",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const action = buildExtendFarmAction(
        farm.creator,
        farm.farm_name,
        newExpirationTimestamp
      );

      await session.transact({ actions: [action] });

      toast({ 
        title: "Farm Extended!", 
        description: `${farm.farm_name} now expires on ${format(date, "PPP")}` 
      });
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error extending farm:", error);
      toast({
        title: "Failed to extend farm",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimum date is the day after current expiration
  const minDate = new Date(farm.expiration * 1000);
  minDate.setDate(minDate.getDate() + 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
          <CalendarPlus className="h-3 w-3 mr-1" />
          Extend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend Farm</DialogTitle>
          <DialogDescription>
            Extend the expiration date for your farm to keep it active longer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-sm text-muted-foreground">Current Expiration</p>
            <p className="font-medium">{format(currentExpiration, "PPP")}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Expiration Date</label>
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
              The new date must be after the current expiration.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExtendFarm} 
            disabled={isSubmitting || !date}
          >
            {isSubmitting ? "Extending..." : "Extend Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
