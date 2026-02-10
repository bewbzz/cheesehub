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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowDownToLine, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useWax } from "@/context/WaxContext";
import { getTokenLogoUrl, TOKEN_LOGO_PLACEHOLDER } from "@/lib/tokenLogos";
import { closeWharfkitModals, getTransactPlugins } from "@/lib/wharfKit";
import type { FarmInfo } from "@/lib/farm";

interface WithdrawRewardsDialogProps {
  farm: FarmInfo;
  onSuccess?: () => void;
}

export function WithdrawRewardsDialog({ farm, onSuccess }: WithdrawRewardsDialogProps) {
  const { session, accountName } = useWax();
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleAmountChange = (index: number, value: string) => {
    setAmounts(prev => ({ ...prev, [index]: value }));
  };

  const hasValidAmounts = Object.entries(amounts).some(([_, value]) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  });

  const handleWithdraw = async () => {
    if (!accountName || !session || !hasValidAmounts) return;

    setIsLoading(true);
    try {
      const quantities: string[] = [];

      for (const [indexStr, value] of Object.entries(amounts)) {
        const numAmount = parseFloat(value);
        if (isNaN(numAmount) || numAmount <= 0) continue;

        const index = parseInt(indexStr);
        const pool = farm.reward_pools[index];
        const formattedAmount = numAmount.toFixed(pool.precision);
        quantities.push(`${formattedAmount} ${pool.symbol}`);
      }

      if (quantities.length === 0) {
        toast.error("Please enter at least one valid amount");
        return;
      }

      const actions = [
        {
          account: "farms.waxdao",
          name: "withdraw",
          authorization: [{ actor: accountName, permission: "active" }],
          data: {
            user: accountName,
            farm_name: farm.farm_name,
            quantities,
          },
        },
      ];

      await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      toast.success(`Successfully withdrew ${quantities.join(", ")} from ${farm.farm_name}`);
      setOpen(false);
      setAmounts({});
      onSuccess?.();
    } catch (error: any) {
      console.error("Withdraw error:", error);
      toast.error(error?.message || "Failed to withdraw rewards");
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
          <ArrowDownToLine className="h-4 w-4" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-cheese" />
            Withdraw Excess Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-sm text-amber-200">
              The contract will only allow you to withdraw rewards in excess of what is needed to pay stakers until the farm expires. If you over-request, the transaction will fail.
            </AlertDescription>
          </Alert>

          {farm.reward_pools.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No reward pools configured for this farm.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Enter amounts to withdraw</Label>
                {farm.reward_pools.map((pool, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/50">
                    <img
                      src={getTokenLogoUrl(pool.contract, pool.symbol)}
                      alt={pool.symbol}
                      className="h-8 w-8 rounded-full flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = TOKEN_LOGO_PLACEHOLDER;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{pool.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate">{pool.contract}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amounts[index] || ""}
                      onChange={(e) => handleAmountChange(index, e.target.value)}
                      min="0"
                      step="any"
                      className="w-28 text-right"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={!hasValidAmounts || isLoading}
                className="w-full bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Withdrawing...
                  </>
                ) : (
                  "Withdraw Rewards"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
