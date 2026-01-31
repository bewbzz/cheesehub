import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Clock, CalendarPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useWax } from "@/context/WaxContext";
import { buildExtendFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

const DURATION_OPTIONS = [
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 24 * 7 },
  { value: "30d", label: "30 days", hours: 24 * 30 },
  { value: "90d", label: "90 days", hours: 24 * 90 },
  { value: "180d", label: "180 days", hours: 24 * 180 },
  { value: "360d", label: "360 days", hours: 24 * 360 },
];

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
  const [selectedDuration, setSelectedDuration] = useState("7d");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  const currentExpiration = new Date(farm.expiration * 1000);

  // Calculate expiration date from selected duration (from NOW)
  const expirationDate = useMemo(() => {
    const option = DURATION_OPTIONS.find(o => o.value === selectedDuration);
    if (!option) return null;
    const date = new Date();
    date.setHours(date.getHours() + option.hours);
    return date;
  }, [selectedDuration]);

  const expirationTimestamp = expirationDate 
    ? Math.floor(expirationDate.getTime() / 1000) 
    : 0;

  // Calculate reward shortfalls based on selected extension date
  const rewardShortfalls = useMemo((): RewardShortfall[] => {
    if (!expirationDate) return [];
    
    const newExpirationTimestamp = Math.floor(expirationDate.getTime() / 1000);
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
  }, [expirationDate, farm.expiration, farm.reward_pools]);

  const hasShortfall = rewardShortfalls.length > 0;

  const handleExtendFarm = async () => {
    if (!expirationDate) {
      toast({ 
        title: "Duration required", 
        description: "Please select a duration",
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

    const now = Math.floor(Date.now() / 1000);

    // Must be in the future and after current expiration (if set)
    if (expirationTimestamp <= now) {
      toast({ 
        title: "Invalid date", 
        description: "Expiration date must be in the future",
        variant: "destructive" 
      });
      return;
    }

    if (farm.expiration > 0 && expirationTimestamp <= farm.expiration) {
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
        expirationTimestamp
      );

      await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });

      toast({ 
        title: "Farm Extended!", 
        description: `${farm.farm_name} now expires on ${format(expirationDate, "PPP")}` 
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
            <p className="font-medium">{format(currentExpiration, "PPP 'at' p")}</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Extend Duration (from now)</label>
            <RadioGroup 
              value={selectedDuration} 
              onValueChange={setSelectedDuration}
              className="grid grid-cols-2 gap-2"
            >
              {DURATION_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`extend-${option.value}`} />
                  <Label htmlFor={`extend-${option.value}`} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {expirationDate && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>New expiration:</span>
              </div>
              <p className="font-medium mt-1">
                {format(expirationDate, "PPP 'at' p")}
              </p>
            </div>
          )}

          {/* Reward shortfall warning */}
          {hasShortfall && expirationDate && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">
                  Before extending the farm to {format(expirationDate, "PPP")}, the following rewards need to be deposited:
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
            disabled={isSubmitting || !expirationDate || hasShortfall}
          >
            {isSubmitting ? "Extending..." : "Extend Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
