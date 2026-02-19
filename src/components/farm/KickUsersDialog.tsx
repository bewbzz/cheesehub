import { useState } from "react";
import { Users, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import { buildKickManyAction, FarmInfo } from "@/lib/farm";

interface KickUsersDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function KickUsersDialog({ farm, onSuccess }: KickUsersDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);
  const { session, accountName } = useWax();
  const { executeTransaction } = useWaxTransaction(session);

  const handleKick = async () => {
    if (!session || !accountName) return;

    const kickAmount = parseInt(amount, 10);
    if (isNaN(kickAmount) || kickAmount <= 0) return;

    setKickError(null);
    setIsSubmitting(true);
    try {
      const action = buildKickManyAction(accountName, farm.farm_name, kickAmount);
      console.log('[KickUsers] Sending action:', JSON.stringify(action, null, 2));
      const result = await executeTransaction([action], {
        successTitle: "Users Kicked",
        successDescription: `Successfully kicked up to ${kickAmount} stakers from ${farm.farm_name}`,
        showErrorToast: false,
      });

      if (result.success) {
        setOpen(false);
        onSuccess?.();
      } else if (result.error) {
        setKickError(result.error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
          <Users className="h-4 w-4 mr-1" />
          Kick Users
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-400" />
            Kick Users from Farm
          </DialogTitle>
          <DialogDescription>
            Remove stakers from your closed farm. You may need to call this multiple times if there are many stakers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Currently staked: <span className="text-foreground font-medium">{farm.staked_count} NFTs</span>
            </p>
          </div>

          {kickError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="break-all text-xs">{kickError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="kickAmount">Number of users to kick</Label>
            <Input
              id="kickAmount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
            />
            <p className="text-xs text-muted-foreground">
              Each call processes up to this many stakers. Call multiple times if needed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleKick}
            disabled={isSubmitting || !amount || parseInt(amount, 10) <= 0}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isSubmitting ? "Kicking..." : "Kick Users"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
