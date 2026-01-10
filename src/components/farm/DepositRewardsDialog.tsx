import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { useWax } from "@/context/WaxContext";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { closeWharfkitModals } from "@/lib/wharfKit";
import type { FarmInfo } from "@/lib/farm";

interface DepositRewardsDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function DepositRewardsDialog({ farm, onSuccess }: DepositRewardsDialogProps) {
  const { session, accountName } = useWax();
  const [open, setOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDeposit = async () => {
    if (selectedPool === null || !amount || !accountName || !session) return;

    const pool = farm.reward_pools[selectedPool];
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      // Format quantity with correct precision
      const formattedAmount = numAmount.toFixed(pool.precision);
      const quantity = `${formattedAmount} ${pool.symbol}`;

      const actions = [
        {
          account: pool.contract,
          name: "transfer",
          authorization: [{ actor: accountName, permission: "active" }],
          data: {
            from: accountName,
            to: "farms.waxdao",
            quantity: quantity,
            memo: `|deposit|${farm.farm_name}|`,
          },
        },
      ];

      await session.transact({ actions });
      toast.success(`Successfully deposited ${quantity} to ${farm.farm_name}`);
      setOpen(false);
      setAmount("");
      setSelectedPool(null);
      onSuccess?.();
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast.error(error?.message || "Failed to deposit rewards");
    } finally {
      setIsLoading(false);
      closeWharfkitModals();
    }
  };

  if (!accountName) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            Deposit Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {farm.reward_pools.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No reward pools configured for this farm.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Token</Label>
                <div className="grid gap-2">
                  {farm.reward_pools.map((pool, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedPool(index)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedPool === index
                          ? "border-primary bg-primary/10"
                          : "border-border/50 bg-muted/50 hover:border-border"
                      }`}
                    >
                      <img
                        src={getTokenLogoUrl(pool.contract, pool.symbol)}
                        alt={pool.symbol}
                        className="h-8 w-8 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                        }}
                      />
                      <div className="text-left">
                        <p className="font-medium">{pool.symbol}</p>
                        <p className="text-xs text-muted-foreground">{pool.contract}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedPool !== null && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder={`Enter ${farm.reward_pools[selectedPool].symbol} amount`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="any"
                  />
                </div>
              )}

              <Button
                onClick={handleDeposit}
                disabled={selectedPool === null || !amount || isLoading}
                className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Depositing...
                  </>
                ) : (
                  "Deposit Rewards"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
