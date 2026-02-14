import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWax } from "@/context/WaxContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface RentSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startTime: number;
  position: number;
  waxPricePerDay: number;
  onSuccess: () => void;
}

export function RentSlotDialog({
  open,
  onOpenChange,
  startTime,
  position,
  waxPricePerDay,
  onSuccess,
}: RentSlotDialogProps) {
  const { session, transferToken } = useWax();
  const { toast } = useToast();
  const [numDays, setNumDays] = useState(1);
  const [payMethod, setPayMethod] = useState<"wax" | "cheese">("wax");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalWax = waxPricePerDay * numDays;
  const memo = `banner|${startTime}|${numDays}|${position}`;

  const handleRent = async () => {
    if (!session) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet first", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let txId: string | null;

      if (payMethod === "wax") {
        txId = await transferToken("eosio.token", "WAX", 8, "cheesebannad", totalWax, memo);
      } else {
        // For CHEESE, user needs to send equivalent value — for now we show WAX amount
        // The contract validates the CHEESE value against Alcor price
        toast({
          title: "CHEESE Payment",
          description: `Send enough CHEESE worth ${totalWax} WAX to cheesebannad with memo: ${memo}`,
        });
        setIsSubmitting(false);
        return;
      }

      if (txId) {
        toast({ title: "Slot Rented! 🧀", description: `Position ${position} rented for ${numDays} day(s)` });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Rent failed:", error);
      toast({
        title: "Rent Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rent Banner Slot</DialogTitle>
          <DialogDescription>
            Position {position} starting {format(new Date(startTime * 1000), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Number of Days</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={numDays}
              onChange={(e) => setNumDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Payment Method</Label>
            <RadioGroup
              value={payMethod}
              onValueChange={(v) => setPayMethod(v as "wax" | "cheese")}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50">
                <RadioGroupItem value="wax" id="pay-wax" />
                <Label htmlFor="pay-wax" className="cursor-pointer flex-1">
                  <span className="font-medium">{totalWax} WAX</span>
                  <span className="text-xs text-muted-foreground ml-2">({waxPricePerDay} WAX × {numDays} day{numDays > 1 ? "s" : ""})</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50">
                <RadioGroupItem value="cheese" id="pay-cheese" />
                <Label htmlFor="pay-cheese" className="cursor-pointer flex-1">
                  <span className="font-medium">CHEESE equivalent</span>
                  <span className="text-xs text-muted-foreground ml-2">(priced via Alcor Pool 1252)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>Memo: <code className="text-foreground">{memo}</code></p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleRent}
            disabled={isSubmitting || !session}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rent Slot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
