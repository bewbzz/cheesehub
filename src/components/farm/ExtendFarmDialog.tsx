import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, CalendarPlus, AlertTriangle } from "lucide-react";
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
import { buildExtendFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

interface ExtendFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

interface RewardShortfall {
  symbol: string;
  required: number;
  balance: number;
  shortfall: number;
}

export function ExtendFarmDialog({ farm, onSuccess }: ExtendFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  const currentExpiration = new Date(farm.expiration * 1000);

  // Calculate reward shortfalls based on selected extension date
  const rewardShortfalls = useMemo((): RewardShortfall[] => {
    if (!date) return [];
    
    const newExpirationTimestamp = Math.floor(date.getTime() / 1000);
    const currentExpirationTimestamp = farm.expiration;
    
    // Calculate additional hours from current expiration to new expiration
    const additionalHours = Math.max(0, (newExpirationTimestamp - currentExpirationTimestamp) / 3600);
    
    if (additionalHours <= 0) return [];
    
    const shortfalls: RewardShortfall[] = [];
    
    for (const pool of farm.reward_pools) {
      // Parse hourly reward rate
      const hourlyRewardStr = pool.total_hourly_reward || "0";
      const hourlyReward = parseFloat(hourlyRewardStr) || 0;
      
      if (hourlyReward <= 0) continue;
      
      // Calculate required amount for the extension period
      const requiredAmount = hourlyReward * additionalHours;
      
      // Parse current balance
      const currentBalance = parseFloat(pool.balance) || 0;
      
      // Check if there's a shortfall
      if (currentBalance < requiredAmount) {
        shortfalls.push({
          symbol: pool.symbol,
          required: requiredAmount,
          balance: currentBalance,
          shortfall: requiredAmount - currentBalance,
        });
      }
    }
    
    return shortfalls;
  }, [date, farm.expiration, farm.reward_pools]);

  const hasShortfall = rewardShortfalls.length > 0;

  const handleExtendFarm = async () => {
    if (!date) {
      toast({ 
        title: "Date required", 
        description: "Please select a new expiration date",
        variant: "destructive" 
      });
      return;
    }

    if (hasShortfall) {
      toast({ 
        title: "Insufficient rewards", 
        description: "Please deposit more rewards before extending the farm",
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
    const now = Math.floor(Date.now() / 1000);

    // Must be in the future and after current expiration (if set)
    if (newExpirationTimestamp <= now) {
      toast({ 
        title: "Invalid date", 
        description: "Expiration date must be in the future",
        variant: "destructive" 
      });
      return;
    }

    if (farm.expiration > 0 && newExpirationTimestamp <= farm.expiration) {
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

      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

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

  // Minimum date is tomorrow or the day after current expiration (whichever is later)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const afterExpiration = new Date(farm.expiration * 1000);
  afterExpiration.setDate(afterExpiration.getDate() + 1);
  const minDate = afterExpiration > tomorrow ? afterExpiration : tomorrow;

  // Format shortfall amounts with proper precision
  const formatAmount = (amount: number, symbol: string) => {
    const pool = farm.reward_pools.find(p => p.symbol === symbol);
    const precision = pool?.precision ?? 4;
    return amount.toFixed(precision);
  };

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

          {/* Reward shortfall warning */}
          {hasShortfall && date && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">
                  Before extending the farm to {format(date, "PPP")}, the following rewards need to be deposited:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {rewardShortfalls.map((shortfall) => (
                    <li key={shortfall.symbol}>
                      <span className="font-semibold">{formatAmount(shortfall.shortfall, shortfall.symbol)} {shortfall.symbol}</span>
                      <span className="text-muted-foreground"> (need {formatAmount(shortfall.required, shortfall.symbol)}, have {formatAmount(shortfall.balance, shortfall.symbol)})</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm mt-2">
                  Go to Reward Pools and click "Deposit Funds" to add more rewards.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExtendFarm} 
            disabled={isSubmitting || !date || hasShortfall}
          >
            {isSubmitting ? "Extending..." : "Extend Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
