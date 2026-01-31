import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Clock, Rocket, AlertTriangle } from "lucide-react";
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
import { buildOpenFarmAction, FarmInfo } from "@/lib/farm";
import { getTransactPlugins } from "@/lib/wharfKit";

const DURATION_OPTIONS = [
  { value: "24h", label: "24 hours", hours: 24 },
  { value: "7d", label: "7 days", hours: 24 * 7 },
  { value: "30d", label: "30 days", hours: 24 * 30 },
  { value: "90d", label: "90 days", hours: 24 * 90 },
  { value: "180d", label: "180 days", hours: 24 * 180 },
  { value: "360d", label: "360 days", hours: 24 * 360 },
];

interface OpenFarmDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function OpenFarmDialog({ farm, onSuccess }: OpenFarmDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState("7d");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { session } = useWax();

  // Check if ALL configured reward pools have deposits
  const poolsWithoutRewards = farm.reward_pools.filter(pool => {
    const balance = parseFloat(pool.balance) || 0;
    return balance <= 0;
  });
  const hasAllRewards = farm.reward_pools.length > 0 && poolsWithoutRewards.length === 0;

  // Calculate expiration date from selected duration
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

  const handleOpenFarm = async () => {
    if (!hasAllRewards) {
      toast({ 
        title: "No rewards deposited", 
        description: "You must deposit rewards before opening the farm",
        variant: "destructive" 
      });
      return;
    }

    if (!expirationDate) {
      toast({ 
        title: "Duration required", 
        description: "Please select a duration",
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
        description: `${farm.farm_name} is now live until ${format(expirationDate, "PPP")}` 
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
            Set how long the farm will run. Once opened, users can start staking.
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

          <div className="space-y-3">
            <label className="text-sm font-medium">Farm Duration</label>
            <RadioGroup 
              value={selectedDuration} 
              onValueChange={setSelectedDuration}
              className="grid grid-cols-2 gap-2"
              disabled={!hasAllRewards}
            >
              {DURATION_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {expirationDate && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Farm expires:</span>
              </div>
              <p className="font-medium mt-1">
                {format(expirationDate, "PPP 'at' p")}
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
            disabled={isSubmitting || !expirationDate || !hasAllRewards}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Opening..." : "Open Farm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
